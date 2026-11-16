import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const PORT = 3000;
const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local');
const SCHEMA_SQL_PATH = path.resolve(process.cwd(), 'supabase/schema.sql');

const DEFAULT_CREATOR_PROFILE = {
  id: 'default-solo-creator',
  slug: 'solo',
  display_name: 'Valentina Noir',
  handle: '@valentinanoir',
  bio: 'Ensaios autorais, bastidores íntimos e vídeos exclusivos em 4K. Conteúdo estritamente para maiores de 18 anos.',
  location: 'São Paulo, Brasil',
  avatar_url: '/src/assets/images/creator_avatar_portrait_1794805425733.jpg',
  hero_url: '/src/assets/images/creator_hero_editorial_1794805426073.jpg',
  vip_monthly_price_brl: 49.9,
  vip_description:
    'Acesso ilimitado a todos os ensaios e vídeos marcados como VIP, atualizações semanais e prioridade em pedidos.',
  pix_key: '',
  age_verified_18: true,
  updated_at: new Date().toISOString(),
};

interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  creatorPin: string;
}

const runtimeConfig: RuntimeConfig = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  creatorPin: process.env.CREATOR_PIN || '1818',
};

let cachedAdminClient: SupabaseClient | null = null;
let cachedConfigFingerprint = '';

function getAdminClient(): SupabaseClient | null {
  const url = runtimeConfig.supabaseUrl.trim();
  const key = runtimeConfig.supabaseServiceRoleKey.trim();
  if (!url || !key) {
    return null;
  }
  const fingerprint = `${url}::${key}`;
  if (cachedAdminClient && cachedConfigFingerprint === fingerprint) {
    return cachedAdminClient;
  }
  cachedAdminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  cachedConfigFingerprint = fingerprint;
  return cachedAdminClient;
}

function saveEnvLocal(updates: Record<string, string>) {
  const existing: Record<string, string> = {};
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    const raw = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        existing[k] = v;
      }
    }
  }
  Object.assign(existing, updates);
  const content = Object.entries(existing)
    .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';
  fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf8');
}

function readSchemaSql(): string {
  if (fs.existsSync(SCHEMA_SQL_PATH)) {
    return fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
  }
  return '';
}

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const parsed = new URL(supabaseUrl);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
      return hostParts[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureStorageBuckets(client: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: buckets, error: listErr } = await client.storage.listBuckets();
    if (listErr) {
      return { ok: false, error: listErr.message };
    }
    const existingNames = new Set((buckets || []).map((b) => b.name));
    if (!existingNames.has('creator-media')) {
      const { error } = await client.storage.createBucket('creator-media', {
        public: false,
        fileSizeLimit: 524288000, // 500MB for 4K videos
      });
      if (error && !error.message.toLowerCase().includes('already exists')) {
        return { ok: false, error: error.message };
      }
    }
    if (!existingNames.has('creator-previews')) {
      const { error } = await client.storage.createBucket('creator-previews', {
        public: true,
        fileSizeLimit: 26214400, // 25MB
      });
      if (error && !error.message.toLowerCase().includes('already exists')) {
        return { ok: false, error: error.message };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao verificar buckets' };
  }
}

async function executeSchemaViaPg(databaseUrl: string, sql: string): Promise<{ ok: boolean; error?: string }> {
  const pg = new PgClient({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pg.connect();
    await pg.query(sql);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha ao executar SQL no Postgres' };
  } finally {
    await pg.end().catch(() => {});
  }
}

async function executeSchemaViaManagementApi(
  accessToken: string,
  projectRef: string,
  sql: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Management API (${resp.status}): ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro de rede na Management API' };
  }
}

async function checkSupabaseStatus() {
  const client = getAdminClient();
  if (!client) {
    return {
      connected: false,
      schemaReady: false,
      bucketsReady: false,
      projectUrl: runtimeConfig.supabaseUrl || null,
      missingTables: ['creator_profile', 'media_items', 'fans', 'sales', 'unlocked_media'],
      error: null,
    };
  }

  const requiredTables = ['creator_profile', 'media_items', 'fans', 'sales', 'unlocked_media'];
  const missingTables: string[] = [];
  let connectionError: string | null = null;

  for (const table of requiredTables) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('invalid api key')) {
        connectionError = msg;
        break;
      }
      missingTables.push(table);
    }
  }

  let bucketsReady = false;
  if (!connectionError) {
    const { data: buckets, error: bucketErr } = await client.storage.listBuckets();
    if (!bucketErr && buckets) {
      const names = new Set(buckets.map((b) => b.name));
      bucketsReady = names.has('creator-media') && names.has('creator-previews');
    }
  }

  return {
    connected: !connectionError,
    schemaReady: !connectionError && missingTables.length === 0,
    bucketsReady,
    projectUrl: runtimeConfig.supabaseUrl,
    missingTables,
    error: connectionError,
  };
}

function requireCreatorAuth(req: Request, res: Response, next: NextFunction) {
  const pinHeader = (req.headers['x-creator-pin'] as string) || '';
  if (!pinHeader || pinHeader !== runtimeConfig.creatorPin) {
    res.status(401).json({ error: 'PIN da criadora inválido ou ausente.' });
    return;
  }
  next();
}

async function resolveSignedMediaUrl(client: SupabaseClient, storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('/')) {
    return storagePath;
  }
  const { data, error } = await client.storage.from('creator-media').createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

async function resolvePreviewUrl(client: SupabaseClient, previewUrl: string | null, storagePath: string, mediaType: string): Promise<string | null> {
  if (previewUrl) return previewUrl;
  if (mediaType === 'photo' && storagePath) {
    const { data } = await client.storage.from('creator-media').createSignedUrl(storagePath, 3600);
    return data?.signedUrl || null;
  }
  return null;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // --- SUPABASE PROVISIONING & STATUS ---

  app.get('/api/supabase/status', async (_req: Request, res: Response) => {
    const status = await checkSupabaseStatus();
    res.json(status);
  });

  app.get('/api/supabase/schema', (_req: Request, res: Response) => {
    res.json({ sql: readSchemaSql() });
  });

  app.post('/api/supabase/connect', async (req: Request, res: Response) => {
    try {
      const { supabaseUrl, anonKey, serviceRoleKey, databaseUrl, accessToken } = req.body || {};
      if (!supabaseUrl || !serviceRoleKey) {
        res.status(400).json({ error: 'Informe a URL do projeto e a Service Role Key do Supabase.' });
        return;
      }

      const cleanUrl = String(supabaseUrl).trim().replace(/\/+$/, '');
      const cleanAnon = String(anonKey || '').trim();
      const cleanService = String(serviceRoleKey).trim();

      const testClient = createClient(cleanUrl, cleanService, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: bucketListErr } = await testClient.storage.listBuckets();
      if (bucketListErr) {
        res.status(400).json({ error: `Falha ao autenticar no Supabase: ${bucketListErr.message}` });
        return;
      }

      let schemaProvisioned = false;
      let schemaMessage = '';
      const sql = readSchemaSql();

      if (databaseUrl && String(databaseUrl).trim()) {
        const pgRes = await executeSchemaViaPg(String(databaseUrl).trim(), sql);
        if (!pgRes.ok) {
          res.status(400).json({ error: `Conectado ao Supabase, mas erro ao criar tabelas via Postgres: ${pgRes.error}` });
          return;
        }
        schemaProvisioned = true;
        schemaMessage = 'Tabelas e políticas criadas automaticamente via Postgres.';
      } else if (accessToken && String(accessToken).trim()) {
        const ref = extractProjectRef(cleanUrl);
        if (ref) {
          const mgmtRes = await executeSchemaViaManagementApi(String(accessToken).trim(), ref, sql);
          if (!mgmtRes.ok) {
            res.status(400).json({ error: `Conectado ao Supabase, mas erro ao criar tabelas: ${mgmtRes.error}` });
            return;
          }
          schemaProvisioned = true;
          schemaMessage = 'Tabelas e políticas criadas automaticamente via Supabase Management API.';
        }
      }

      await ensureStorageBuckets(testClient);

      runtimeConfig.supabaseUrl = cleanUrl;
      runtimeConfig.supabaseAnonKey = cleanAnon;
      runtimeConfig.supabaseServiceRoleKey = cleanService;
      cachedAdminClient = testClient;
      cachedConfigFingerprint = `${cleanUrl}::${cleanService}`;

      saveEnvLocal({
        SUPABASE_URL: cleanUrl,
        SUPABASE_ANON_KEY: cleanAnon,
        SUPABASE_SERVICE_ROLE_KEY: cleanService,
      });

      const status = await checkSupabaseStatus();
      res.json({
        ok: true,
        schemaProvisioned,
        message: schemaMessage || 'Conexão Supabase salva e buckets configurados.',
        status,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno ao conectar Supabase.' });
    }
  });

  app.post('/api/supabase/organizations', async (req: Request, res: Response) => {
    try {
      const { accessToken } = req.body || {};
      if (!accessToken) {
        res.status(400).json({ error: 'Token pessoal do Supabase (sbp_...) é obrigatório.' });
        return;
      }
      const resp = await fetch('https://api.supabase.com/v1/organizations', {
        headers: { Authorization: `Bearer ${String(accessToken).trim()}` },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        res.status(resp.status).json({ error: `Erro ao buscar organizações no Supabase: ${txt}` });
        return;
      }
      const orgs = await resp.json();
      res.json({ organizations: orgs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao listar organizações.' });
    }
  });

  app.post('/api/supabase/provision-project', async (req: Request, res: Response) => {
    try {
      const { accessToken, organizationId, name, region, dbPass } = req.body || {};
      if (!accessToken || !organizationId || !name || !dbPass) {
        res.status(400).json({ error: 'Token, Organização, Nome do Projeto e Senha do Banco são obrigatórios.' });
        return;
      }

      const resp = await fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${String(accessToken).trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: String(organizationId).trim(),
          name: String(name).trim(),
          region: String(region || 'sa-east-1').trim(),
          db_pass: String(dbPass),
          plan: 'free',
        }),
      });

      const bodyText = await resp.text();
      if (!resp.ok) {
        res.status(resp.status).json({ error: `Supabase recusou criação do projeto: ${bodyText}` });
        return;
      }
      const project = JSON.parse(bodyText);
      res.json({
        projectRef: project.id || project.ref,
        status: project.status,
        name: project.name,
        region: project.region,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao criar projeto no Supabase.' });
    }
  });

  app.post('/api/supabase/finalize-project', async (req: Request, res: Response) => {
    try {
      const { accessToken, projectRef } = req.body || {};
      if (!accessToken || !projectRef) {
        res.status(400).json({ error: 'accessToken e projectRef são obrigatórios.' });
        return;
      }
      const token = String(accessToken).trim();
      const ref = String(projectRef).trim();

      const projResp = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!projResp.ok) {
        res.status(projResp.status).json({ error: 'Não foi possível consultar o projeto no Supabase.' });
        return;
      }
      const proj = await projResp.json();
      if (proj.status !== 'ACTIVE_HEALTHY') {
        res.json({ ready: false, projectStatus: proj.status });
        return;
      }

      const keysResp = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!keysResp.ok) {
        res.status(keysResp.status).json({ error: 'Projeto ativo, mas não foi possível obter chaves API.' });
        return;
      }
      const keys: Array<{ name: string; api_key: string }> = await keysResp.json();
      const anonKey = keys.find((k) => k.name === 'anon')?.api_key || '';
      const serviceRoleKey = keys.find((k) => k.name === 'service_role')?.api_key || '';
      const supabaseUrl = `https://${ref}.supabase.co`;

      if (!serviceRoleKey) {
        res.json({ ready: false, projectStatus: 'WAITING_KEYS' });
        return;
      }

      const sql = readSchemaSql();
      const sqlResult = await executeSchemaViaManagementApi(token, ref, sql);
      if (!sqlResult.ok) {
        res.status(500).json({ error: `Projeto criado, mas falha ao criar tabelas: ${sqlResult.error}` });
        return;
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await ensureStorageBuckets(adminClient);

      runtimeConfig.supabaseUrl = supabaseUrl;
      runtimeConfig.supabaseAnonKey = anonKey;
      runtimeConfig.supabaseServiceRoleKey = serviceRoleKey;
      cachedAdminClient = adminClient;
      cachedConfigFingerprint = `${supabaseUrl}::${serviceRoleKey}`;

      saveEnvLocal({
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: anonKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      });

      const status = await checkSupabaseStatus();
      res.json({ ready: true, status });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao finalizar projeto Supabase.' });
    }
  });

  // --- CREATOR AUTH ---

  app.post('/api/creator/verify-pin', (req: Request, res: Response) => {
    const { pin } = req.body || {};
    if (String(pin || '') === runtimeConfig.creatorPin) {
      res.json({ ok: true });
      return;
    }
    res.status(401).json({ ok: false, error: 'PIN incorreto.' });
  });

  // --- STOREFRONT & FAN API ---

  app.get('/api/storefront', async (req: Request, res: Response) => {
    const fanEmail = String(req.query.email || '').trim().toLowerCase();
    const client = getAdminClient();

    if (!client) {
      res.json({
        supabaseConnected: false,
        profile: DEFAULT_CREATOR_PROFILE,
        mediaItems: [],
        fan: null,
        stats: {
          totalPhotos: 0,
          totalVideos: 0,
          collectionsCount: 0,
          vipPriceBrl: DEFAULT_CREATOR_PROFILE.vip_monthly_price_brl,
          activeVipCount: 0,
        },
      });
      return;
    }

    try {
      const { data: profileRow } = await client
        .from('creator_profile')
        .select('*')
        .eq('slug', 'solo')
        .maybeSingle();

      const profile = profileRow
        ? {
            ...DEFAULT_CREATOR_PROFILE,
            ...profileRow,
            vip_monthly_price_brl: Number(profileRow.vip_monthly_price_brl || 49.9),
            avatar_url: profileRow.avatar_url || DEFAULT_CREATOR_PROFILE.avatar_url,
            hero_url: profileRow.hero_url || DEFAULT_CREATOR_PROFILE.hero_url,
          }
        : DEFAULT_CREATOR_PROFILE;

      let fan = null;
      const unlockedSet = new Set<string>();

      if (fanEmail) {
        const { data: fanRow } = await client
          .from('fans')
          .select('*')
          .eq('email', fanEmail)
          .maybeSingle();
        if (fanRow) {
          const isVipActive =
            Boolean(fanRow.is_vip) &&
            (!fanRow.vip_expires_at || new Date(fanRow.vip_expires_at).getTime() > Date.now());
          fan = { ...fanRow, is_vip: isVipActive };
        }
        const { data: unlockedRows } = await client
          .from('unlocked_media')
          .select('media_id')
          .eq('buyer_email', fanEmail);
        for (const r of unlockedRows || []) {
          unlockedSet.add(r.media_id);
        }
      }

      const { data: rawMedia, error: mediaErr } = await client
        .from('media_items')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (mediaErr) {
        res.json({
          supabaseConnected: true,
          schemaMissing: true,
          profile,
          mediaItems: [],
          fan,
          stats: {
            totalPhotos: 0,
            totalVideos: 0,
            collectionsCount: 0,
            vipPriceBrl: profile.vip_monthly_price_brl,
            activeVipCount: 0,
          },
        });
        return;
      }

      const mediaRows = rawMedia || [];
      const isFanVip = Boolean(fan?.is_vip);

      const enriched = await Promise.all(
        mediaRows.map(async (item) => {
          const isUnlocked =
            item.access_tier === 'free' ||
            (item.access_tier === 'vip' && isFanVip) ||
            unlockedSet.has(item.id);

          const signedMediaUrl = isUnlocked ? await resolveSignedMediaUrl(client, item.storage_path) : null;
          const previewUrl = isUnlocked
            ? item.preview_url || (item.media_type === 'photo' ? signedMediaUrl : null)
            : item.preview_url || null;

          return {
            ...item,
            price_brl: Number(item.price_brl || 0),
            is_unlocked: isUnlocked,
            media_url: signedMediaUrl,
            preview_url: previewUrl,
          };
        })
      );

      const { count: vipCount } = await client
        .from('fans')
        .select('*', { count: 'exact', head: true })
        .eq('is_vip', true);

      const collections = new Set(mediaRows.map((m) => m.collection_name || 'Geral'));
      res.json({
        supabaseConnected: true,
        schemaMissing: false,
        profile,
        mediaItems: enriched,
        fan,
        stats: {
          totalPhotos: mediaRows.filter((m) => m.media_type === 'photo').length,
          totalVideos: mediaRows.filter((m) => m.media_type === 'video').length,
          collectionsCount: collections.size,
          vipPriceBrl: profile.vip_monthly_price_brl,
          activeVipCount: vipCount || 0,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao carregar vitrine.' });
    }
  });

  app.post('/api/fan/access', async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Conecte seu projeto Supabase antes de acessar contas.' });
      return;
    }
    try {
      const { email, displayName, ageConfirmed18 } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
      }
      if (!ageConfirmed18) {
        res.status(400).json({ error: 'É obrigatório confirmar ser maior de 18 anos.' });
        return;
      }

      const { data: existing } = await client
        .from('fans')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let fan = existing;
      if (!fan) {
        const { data: created, error: createErr } = await client
          .from('fans')
          .insert({
            email: cleanEmail,
            display_name: displayName ? String(displayName).trim() : cleanEmail.split('@')[0],
            age_confirmed_18: true,
          })
          .select('*')
          .single();
        if (createErr) {
          res.status(500).json({ error: createErr.message });
          return;
        }
        fan = created;
      }

      const isVipActive =
        Boolean(fan.is_vip) &&
        (!fan.vip_expires_at || new Date(fan.vip_expires_at).getTime() > Date.now());

      res.json({ fan: { ...fan, is_vip: isVipActive } });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao acessar conta.' });
    }
  });

  app.post('/api/storefront/checkout', async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Conecte o Supabase na aba "Conexão Supabase" para processar vendas.' });
      return;
    }
    try {
      const { buyerEmail, buyerName, saleType, mediaId, amountBrl, paymentMethod, ageConfirmed18 } = req.body || {};
      const cleanEmail = String(buyerEmail || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'E-mail válido é obrigatório para liberar o acesso.' });
        return;
      }
      if (!ageConfirmed18) {
        res.status(400).json({ error: 'Confirme ter 18 anos ou mais para continuar.' });
        return;
      }
      if (!['vip_subscription', 'ppv', 'tip'].includes(saleType)) {
        res.status(400).json({ error: 'Tipo de venda inválido.' });
        return;
      }

      let authoritativeAmount = Number(amountBrl || 0);
      if (saleType === 'vip_subscription') {
        const { data: prof } = await client
          .from('creator_profile')
          .select('vip_monthly_price_brl')
          .eq('slug', 'solo')
          .maybeSingle();
        authoritativeAmount = Number(prof?.vip_monthly_price_brl || 49.9);
      } else if (saleType === 'ppv') {
        if (!mediaId) {
          res.status(400).json({ error: 'mediaId é obrigatório para compra avulsa.' });
          return;
        }
        const { data: mediaRow } = await client
          .from('media_items')
          .select('id, price_brl')
          .eq('id', mediaId)
          .maybeSingle();
        if (!mediaRow) {
          res.status(404).json({ error: 'Mídia não encontrada.' });
          return;
        }
        authoritativeAmount = Number(mediaRow.price_brl || 0);
      }

      if (authoritativeAmount <= 0 && saleType === 'tip') {
        res.status(400).json({ error: 'Informe um valor positivo para o mimo.' });
        return;
      }

      // Upsert fan
      const vipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingFan } = await client
        .from('fans')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let fanId: string;
      if (existingFan) {
        fanId = existingFan.id;
        if (saleType === 'vip_subscription') {
          await client
            .from('fans')
            .update({
              is_vip: true,
              vip_expires_at: vipExpiry,
              display_name: buyerName || existingFan.display_name,
            })
            .eq('id', fanId);
        }
      } else {
        const { data: newFan, error: fanErr } = await client
          .from('fans')
          .insert({
            email: cleanEmail,
            display_name: buyerName ? String(buyerName).trim() : cleanEmail.split('@')[0],
            is_vip: saleType === 'vip_subscription',
            vip_expires_at: saleType === 'vip_subscription' ? vipExpiry : null,
            age_confirmed_18: true,
          })
          .select('*')
          .single();
        if (fanErr) {
          res.status(500).json({ error: fanErr.message });
          return;
        }
        fanId = newFan.id;
      }

      // Create sale record
      const externalRef = `MP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const { data: sale, error: saleErr } = await client
        .from('sales')
        .insert({
          fan_id: fanId,
          buyer_email: cleanEmail,
          buyer_name: buyerName ? String(buyerName).trim() : null,
          sale_type: saleType,
          media_id: saleType === 'ppv' ? mediaId : null,
          amount_brl: authoritativeAmount,
          payment_method: paymentMethod === 'card' ? 'card' : 'pix',
          status: 'paid',
          external_ref: externalRef,
        })
        .select('*')
        .single();

      if (saleErr) {
        res.status(500).json({ error: saleErr.message });
        return;
      }

      if (saleType === 'ppv' && mediaId) {
        await client.from('unlocked_media').upsert(
          {
            fan_id: fanId,
            buyer_email: cleanEmail,
            media_id: mediaId,
            sale_id: sale.id,
          },
          { onConflict: 'buyer_email,media_id' }
        );

        const { data: curMedia } = await client
          .from('media_items')
          .select('unlocks_count')
          .eq('id', mediaId)
          .maybeSingle();
        if (curMedia) {
          await client
            .from('media_items')
            .update({ unlocks_count: Number(curMedia.unlocks_count || 0) + 1 })
            .eq('id', mediaId);
        }
      }

      res.json({ ok: true, sale });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao processar compra.' });
    }
  });

  // --- CREATOR STUDIO API (Protected) ---

  app.get('/api/creator/dashboard', requireCreatorAuth, async (_req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.json({
        supabaseConnected: false,
        profile: DEFAULT_CREATOR_PROFILE,
        dashboard: {
          mediaItems: [],
          sales: [],
          fans: [],
          metrics: {
            totalRevenueBrl: 0,
            vipRevenueBrl: 0,
            ppvRevenueBrl: 0,
            tipsRevenueBrl: 0,
            totalSalesCount: 0,
            activeVipFans: 0,
            totalMediaCount: 0,
          },
        },
      });
      return;
    }

    try {
      const [profileRes, mediaRes, salesRes, fansRes] = await Promise.all([
        client.from('creator_profile').select('*').eq('slug', 'solo').maybeSingle(),
        client.from('media_items').select('*').order('created_at', { ascending: false }),
        client.from('sales').select('*').order('created_at', { ascending: false }),
        client.from('fans').select('*').order('created_at', { ascending: false }),
      ]);

      const profile = profileRes.data
        ? {
            ...DEFAULT_CREATOR_PROFILE,
            ...profileRes.data,
            vip_monthly_price_brl: Number(profileRes.data.vip_monthly_price_brl || 49.9),
            avatar_url: profileRes.data.avatar_url || DEFAULT_CREATOR_PROFILE.avatar_url,
            hero_url: profileRes.data.hero_url || DEFAULT_CREATOR_PROFILE.hero_url,
          }
        : DEFAULT_CREATOR_PROFILE;

      const mediaRows = mediaRes.data || [];
      const mediaTitleMap = new Map<string, string>();
      for (const m of mediaRows) {
        mediaTitleMap.set(m.id, m.title);
      }

      const enrichedMedia = await Promise.all(
        mediaRows.map(async (item) => {
          const signedUrl = await resolveSignedMediaUrl(client, item.storage_path);
          return {
            ...item,
            price_brl: Number(item.price_brl || 0),
            media_url: signedUrl,
            preview_url: await resolvePreviewUrl(client, item.preview_url, item.storage_path, item.media_type),
            is_unlocked: true,
          };
        })
      );

      const salesRows = (salesRes.data || []).map((s) => ({
        ...s,
        amount_brl: Number(s.amount_brl || 0),
        media_title: s.media_id ? mediaTitleMap.get(s.media_id) || 'Mídia removida' : null,
      }));

      const paidSales = salesRows.filter((s) => s.status === 'paid');
      const totalRevenueBrl = paidSales.reduce((acc, s) => acc + s.amount_brl, 0);
      const vipRevenueBrl = paidSales
        .filter((s) => s.sale_type === 'vip_subscription')
        .reduce((acc, s) => acc + s.amount_brl, 0);
      const ppvRevenueBrl = paidSales
        .filter((s) => s.sale_type === 'ppv')
        .reduce((acc, s) => acc + s.amount_brl, 0);
      const tipsRevenueBrl = paidSales
        .filter((s) => s.sale_type === 'tip')
        .reduce((acc, s) => acc + s.amount_brl, 0);

      const fansRows = fansRes.data || [];
      const activeVipFans = fansRows.filter(
        (f) => f.is_vip && (!f.vip_expires_at || new Date(f.vip_expires_at).getTime() > Date.now())
      ).length;

      res.json({
        supabaseConnected: true,
        profile,
        dashboard: {
          mediaItems: enrichedMedia,
          sales: salesRows,
          fans: fansRows,
          metrics: {
            totalRevenueBrl,
            vipRevenueBrl,
            ppvRevenueBrl,
            tipsRevenueBrl,
            totalSalesCount: paidSales.length,
            activeVipFans,
            totalMediaCount: enrichedMedia.length,
          },
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao carregar painel da criadora.' });
    }
  });

  app.post('/api/creator/media/upload-url', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { fileName, bucket } = req.body || {};
      const targetBucket = bucket === 'creator-previews' ? 'creator-previews' : 'creator-media';
      const safeName = String(fileName || 'arquivo')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();
      const storagePath = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;

      const { data, error } = await client.storage.from(targetBucket).createSignedUploadUrl(storagePath);
      if (error || !data) {
        res.status(500).json({ error: error?.message || 'Erro ao gerar URL assinada de upload.' });
        return;
      }

      let publicUrl: string | null = null;
      if (targetBucket === 'creator-previews') {
        const pub = client.storage.from(targetBucket).getPublicUrl(storagePath);
        publicUrl = pub.data.publicUrl;
      }

      res.json({
        bucket: targetBucket,
        storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        publicUrl,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao preparar upload.' });
    }
  });

  // Fallback binary upload through server when browser direct upload encounters CORS
  app.post(
    '/api/creator/media/upload-binary',
    requireCreatorAuth,
    express.raw({ type: '*/*', limit: '250mb' }),
    async (req: Request, res: Response) => {
      const client = getAdminClient();
      if (!client) {
        res.status(503).json({ error: 'Supabase não conectado.' });
        return;
      }
      try {
        const rawName = String(req.headers['x-file-name'] || 'media.bin');
        const mimeType = String(req.headers['x-mime-type'] || req.headers['content-type'] || 'application/octet-stream');
        const targetBucket = req.headers['x-bucket'] === 'creator-previews' ? 'creator-previews' : 'creator-media';
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
        const storagePath = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;

        const buffer = req.body as Buffer;
        if (!buffer || !buffer.length) {
          res.status(400).json({ error: 'Arquivo vazio.' });
          return;
        }

        const { error } = await client.storage.from(targetBucket).upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        let publicUrl: string | null = null;
        if (targetBucket === 'creator-previews') {
          publicUrl = client.storage.from(targetBucket).getPublicUrl(storagePath).data.publicUrl;
        }

        res.json({ storagePath, bucket: targetBucket, publicUrl });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Falha no envio binário.' });
      }
    }
  );

  app.post('/api/creator/media', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const {
        title,
        description,
        mediaType,
        accessTier,
        priceBrl,
        collectionName,
        storagePath,
        previewUrl,
        durationSeconds,
        fileSizeBytes,
        mimeType,
        isPublished,
      } = req.body || {};

      if (!title || !storagePath || !['photo', 'video'].includes(mediaType)) {
        res.status(400).json({ error: 'Título, tipo de mídia e caminho de armazenamento são obrigatórios.' });
        return;
      }

      const { data, error } = await client
        .from('media_items')
        .insert({
          title: String(title).trim(),
          description: String(description || '').trim(),
          media_type: mediaType,
          access_tier: ['free', 'vip', 'ppv'].includes(accessTier) ? accessTier : 'vip',
          price_brl: accessTier === 'ppv' ? Number(priceBrl || 29.9) : 0,
          collection_name: String(collectionName || 'Geral').trim() || 'Geral',
          storage_path: String(storagePath),
          media_url: String(storagePath),
          preview_url: previewUrl || null,
          duration_seconds: durationSeconds ? Number(durationSeconds) : null,
          file_size_bytes: fileSizeBytes ? Number(fileSizeBytes) : null,
          mime_type: mimeType || null,
          is_published: isPublished !== false,
        })
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ item: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar mídia.' });
    }
  });

  app.patch('/api/creator/media/:id', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { id } = req.params;
      const { title, description, access_tier, price_brl, collection_name, is_published } = req.body || {};
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = String(title).trim();
      if (description !== undefined) updates.description = String(description).trim();
      if (access_tier !== undefined) updates.access_tier = access_tier;
      if (price_brl !== undefined) updates.price_brl = Number(price_brl);
      if (collection_name !== undefined) updates.collection_name = String(collection_name).trim();
      if (is_published !== undefined) updates.is_published = Boolean(is_published);

      const { data, error } = await client
        .from('media_items')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ item: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar mídia.' });
    }
  });

  app.delete('/api/creator/media/:id', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { id } = req.params;
      const { data: existing } = await client
        .from('media_items')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();

      if (existing?.storage_path && !existing.storage_path.startsWith('http') && !existing.storage_path.startsWith('/')) {
        await client.storage.from('creator-media').remove([existing.storage_path]);
      }

      const { error } = await client.from('media_items').delete().eq('id', id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao excluir mídia.' });
    }
  });

  app.patch('/api/creator/profile', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const {
        display_name,
        handle,
        bio,
        location,
        vip_monthly_price_brl,
        vip_description,
        pix_key,
        avatar_url,
        hero_url,
        newPin,
      } = req.body || {};

      if (newPin && String(newPin).trim().length >= 4) {
        runtimeConfig.creatorPin = String(newPin).trim();
        saveEnvLocal({ CREATOR_PIN: runtimeConfig.creatorPin });
      }

      const payload: Record<string, unknown> = {
        slug: 'solo',
        updated_at: new Date().toISOString(),
      };
      if (display_name !== undefined) payload.display_name = String(display_name).trim();
      if (handle !== undefined) payload.handle = String(handle).trim();
      if (bio !== undefined) payload.bio = String(bio).trim();
      if (location !== undefined) payload.location = String(location).trim();
      if (vip_monthly_price_brl !== undefined) payload.vip_monthly_price_brl = Number(vip_monthly_price_brl);
      if (vip_description !== undefined) payload.vip_description = String(vip_description).trim();
      if (pix_key !== undefined) payload.pix_key = String(pix_key).trim();
      if (avatar_url !== undefined) payload.avatar_url = avatar_url;
      if (hero_url !== undefined) payload.hero_url = hero_url;

      const { data, error } = await client
        .from('creator_profile')
        .upsert(payload, { onConflict: 'slug' })
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ profile: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar perfil.' });
    }
  });

  app.patch('/api/creator/sales/:id', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!['paid', 'pending', 'refunded'].includes(status)) {
        res.status(400).json({ error: 'Status inválido.' });
        return;
      }

      const { data: sale, error } = await client
        .from('sales')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (status === 'refunded' && sale) {
        if (sale.sale_type === 'ppv' && sale.media_id) {
          await client.from('unlocked_media').delete().eq('sale_id', sale.id);
        } else if (sale.sale_type === 'vip_subscription' && sale.fan_id) {
          await client.from('fans').update({ is_vip: false }).eq('id', sale.fan_id);
        }
      }

      res.json({ sale });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar venda.' });
    }
  });

  app.get('/api/creator/export-zip', requireCreatorAuth, async (_req: Request, res: Response) => {
    try {
      const zip = new JSZip();
      const rootDir = process.cwd();
      const ignoredDirs = new Set(['node_modules', 'dist', 'build', '.git', '.aistudio', 'coverage']);

      const walkDir = (currentDir: string, zipFolder: JSZip) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
          if (entry.name.endsWith('.log') || entry.name === '.DS_Store') continue;

          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) continue;
            const sub = zipFolder.folder(entry.name);
            if (sub) walkDir(fullPath, sub);
          } else if (entry.isFile()) {
            const content = fs.readFileSync(fullPath);
            zipFolder.file(entry.name, content);
          }
        }
      };

      walkDir(rootDir, zip);
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="maison-prive-codigo.zip"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao gerar arquivo ZIP.' });
    }
  });

  // --- VITE / STATIC SERVING ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maison Privé server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

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
import { DEFAULT_CREATOR_ABOUT, sanitizeCreatorAboutContent } from './src/lib/creatorAbout';
import { DEFAULT_MIMO_SECTION, sanitizeMimoSectionConfig } from './src/lib/mimoGifts';
import { DEFAULT_FAN_TESTIMONIALS, sanitizeTestimonials, computeTestimonialStats } from './src/lib/testimonials';
import { STOREFRONT_FAQS, buildStorefrontJsonLd } from './src/lib/seo';
import { computeFanLoyalty } from './src/lib/loyalty';
import type { CreatorAboutContent, FanTestimonial, MimoSectionConfig } from './src/types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const PORT = Number(process.env.PORT) || 3000;
const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local');
const SCHEMA_SQL_PATH = path.resolve(process.cwd(), 'supabase/schema.sql');
const EDGE_WELCOME_FN_PATH = path.resolve(process.cwd(), 'supabase/functions/welcome-fan-email/index.ts');
const VIDEO_CALL_PLANS_PATH = path.resolve(process.cwd(), '.video-call-plans.json');
const CREATOR_CONTACT_PATH = path.resolve(process.cwd(), '.creator-contact.json');
const CREATOR_ABOUT_PATH = path.resolve(process.cwd(), '.creator-about.json');
const CREATOR_MIMO_PATH = path.resolve(process.cwd(), '.creator-mimo-config.json');
const CREATOR_TESTIMONIALS_PATH = path.resolve(process.cwd(), '.creator-testimonials.json');

export interface VideoCallPlanConfig {
  id: string;
  title: string;
  duration_minutes: number;
  price_brl: number;
  description: string;
  active: boolean;
}

const DEFAULT_VIDEO_CALL_PLANS: VideoCallPlanConfig[] = [
  {
    id: 'vc-1',
    title: 'Chamada Express',
    duration_minutes: 5,
    price_brl: 20,
    description: 'Bate-papo ao vivo em vídeo privado 1 a 1 em alta definição.',
    active: true,
  },
  {
    id: 'vc-2',
    title: 'Chamada Privada',
    duration_minutes: 15,
    price_brl: 40,
    description: 'Momento exclusivo ao vivo com interação dedicada em tempo real.',
    active: true,
  },
  {
    id: 'vc-3',
    title: 'Chamada Especial',
    duration_minutes: 30,
    price_brl: 60,
    description: 'Sessão completa ao vivo sem pressa com atenção exclusiva.',
    active: true,
  },
  {
    id: 'vc-4',
    title: 'Sessão Estendida VIP',
    duration_minutes: 60,
    price_brl: 100,
    description: 'Uma hora inteira em vídeo chamada particular personalizada.',
    active: true,
  },
];

function sanitizeVideoCallPlans(input: unknown): VideoCallPlanConfig[] {
  const arr = Array.isArray(input) ? input : [];
  return DEFAULT_VIDEO_CALL_PLANS.map((fallback, idx) => {
    const item = (arr[idx] && typeof arr[idx] === 'object' ? arr[idx] : {}) as Record<string, unknown>;
    const durationNum = Number(item.duration_minutes);
    const priceNum = Number(item.price_brl);
    const cleanTitle = typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 60) : fallback.title;
    const cleanDesc =
      typeof item.description === 'string' && item.description.trim()
        ? item.description.trim().slice(0, 220)
        : fallback.description;
    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 24) : fallback.id,
      title: cleanTitle,
      duration_minutes: Number.isFinite(durationNum) && durationNum >= 1 ? Math.round(durationNum) : fallback.duration_minutes,
      price_brl: Number.isFinite(priceNum) && priceNum >= 1 ? Number(priceNum.toFixed(2)) : fallback.price_brl,
      description: cleanDesc,
      active: typeof item.active === 'boolean' ? item.active : fallback.active,
    };
  });
}

function readVideoCallPlansFallback(): VideoCallPlanConfig[] {
  try {
    if (fs.existsSync(VIDEO_CALL_PLANS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(VIDEO_CALL_PLANS_PATH, 'utf8'));
      return sanitizeVideoCallPlans(raw);
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_VIDEO_CALL_PLANS.map((p) => ({ ...p }));
}

function saveVideoCallPlansFallback(plans: VideoCallPlanConfig[]): void {
  fs.writeFileSync(VIDEO_CALL_PLANS_PATH, JSON.stringify(plans, null, 2) + '\n', 'utf8');
}

function resolveProfileVideoCallPlans(profileRow: Record<string, unknown> | null | undefined): VideoCallPlanConfig[] {
  if (profileRow && Array.isArray(profileRow.video_call_plans) && profileRow.video_call_plans.length > 0) {
    return sanitizeVideoCallPlans(profileRow.video_call_plans);
  }
  return readVideoCallPlansFallback();
}

function sanitizeWhatsappNumber(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 18);
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

function readWhatsappFallback(): string {
  try {
    if (fs.existsSync(CREATOR_CONTACT_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CREATOR_CONTACT_PATH, 'utf8'));
      return sanitizeWhatsappNumber(parsed?.whatsapp_number);
    }
  } catch {
    // ignore corrupt fallback
  }
  return '';
}

function saveWhatsappFallback(whatsappNumber: string): void {
  fs.writeFileSync(
    CREATOR_CONTACT_PATH,
    JSON.stringify({ whatsapp_number: sanitizeWhatsappNumber(whatsappNumber) }, null, 2) + '\n',
    'utf8'
  );
}

function resolveProfileWhatsapp(profileRow: Record<string, unknown> | null | undefined): string {
  if (profileRow && typeof profileRow.whatsapp_number === 'string' && profileRow.whatsapp_number.trim()) {
    return sanitizeWhatsappNumber(profileRow.whatsapp_number);
  }
  return readWhatsappFallback();
}

function readAboutSectionFallback(): CreatorAboutContent {
  try {
    if (fs.existsSync(CREATOR_ABOUT_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CREATOR_ABOUT_PATH, 'utf8'));
      return sanitizeCreatorAboutContent(parsed);
    }
  } catch {
    // ignore corrupt fallback
  }
  return sanitizeCreatorAboutContent(DEFAULT_CREATOR_ABOUT);
}

function saveAboutSectionFallback(about: CreatorAboutContent): void {
  fs.writeFileSync(CREATOR_ABOUT_PATH, JSON.stringify(about, null, 2) + '\n', 'utf8');
}

function resolveProfileAboutSection(profileRow: Record<string, unknown> | null | undefined): CreatorAboutContent {
  if (profileRow && profileRow.about_section && typeof profileRow.about_section === 'object') {
    return sanitizeCreatorAboutContent(profileRow.about_section);
  }
  return readAboutSectionFallback();
}

function readMimoConfigFallback(): MimoSectionConfig {
  try {
    if (fs.existsSync(CREATOR_MIMO_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CREATOR_MIMO_PATH, 'utf8'));
      return sanitizeMimoSectionConfig(parsed);
    }
  } catch {
    // ignore corrupt fallback
  }
  return sanitizeMimoSectionConfig(DEFAULT_MIMO_SECTION);
}

function saveMimoConfigFallback(mimoConfig: MimoSectionConfig): void {
  fs.writeFileSync(CREATOR_MIMO_PATH, JSON.stringify(mimoConfig, null, 2) + '\n', 'utf8');
}

function resolveProfileMimoConfig(profileRow: Record<string, unknown> | null | undefined): MimoSectionConfig {
  if (profileRow && profileRow.mimo_config && typeof profileRow.mimo_config === 'object') {
    return sanitizeMimoSectionConfig(profileRow.mimo_config);
  }
  return readMimoConfigFallback();
}

function readTestimonialsFallback(options?: { stripEmail?: boolean }): FanTestimonial[] {
  try {
    if (fs.existsSync(CREATOR_TESTIMONIALS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CREATOR_TESTIMONIALS_PATH, 'utf8'));
      return sanitizeTestimonials(parsed, options);
    }
  } catch {
    // ignore corrupt fallback
  }
  return sanitizeTestimonials(DEFAULT_FAN_TESTIMONIALS, options);
}

function saveTestimonialsFallback(testimonials: FanTestimonial[]): void {
  fs.writeFileSync(CREATOR_TESTIMONIALS_PATH, JSON.stringify(testimonials, null, 2) + '\n', 'utf8');
}

function resolveProfileTestimonials(
  profileRow: Record<string, unknown> | null | undefined,
  options?: { stripEmail?: boolean }
): FanTestimonial[] {
  if (profileRow && Array.isArray(profileRow.testimonials)) {
    return sanitizeTestimonials(profileRow.testimonials, options);
  }
  return readTestimonialsFallback(options);
}

function normalizeSaleRecord<T extends { sale_type: string; media_id?: string | null; external_ref?: string | null; amount_brl?: unknown }>(
  sale: T,
  mediaTitleMap: Map<string, string>
) {
  const ref = String(sale.external_ref || '');
  const vcMatch = /^VC-(\d+)MIN/i.exec(ref);
  const isVideoCall = sale.sale_type === 'video_call' || Boolean(vcMatch);
  return {
    ...sale,
    sale_type: isVideoCall ? 'video_call' : sale.sale_type,
    amount_brl: Number(sale.amount_brl || 0),
    media_title: isVideoCall
      ? vcMatch
        ? `Vídeo Chamada · ${vcMatch[1]} min`
        : 'Vídeo Chamada ao Vivo'
      : sale.media_id
      ? mediaTitleMap.get(sale.media_id) || 'Mídia removida'
      : null,
  };
}

async function enrichFanWithLoyalty(
  client: SupabaseClient,
  fanRow: Record<string, unknown>,
  mediaTitleMap?: Map<string, string>
) {
  const isVipActive =
    Boolean(fanRow.is_vip) &&
    (!fanRow.vip_expires_at || new Date(String(fanRow.vip_expires_at)).getTime() > Date.now());
  const fanEmail = String(fanRow.email || '').trim().toLowerCase();

  let paidSales: Array<{
    id: string;
    sale_type: string;
    media_id?: string | null;
    amount_brl: number | string;
    payment_method: string;
    status: string;
    external_ref?: string | null;
    created_at: string;
  }> = [];

  if (fanEmail) {
    const { data: salesData } = await client
      .from('sales')
      .select('id, sale_type, media_id, amount_brl, payment_method, status, external_ref, created_at')
      .eq('buyer_email', fanEmail)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });
    paidSales = salesData || [];
  }

  let resolvedTitleMap = mediaTitleMap;
  if (!resolvedTitleMap) {
    resolvedTitleMap = new Map<string, string>();
    const mediaIds = Array.from(
      new Set(
        paidSales
          .slice(0, 8)
          .map((s) => s.media_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (mediaIds.length > 0) {
      const { data: mediaRows } = await client
        .from('media_items')
        .select('id, title')
        .in('id', mediaIds);
      for (const m of mediaRows || []) {
        resolvedTitleMap.set(m.id, m.title);
      }
    }
  }

  const loyalty = computeFanLoyalty(paidSales);
  const recentOrders = paidSales.slice(0, 8).map((s) => {
    const norm = normalizeSaleRecord(s, resolvedTitleMap!);
    return {
      id: norm.id,
      sale_type: norm.sale_type,
      amount_brl: norm.amount_brl,
      payment_method: norm.payment_method,
      external_ref: norm.external_ref || null,
      media_title: norm.media_title,
      created_at: norm.created_at,
    };
  });

  return {
    ...fanRow,
    is_vip: isVipActive,
    loyalty,
    recent_orders: recentOrders,
  };
}

const DEFAULT_AVATAR_ASSET = '/public/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';
const DEFAULT_HERO_ASSET = '/public/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';
const FALLBACK_PHOTO_ASSET = '/public/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';
const FALLBACK_VIDEO_ASSET = '/src/assets/images/video_call_camera_hero_1794853603138.jpg';

const DEFAULT_CREATOR_PROFILE = {
  id: 'default-solo-creator',
  slug: 'solo',
  display_name: 'Valentina Noir',
  handle: '@valentinanoir',
  bio: 'Ensaios autorais, bastidores íntimos e vídeos exclusivos em 4K. Conteúdo estritamente para maiores de 18 anos.',
  location: 'Rio de Janeiro, Brasil',
  avatar_url: DEFAULT_AVATAR_ASSET,
  hero_url: DEFAULT_HERO_ASSET,
  vip_monthly_price_brl: 49.9,
  vip_description:
    'Acesso ilimitado a todos os ensaios e vídeos marcados como VIP, atualizações semanais e prioridade em pedidos.',
  pix_key: '',
  whatsapp_number: '',
  video_call_plans: DEFAULT_VIDEO_CALL_PLANS,
  about_section: DEFAULT_CREATOR_ABOUT,
  mimo_config: DEFAULT_MIMO_SECTION,
  testimonials: DEFAULT_FAN_TESTIMONIALS,
  age_verified_18: true,
  updated_at: new Date().toISOString(),
};

interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  adminEmail: string;
  adminPasswordHash: string;
  authSecret: string;
  resendApiKey: string;
  resendFromEmail: string;
}

const runtimeConfig: RuntimeConfig = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  adminEmail: (process.env.CREATOR_ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPasswordHash: (process.env.CREATOR_ADMIN_HASH || '').trim(),
  authSecret:
    process.env.CREATOR_AUTH_SECRET ||
    crypto
      .createHash('sha256')
      .update(process.cwd() + (process.env.SUPABASE_SERVICE_ROLE_KEY || 'maison-prive-session-secret'))
      .digest('hex'),
  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
  resendFromEmail: (process.env.RESEND_FROM_EMAIL || 'Maison Privé <onboarding@resend.dev>').trim(),
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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function issueCreatorToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', runtimeConfig.authSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyCreatorToken(token: string): { email: string } | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', runtimeConfig.authSecret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.email || !parsed?.exp || Date.now() > Number(parsed.exp)) {
      return null;
    }
    return { email: String(parsed.email) };
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
}

function requireCreatorAuth(req: Request, res: Response, next: NextFunction) {
  const tokenHeader = (req.headers['x-creator-token'] as string) || '';
  const session = verifyCreatorToken(tokenHeader);
  if (!session) {
    res.status(401).json({ error: 'Sessão de administradora inválida ou expirada. Faça login novamente.' });
    return;
  }
  next();
}

function getMediaCipherKey(): Buffer {
  return crypto.createHash('sha256').update(`mp-media-key::${runtimeConfig.authSecret}`).digest();
}

interface MediaTicketPayload {
  kind: 'media' | 'preview' | 'local' | 'remote';
  target: string;
  mime?: string | null;
  exp: number;
}

function issueMediaTicket(
  kind: MediaTicketPayload['kind'],
  target: string,
  mime?: string | null
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMediaCipherKey(), iv);
  const payload = JSON.stringify({
    kind,
    target,
    mime: mime || undefined,
    exp: Date.now() + 4 * 60 * 60 * 1000,
  });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

function verifyMediaTicket(ticket: string): MediaTicketPayload | null {
  if (!ticket || typeof ticket !== 'string') return null;
  const parts = ticket.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const encrypted = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getMediaCipherKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as MediaTicketPayload;
    if (!parsed?.target || !parsed?.exp || Date.now() > Number(parsed.exp)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function shortSourceTag(value: string): string {
  return crypto.createHash('sha256').update(value || 'default').digest('hex').slice(0, 12);
}

function maskProfileForClient<T extends { avatar_url?: string | null; hero_url?: string | null }>(profile: T): T {
  const rawAvatar = profile.avatar_url || DEFAULT_AVATAR_ASSET;
  const rawHero = profile.hero_url || DEFAULT_HERO_ASSET;
  return {
    ...profile,
    avatar_url: `/api/profile/asset/avatar?v=${shortSourceTag(rawAvatar)}`,
    hero_url: `/api/profile/asset/hero?v=${shortSourceTag(rawHero)}`,
  };
}

function buildMaskedMediaUrls(item: {
  media_type: string;
  storage_path: string;
  preview_url?: string | null;
  mime_type?: string | null;
}, isUnlocked: boolean): { mediaUrl: string | null; previewUrl: string | null } {
  const rawStorage = String(item.storage_path || '').trim();
  const rawPreview = item.preview_url ? String(item.preview_url).trim() : '';

  let maskedMediaUrl: string | null = null;
  if (isUnlocked && rawStorage) {
    const mediaKind: MediaTicketPayload['kind'] = rawStorage.startsWith('/')
      ? 'local'
      : rawStorage.startsWith('http://') || rawStorage.startsWith('https://')
      ? 'remote'
      : 'media';
    const ticket = issueMediaTicket(mediaKind, rawStorage, item.mime_type);
    maskedMediaUrl = `/api/media/stream/${ticket}`;
  }

  let maskedPreviewUrl: string | null = null;
  if (rawPreview) {
    const previewKind: MediaTicketPayload['kind'] = rawPreview.startsWith('/')
      ? 'local'
      : rawPreview.startsWith('http://') || rawPreview.startsWith('https://')
      ? 'remote'
      : 'preview';
    const pTicket = issueMediaTicket(previewKind, rawPreview);
    maskedPreviewUrl = `/api/media/preview/${pTicket}`;
  } else if (isUnlocked && item.media_type === 'photo' && rawStorage) {
    const mediaKind: MediaTicketPayload['kind'] = rawStorage.startsWith('/')
      ? 'local'
      : rawStorage.startsWith('http://') || rawStorage.startsWith('https://')
      ? 'remote'
      : 'media';
    const pTicket = issueMediaTicket(mediaKind, rawStorage, item.mime_type);
    maskedPreviewUrl = `/api/media/preview/${pTicket}`;
  } else {
    maskedPreviewUrl =
      item.media_type === 'video' ? '/api/media/fallback/video' : '/api/media/fallback/photo';
  }

  return { mediaUrl: maskedMediaUrl, previewUrl: maskedPreviewUrl };
}

function inferContentTypeFromPath(filePath: string, fallback = 'application/octet-stream'): string {
  const lower = filePath.toLowerCase();
  if (/\.(jpe?g|jfif)$/i.test(lower)) return 'image/jpeg';
  if (/\.png$/i.test(lower)) return 'image/png';
  if (/\.webp$/i.test(lower)) return 'image/webp';
  if (/\.gif$/i.test(lower)) return 'image/gif';
  if (/\.avif$/i.test(lower)) return 'image/avif';
  if (/\.(mp4|m4v)$/i.test(lower)) return 'video/mp4';
  if (/\.webm$/i.test(lower)) return 'video/webm';
  if (/\.mov$/i.test(lower)) return 'video/quicktime';
  return fallback;
}

function streamLocalFile(req: Request, res: Response, assetPath: string, mimeHint?: string | null) {
  const cleanRel = assetPath.replace(/^\/+/, '');
  const rootDir = path.resolve(process.cwd());
  const fullPath = path.resolve(rootDir, cleanRel);
  if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath)) {
    res.status(404).end();
    return;
  }
  const stat = fs.statSync(fullPath);
  const contentType = mimeHint || inferContentTypeFromPath(fullPath, 'image/jpeg');
  const range = req.headers.range;

  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start < stat.size && start <= end) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(fullPath, { start, end }).pipe(res);
        return;
      }
    }
  }

  res.status(200);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(stat.size));
  fs.createReadStream(fullPath).pipe(res);
}

function isSafeExternalMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^127\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function streamRemoteUrl(
  req: Request,
  res: Response,
  url: string,
  mimeHint?: string | null
) {
  if (!isSafeExternalMediaUrl(url)) {
    res.status(400).end();
    return;
  }
  const headers: Record<string, string> = {};
  if (req.headers.range) {
    headers.Range = String(req.headers.range);
  }
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, { headers, redirect: 'follow' });
  } catch {
    res.status(502).end();
    return;
  }
  if (!upstream.ok && upstream.status !== 206) {
    res.status(upstream.status === 404 ? 404 : 502).end();
    return;
  }

  res.status(upstream.status);
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
  for (const h of passthroughHeaders) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.headers.get('content-type') && mimeHint) {
    res.setHeader('Content-Type', mimeHint);
  }

  if (!upstream.body) {
    const ab = await upstream.arrayBuffer();
    res.send(Buffer.from(ab));
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!res.write(Buffer.from(value))) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    }
  } finally {
    res.end();
  }
}

function readEdgeFunctionCode(): string {
  if (fs.existsSync(EDGE_WELCOME_FN_PATH)) {
    return fs.readFileSync(EDGE_WELCOME_FN_PATH, 'utf8');
  }
  return '';
}

function buildWelcomeMigrationSql(): string {
  return `-- Migração Automática: E-mail de Boas-Vindas via Edge Function
alter table public.fans
  add column if not exists welcome_email_sent_at timestamptz;

create table if not exists public.welcome_email_logs (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid references public.fans(id) on delete set null,
  fan_email text not null,
  trigger_source text not null check (trigger_source in ('signup', 'first_purchase', 'manual_test')),
  provider text not null default 'supabase_edge',
  status text not null check (status in ('sent', 'skipped', 'pending_config', 'failed')),
  edge_response text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_welcome_email_logs_email_created
  on public.welcome_email_logs (fan_email, created_at desc);

alter table public.welcome_email_logs enable row level security;`;
}

async function logWelcomeEmailSafe(
  client: SupabaseClient,
  entry: {
    fan_id?: string | null;
    fan_email: string;
    trigger_source: 'signup' | 'first_purchase' | 'manual_test';
    provider: string;
    status: 'sent' | 'skipped' | 'pending_config' | 'failed';
    edge_response?: string | null;
    error_message?: string | null;
  }
) {
  try {
    await client.from('welcome_email_logs').insert({
      fan_id: entry.fan_id || null,
      fan_email: entry.fan_email,
      trigger_source: entry.trigger_source,
      provider: entry.provider,
      status: entry.status,
      edge_response: entry.edge_response ? entry.edge_response.slice(0, 500) : null,
      error_message: entry.error_message ? entry.error_message.slice(0, 500) : null,
    });
  } catch {
    // Table may not be migrated yet in older Supabase instances
  }
}

async function orchestrateFanWelcomeEmail(
  client: SupabaseClient,
  params: {
    fanId?: string | null;
    email: string;
    displayName?: string | null;
    triggerSource: 'signup' | 'first_purchase' | 'manual_test';
    saleType?: 'vip_subscription' | 'ppv' | 'tip' | 'video_call';
    amountBrl?: number;
    siteUrl?: string;
    forceTest?: boolean;
  }
): Promise<{ ok: boolean; status: string; provider: string; error?: string | null }> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, status: 'failed', provider: 'none', error: 'E-mail inválido' };
  }

  try {
    // Check idempotency if not a manual test
    if (!params.forceTest) {
      const { data: fanRow } = await client
        .from('fans')
        .select('id, welcome_email_sent_at')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (fanRow && 'welcome_email_sent_at' in fanRow && fanRow.welcome_email_sent_at) {
        return { ok: true, status: 'skipped', provider: 'idempotent' };
      }

      try {
        const { data: prevLogs } = await client
          .from('welcome_email_logs')
          .select('id, status')
          .eq('fan_email', cleanEmail)
          .eq('status', 'sent')
          .limit(1);
        if (prevLogs && prevLogs.length > 0) {
          return { ok: true, status: 'skipped', provider: 'idempotent' };
        }
      } catch {
        // welcome_email_logs table might not exist yet
      }
    }

    const { data: prof } = await client
      .from('creator_profile')
      .select('display_name')
      .eq('slug', 'solo')
      .maybeSingle();
    const creatorName = prof?.display_name || DEFAULT_CREATOR_PROFILE.display_name;

    const edgeUrl = runtimeConfig.supabaseUrl
      ? `${runtimeConfig.supabaseUrl.replace(/\/+$/, '')}/functions/v1/welcome-fan-email`
      : '';

    if (edgeUrl && runtimeConfig.supabaseServiceRoleKey) {
      try {
        const edgeResp = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${runtimeConfig.supabaseServiceRoleKey}`,
            apikey: runtimeConfig.supabaseAnonKey || runtimeConfig.supabaseServiceRoleKey,
          },
          body: JSON.stringify({
            fanId: params.fanId || undefined,
            email: cleanEmail,
            displayName: params.displayName || undefined,
            triggerSource: params.triggerSource,
            saleType: params.saleType,
            amountBrl: params.amountBrl,
            creatorName,
            siteUrl: params.siteUrl,
            forceTest: Boolean(params.forceTest),
          }),
        });

        const rawText = await edgeResp.text();
        let parsed: { ok?: boolean; status?: string; provider?: string; error?: string; skipped?: boolean } = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // non-JSON error from Edge gateway
        }

        if (edgeResp.ok) {
          return {
            ok: true,
            status: parsed.skipped ? 'skipped' : parsed.status || 'sent',
            provider: parsed.provider || 'supabase_edge',
            error: parsed.error || null,
          };
        }

        // If Edge Function is deployed and returned a real failure, propagate its status
        if (edgeResp.status !== 404) {
          await logWelcomeEmailSafe(client, {
            fan_id: params.fanId,
            fan_email: cleanEmail,
            trigger_source: params.triggerSource,
            provider: 'supabase_edge',
            status: 'failed',
            edge_response: rawText,
            error_message: parsed.error || `Edge HTTP ${edgeResp.status}`,
          });
          return {
            ok: false,
            status: 'failed',
            provider: 'supabase_edge',
            error: parsed.error || `Edge HTTP ${edgeResp.status}`,
          };
        }
      } catch (edgeErr) {
        // Network error calling Edge Function - fall through cleanly to fallback check
        const errMsg = edgeErr instanceof Error ? edgeErr.message : 'Erro de rede na Edge Function';
        if (!runtimeConfig.resendApiKey) {
          await logWelcomeEmailSafe(client, {
            fan_id: params.fanId,
            fan_email: cleanEmail,
            trigger_source: params.triggerSource,
            provider: 'supabase_edge',
            status: 'failed',
            error_message: errMsg,
          });
          return { ok: false, status: 'failed', provider: 'supabase_edge', error: errMsg };
        }
      }
    }

    // Fallback: Edge Function not yet deployed in Supabase (404)
    if (runtimeConfig.resendApiKey) {
      const fanName = params.displayName || cleanEmail.split('@')[0];
      const isPurchase = params.triggerSource === 'first_purchase';
      const subject = isPurchase
        ? `Bem-vindo(a) ao acervo privado de ${creatorName}`
        : `Seu acesso em ${creatorName} está ativo`;
      const html = `<div style="background:#09090b;color:#f4f4f5;padding:32px;font-family:sans-serif;"><h2 style="color:#d4af37;">${creatorName}</h2><p>Olá, ${fanName}!</p><p>${
        isPurchase
          ? 'Obrigado pela sua primeira compra! Seu acesso já está liberado na vitrine.'
          : 'Seu cadastro +18 foi concluído com sucesso! Você já pode explorar prévias e conteúdos VIP.'
      }</p></div>`;

      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${runtimeConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: runtimeConfig.resendFromEmail,
          to: [cleanEmail],
          subject,
          html,
        }),
      });
      const resendText = await resendResp.text();
      if (resendResp.ok) {
        if (!params.forceTest) {
          await client
            .from('fans')
            .update({ welcome_email_sent_at: new Date().toISOString() })
            .eq('email', cleanEmail)
            .then(() => {}, () => {});
        }
        await logWelcomeEmailSafe(client, {
          fan_id: params.fanId,
          fan_email: cleanEmail,
          trigger_source: params.triggerSource,
          provider: 'resend_fallback',
          status: 'sent',
          edge_response: resendText,
        });
        return { ok: true, status: 'sent', provider: 'resend_fallback' };
      }
      await logWelcomeEmailSafe(client, {
        fan_id: params.fanId,
        fan_email: cleanEmail,
        trigger_source: params.triggerSource,
        provider: 'resend_fallback',
        status: 'failed',
        edge_response: resendText,
        error_message: `Resend HTTP ${resendResp.status}`,
      });
      return { ok: false, status: 'failed', provider: 'resend_fallback', error: resendText };
    }

    const pendingErr =
      'Edge Function welcome-fan-email aguardando deploy no Supabase ou configuração de RESEND_API_KEY.';
    await logWelcomeEmailSafe(client, {
      fan_id: params.fanId,
      fan_email: cleanEmail,
      trigger_source: params.triggerSource,
      provider: 'supabase_edge',
      status: 'pending_config',
      error_message: pendingErr,
    });
    return { ok: false, status: 'pending_config', provider: 'supabase_edge', error: pendingErr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao orquestrar boas-vindas';
    return { ok: false, status: 'failed', provider: 'supabase_edge', error: msg };
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // --- OPAQUE PROTECTED MEDIA & ASSET STREAMING (ZERO URL LEAKAGE) ---

  app.get('/api/profile/asset/:kind', async (req: Request, res: Response) => {
    try {
      const kind = req.params.kind === 'hero' ? 'hero' : req.params.kind === 'avatar' ? 'avatar' : null;
      if (!kind) {
        res.status(404).end();
        return;
      }

      const defaultAsset = kind === 'hero' ? DEFAULT_HERO_ASSET : DEFAULT_AVATAR_ASSET;
      let target = defaultAsset;

      const client = getAdminClient();
      if (client) {
        const col = kind === 'hero' ? 'hero_url' : 'avatar_url';
        const { data } = await client
          .from('creator_profile')
          .select(col)
          .eq('slug', 'solo')
          .maybeSingle();
        const candidate = data ? String((data as Record<string, unknown>)[col] || '').trim() : '';
        if (candidate && !candidate.startsWith('/api/profile/asset/')) {
          target = candidate;
        }
      }

      if (target.startsWith('/')) {
        streamLocalFile(req, res, target);
        return;
      }

      if (target.startsWith('http://') || target.startsWith('https://')) {
        await streamRemoteUrl(req, res, target);
        return;
      }

      if (client) {
        const { data } = await client.storage.from('creator-previews').createSignedUrl(target, 60);
        if (data?.signedUrl) {
          await streamRemoteUrl(req, res, data.signedUrl);
          return;
        }
      }

      streamLocalFile(req, res, defaultAsset);
    } catch {
      res.status(404).end();
    }
  });

  app.get('/api/media/fallback/:kind', (req: Request, res: Response) => {
    const fallback = req.params.kind === 'video' ? FALLBACK_VIDEO_ASSET : FALLBACK_PHOTO_ASSET;
    streamLocalFile(req, res, fallback, 'image/jpeg');
  });

  app.get('/api/media/stream/:ticket', async (req: Request, res: Response) => {
    try {
      const payload = verifyMediaTicket(String(req.params.ticket || ''));
      if (!payload) {
        res.status(403).end();
        return;
      }

      if (payload.kind === 'local' || payload.target.startsWith('/')) {
        streamLocalFile(req, res, payload.target, payload.mime);
        return;
      }

      if (payload.kind === 'remote' || payload.target.startsWith('http://') || payload.target.startsWith('https://')) {
        await streamRemoteUrl(req, res, payload.target, payload.mime);
        return;
      }

      const client = getAdminClient();
      if (!client) {
        res.status(503).end();
        return;
      }

      const bucket = payload.kind === 'preview' ? 'creator-previews' : 'creator-media';
      const { data, error } = await client.storage.from(bucket).createSignedUrl(payload.target, 60);
      if (error || !data?.signedUrl) {
        res.status(404).end();
        return;
      }

      await streamRemoteUrl(req, res, data.signedUrl, payload.mime);
    } catch {
      res.status(500).end();
    }
  });

  app.get('/api/media/preview/:ticket', async (req: Request, res: Response) => {
    try {
      const payload = verifyMediaTicket(String(req.params.ticket || ''));
      if (!payload) {
        res.status(403).end();
        return;
      }

      if (payload.kind === 'local' || payload.target.startsWith('/')) {
        streamLocalFile(req, res, payload.target, payload.mime);
        return;
      }

      if (payload.kind === 'remote' || payload.target.startsWith('http://') || payload.target.startsWith('https://')) {
        await streamRemoteUrl(req, res, payload.target, payload.mime);
        return;
      }

      const client = getAdminClient();
      if (!client) {
        res.status(503).end();
        return;
      }

      const bucket = payload.kind === 'preview' ? 'creator-previews' : 'creator-media';
      const { data, error } = await client.storage.from(bucket).createSignedUrl(payload.target, 60);
      if (error || !data?.signedUrl) {
        res.status(404).end();
        return;
      }

      await streamRemoteUrl(req, res, data.signedUrl, payload.mime);
    } catch {
      res.status(500).end();
    }
  });

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

  // --- CREATOR ADMIN AUTH (Email/Senha & Gmail OAuth) ---

  const oauthBridgeStore = new Map<string, { token: string; email: string; expiresAt: number }>();

  async function resolveAuthorizedAdminEmail(): Promise<string> {
    if (runtimeConfig.adminEmail) return runtimeConfig.adminEmail.toLowerCase();
    const adminClient = getAdminClient();
    if (!adminClient) return '';
    try {
      const { data } = await adminClient
        .from('creator_profile')
        .select('admin_email')
        .eq('slug', 'solo')
        .maybeSingle();
      if (data?.admin_email) {
        runtimeConfig.adminEmail = String(data.admin_email).trim().toLowerCase();
        return runtimeConfig.adminEmail;
      }
    } catch {
      // column might not exist on older schema
    }
    return '';
  }

  async function hasSupabaseEmailPasswordUser(
    email: string
  ): Promise<{ exists: boolean; userId?: string; hasEmailIdentity: boolean; hasSignedInBefore: boolean }> {
    const adminClient = getAdminClient();
    if (!adminClient || !email) {
      return { exists: false, hasEmailIdentity: false, hasSignedInBefore: false };
    }
    try {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error || !data?.users) {
        return { exists: false, hasEmailIdentity: false, hasSignedInBefore: false };
      }
      const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!match) {
        return { exists: false, hasEmailIdentity: false, hasSignedInBefore: false };
      }
      const hasEmailIdentity = Boolean(
        match.identities?.some((id) => id.provider === 'email') ||
          match.app_metadata?.provider === 'email' ||
          (Array.isArray(match.app_metadata?.providers) && match.app_metadata.providers.includes('email'))
      );
      return {
        exists: true,
        userId: match.id,
        hasEmailIdentity,
        hasSignedInBefore: Boolean(match.last_sign_in_at),
      };
    } catch {
      return { exists: false, hasEmailIdentity: false, hasSignedInBefore: false };
    }
  }

  async function isGoogleProviderEnabledInSupabase(): Promise<boolean> {
    if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) return false;
    try {
      const resp = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: runtimeConfig.supabaseAnonKey },
      });
      if (!resp.ok) return false;
      const settings = await resp.json();
      return Boolean(settings?.external?.google);
    } catch {
      return false;
    }
  }

  app.get('/api/creator/auth-config', async (_req: Request, res: Response) => {
    const adminEmail = await resolveAuthorizedAdminEmail();
    const needsSetup = !adminEmail && !runtimeConfig.adminPasswordHash;

    let hasPassword = Boolean(runtimeConfig.adminPasswordHash);
    if (!hasPassword && adminEmail) {
      const sbUser = await hasSupabaseEmailPasswordUser(adminEmail);
      hasPassword = sbUser.exists && sbUser.hasEmailIdentity && sbUser.hasSignedInBefore;
    }

    const googleProviderEnabled = await isGoogleProviderEnabledInSupabase();
    const supabaseProjectRef = runtimeConfig.supabaseUrl ? extractProjectRef(runtimeConfig.supabaseUrl) : null;

    res.json({
      needsSetup,
      needsPasswordSetup: Boolean(adminEmail && !hasPassword),
      adminEmailHint: adminEmail ? maskEmail(adminEmail) : null,
      adminEmail: adminEmail && !hasPassword ? adminEmail : null,
      supabaseUrl: runtimeConfig.supabaseUrl || null,
      supabaseAnonKey: runtimeConfig.supabaseAnonKey || null,
      supabaseProjectRef,
      googleOAuthReady: Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey),
      googleProviderEnabled,
    });
  });

  app.post('/api/creator/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const rawPassword = String(password || '');

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
      }
      if (rawPassword.length < 6) {
        res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
        return;
      }

      const existingAdminEmail = await resolveAuthorizedAdminEmail();
      const adminClient = getAdminClient();

      if (existingAdminEmail && cleanEmail !== existingAdminEmail.toLowerCase()) {
        res.status(401).json({
          error: `Este e-mail não corresponde à conta administradora cadastrada (${maskEmail(existingAdminEmail)}).`,
        });
        return;
      }

      let hasPassword = Boolean(runtimeConfig.adminPasswordHash);
      let existingSbUser: {
        exists: boolean;
        userId?: string;
        hasEmailIdentity: boolean;
        hasSignedInBefore: boolean;
      } = {
        exists: false,
        hasEmailIdentity: false,
        hasSignedInBefore: false,
      };
      if (adminClient) {
        existingSbUser = await hasSupabaseEmailPasswordUser(cleanEmail);
        if (!hasPassword) {
          hasPassword =
            existingSbUser.exists &&
            existingSbUser.hasEmailIdentity &&
            existingSbUser.hasSignedInBefore;
        }
      }

      const shouldCreateOrSetInitialPassword = !existingAdminEmail || !hasPassword;

      if (shouldCreateOrSetInitialPassword) {
        const newHash = hashPassword(rawPassword);
        runtimeConfig.adminEmail = cleanEmail;
        runtimeConfig.adminPasswordHash = newHash;
        saveEnvLocal({
          CREATOR_ADMIN_EMAIL: cleanEmail,
          CREATOR_ADMIN_HASH: newHash,
          CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
        });

        if (adminClient) {
          if (existingSbUser.exists && existingSbUser.userId) {
            await adminClient.auth.admin
              .updateUserById(existingSbUser.userId, {
                password: rawPassword,
                email_confirm: true,
              })
              .catch(() => {});
          } else {
            await adminClient.auth.admin
              .createUser({
                email: cleanEmail,
                password: rawPassword,
                email_confirm: true,
                user_metadata: { role: 'creator_admin' },
              })
              .catch(() => {});
          }
          await adminClient
            .from('creator_profile')
            .update({ admin_email: cleanEmail })
            .eq('slug', 'solo')
            .then(() => {}, () => {});
        }

        const token = issueCreatorToken(cleanEmail);
        res.json({ ok: true, token, email: cleanEmail, createdAccount: true });
        return;
      }

      let authenticated = false;
      let lastAuthError = '';
      if (runtimeConfig.adminPasswordHash && verifyPassword(rawPassword, runtimeConfig.adminPasswordHash)) {
        authenticated = true;
        if (adminClient) {
          if (existingSbUser.exists && existingSbUser.userId) {
            await adminClient.auth.admin
              .updateUserById(existingSbUser.userId, {
                password: rawPassword,
                email_confirm: true,
              })
              .catch(() => {});
          } else {
            await adminClient.auth.admin
              .createUser({
                email: cleanEmail,
                password: rawPassword,
                email_confirm: true,
                user_metadata: { role: 'creator_admin' },
              })
              .catch(() => {});
          }
        }
      } else if (runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey) {
        const authClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        let signInRes = await authClient.auth.signInWithPassword({
          email: cleanEmail,
          password: rawPassword,
        });

        // If the admin account in Supabase exists but wasn't confirmed yet, confirm it and retry once
        if (
          signInRes.error &&
          signInRes.error.message.toLowerCase().includes('not confirmed') &&
          adminClient &&
          existingSbUser.exists &&
          existingSbUser.userId
        ) {
          await adminClient.auth.admin
            .updateUserById(existingSbUser.userId, { email_confirm: true })
            .catch(() => {});
          signInRes = await authClient.auth.signInWithPassword({
            email: cleanEmail,
            password: rawPassword,
          });
        }

        if (!signInRes.error && signInRes.data?.user?.email?.toLowerCase() === cleanEmail) {
          authenticated = true;
          const newHash = hashPassword(rawPassword);
          runtimeConfig.adminPasswordHash = newHash;
          saveEnvLocal({
            CREATOR_ADMIN_EMAIL: cleanEmail,
            CREATOR_ADMIN_HASH: newHash,
            CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
          });
        } else if (signInRes.error) {
          lastAuthError = signInRes.error.message;
        }
      }

      if (!authenticated) {
        const isInvalidCreds =
          !lastAuthError ||
          lastAuthError.toLowerCase().includes('invalid login credentials') ||
          lastAuthError.toLowerCase().includes('invalid_credentials');
        res.status(401).json({
          error: isInvalidCreds
            ? 'Senha incorreta para esta conta. Se não lembrar a senha, use "Esqueci a senha" abaixo.'
            : `Falha na autenticação Supabase: ${lastAuthError}`,
        });
        return;
      }

      const token = issueCreatorToken(cleanEmail);
      res.json({ ok: true, token, email: cleanEmail });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao fazer login.' });
    }
  });

  app.post('/api/creator/send-otp', async (req: Request, res: Response) => {
    try {
      const { email, redirectTo } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail Gmail válido.' });
        return;
      }
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        res.status(503).json({ error: 'Conecte o Supabase antes de enviar o código por e-mail.' });
        return;
      }

      const existingAdminEmail = await resolveAuthorizedAdminEmail();
      if (existingAdminEmail && cleanEmail !== existingAdminEmail.toLowerCase()) {
        res.status(403).json({
          error: `Este e-mail não corresponde à conta administradora (${maskEmail(existingAdminEmail)}).`,
        });
        return;
      }

      const authClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await authClient.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof redirectTo === 'string' && redirectTo ? redirectTo : undefined,
        },
      });

      if (error) {
        const isRateLimit = error.message.toLowerCase().includes('rate limit');
        res.status(isRateLimit ? 429 : 400).json({
          rateLimited: isRateLimit,
          error: isRateLimit
            ? 'O envio gratuito de e-mails do Supabase atingiu o limite temporário (2 e-mails/hora). Use a opção "Redefinir com a Service Role Key do Supabase" logo abaixo para definir uma senha e entrar na hora.'
            : `Erro ao enviar e-mail via Supabase: ${error.message}`,
        });
        return;
      }

      res.json({ ok: true, email: cleanEmail });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao enviar código para o Gmail.' });
    }
  });

  app.post('/api/creator/reset-with-service-key', async (req: Request, res: Response) => {
    try {
      const { email, serviceRoleKey, newPassword } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const providedKey = String(serviceRoleKey || '').trim();
      const rawNewPass = String(newPassword || '');

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe o e-mail da administradora.' });
        return;
      }
      if (!providedKey) {
        res.status(400).json({ error: 'Informe a Service Role Key do seu projeto Supabase.' });
        return;
      }
      if (rawNewPass.length < 6) {
        res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        return;
      }
      if (!runtimeConfig.supabaseServiceRoleKey) {
        res.status(503).json({ error: 'Service Role Key não configurada no servidor.' });
        return;
      }

      const expectedBuf = Buffer.from(runtimeConfig.supabaseServiceRoleKey.trim(), 'utf8');
      const providedBuf = Buffer.from(providedKey, 'utf8');
      if (
        expectedBuf.length !== providedBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, providedBuf)
      ) {
        res.status(401).json({ error: 'Service Role Key inválida para este projeto Supabase.' });
        return;
      }

      const existingAdminEmail = await resolveAuthorizedAdminEmail();
      if (existingAdminEmail && cleanEmail !== existingAdminEmail.toLowerCase()) {
        res.status(403).json({
          error: `Este e-mail não corresponde à conta administradora (${maskEmail(existingAdminEmail)}).`,
        });
        return;
      }

      const newHash = hashPassword(rawNewPass);
      runtimeConfig.adminEmail = cleanEmail;
      runtimeConfig.adminPasswordHash = newHash;
      saveEnvLocal({
        CREATOR_ADMIN_EMAIL: cleanEmail,
        CREATOR_ADMIN_HASH: newHash,
        CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
      });

      const adminClient = getAdminClient();
      if (adminClient) {
        const sbUser = await hasSupabaseEmailPasswordUser(cleanEmail);
        if (sbUser.exists && sbUser.userId) {
          await adminClient.auth.admin
            .updateUserById(sbUser.userId, {
              password: rawNewPass,
              email_confirm: true,
            })
            .catch(() => {});
        } else {
          await adminClient.auth.admin
            .createUser({
              email: cleanEmail,
              password: rawNewPass,
              email_confirm: true,
              user_metadata: { role: 'creator_admin' },
            })
            .catch(() => {});
        }
        await adminClient
          .from('creator_profile')
          .update({ admin_email: cleanEmail })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      const token = issueCreatorToken(cleanEmail);
      res.json({ ok: true, token, email: cleanEmail });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao redefinir senha.' });
    }
  });

  app.post('/api/creator/verify-otp', async (req: Request, res: Response) => {
    try {
      const { email, code, newPassword, bridgeId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(code || '').trim();
      const cleanNewPass = typeof newPassword === 'string' ? newPassword : '';

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
      }
      if (!cleanCode || cleanCode.length < 6) {
        res.status(400).json({ error: 'Digite o código de verificação recebido no seu Gmail.' });
        return;
      }
      if (cleanNewPass && cleanNewPass.length < 6) {
        res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        return;
      }
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        res.status(503).json({ error: 'Supabase não configurado.' });
        return;
      }

      const existingAdminEmail = await resolveAuthorizedAdminEmail();
      if (existingAdminEmail && cleanEmail !== existingAdminEmail.toLowerCase()) {
        res.status(403).json({
          error: `Este e-mail não corresponde à conta administradora (${maskEmail(existingAdminEmail)}).`,
        });
        return;
      }

      const authClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      let verifiedUserEmail = '';
      let verifiedUserId = '';
      let lastVerifyErr = '';

      for (const otpType of ['email', 'magiclink', 'recovery'] as const) {
        const { data, error } = await authClient.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: otpType,
        });
        if (!error && data?.user?.email) {
          verifiedUserEmail = data.user.email.trim().toLowerCase();
          verifiedUserId = data.user.id;
          break;
        }
        if (error) {
          lastVerifyErr = error.message;
        }
      }

      if (!verifiedUserEmail || verifiedUserEmail !== cleanEmail) {
        res.status(401).json({
          error: lastVerifyErr
            ? `Código inválido ou expirado (${lastVerifyErr}). Solicite um novo código.`
            : 'Código inválido ou expirado. Solicite um novo código.',
        });
        return;
      }

      const adminClient = getAdminClient();
      if (!existingAdminEmail) {
        runtimeConfig.adminEmail = cleanEmail;
        saveEnvLocal({
          CREATOR_ADMIN_EMAIL: cleanEmail,
          CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
        });
        if (adminClient) {
          await adminClient
            .from('creator_profile')
            .update({ admin_email: cleanEmail })
            .eq('slug', 'solo')
            .then(() => {}, () => {});
        }
      }

      if (cleanNewPass.length >= 6) {
        const newHash = hashPassword(cleanNewPass);
        runtimeConfig.adminPasswordHash = newHash;
        runtimeConfig.adminEmail = cleanEmail;
        saveEnvLocal({
          CREATOR_ADMIN_EMAIL: cleanEmail,
          CREATOR_ADMIN_HASH: newHash,
          CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
        });
        if (adminClient && verifiedUserId) {
          await adminClient.auth.admin
            .updateUserById(verifiedUserId, {
              password: cleanNewPass,
              email_confirm: true,
            })
            .catch(() => {});
        }
      }

      const token = issueCreatorToken(cleanEmail);
      if (bridgeId && typeof bridgeId === 'string') {
        oauthBridgeStore.set(bridgeId, {
          token,
          email: cleanEmail,
          expiresAt: Date.now() + 120000,
        });
      }
      res.json({ ok: true, token, email: cleanEmail });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao validar código.' });
    }
  });

  app.post('/api/creator/oauth-session', async (req: Request, res: Response) => {
    try {
      const { accessToken, bridgeId } = req.body || {};
      if (!accessToken) {
        res.status(400).json({ error: 'Token OAuth ausente.' });
        return;
      }
      const adminClient = getAdminClient();
      if (!adminClient) {
        res.status(503).json({ error: 'Conecte o Supabase antes de autenticar via Gmail.' });
        return;
      }

      const { data, error } = await adminClient.auth.getUser(String(accessToken));
      if (error || !data?.user?.email) {
        res.status(401).json({ error: 'Sessão Google/Supabase inválida ou expirada.' });
        return;
      }

      const googleEmail = data.user.email.trim().toLowerCase();
      const existingAdminEmail = await resolveAuthorizedAdminEmail();

      if (!existingAdminEmail) {
        runtimeConfig.adminEmail = googleEmail;
        saveEnvLocal({
          CREATOR_ADMIN_EMAIL: googleEmail,
          CREATOR_AUTH_SECRET: runtimeConfig.authSecret,
        });
        await adminClient
          .from('creator_profile')
          .update({ admin_email: googleEmail })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      } else if (googleEmail !== existingAdminEmail.toLowerCase()) {
        res.status(403).json({
          error: `A conta ${googleEmail} não tem permissão de administradora. Use ${maskEmail(existingAdminEmail)}.`,
        });
        return;
      }

      const token = issueCreatorToken(googleEmail);
      if (bridgeId && typeof bridgeId === 'string') {
        oauthBridgeStore.set(bridgeId, {
          token,
          email: googleEmail,
          expiresAt: Date.now() + 120000,
        });
      }
      res.json({ ok: true, token, email: googleEmail });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao validar conta Gmail.' });
    }
  });

  app.get('/api/creator/oauth-bridge/:bridgeId', (req: Request, res: Response) => {
    const bridgeId = String(req.params.bridgeId || '');
    const entry = oauthBridgeStore.get(bridgeId);
    if (!entry || Date.now() > entry.expiresAt) {
      oauthBridgeStore.delete(bridgeId);
      res.json({ ready: false });
      return;
    }
    oauthBridgeStore.delete(bridgeId);
    res.json({ ready: true, token: entry.token, email: entry.email });
  });

  // --- STOREFRONT & FAN API ---

  app.get('/api/storefront', async (req: Request, res: Response) => {
    const fanEmail = String(req.query.email || '').trim().toLowerCase();
    const client = getAdminClient();

    if (!client) {
      res.json({
        supabaseConnected: false,
        profile: maskProfileForClient({
          ...DEFAULT_CREATOR_PROFILE,
          whatsapp_number: readWhatsappFallback(),
          video_call_plans: readVideoCallPlansFallback(),
          about_section: readAboutSectionFallback(),
          mimo_config: readMimoConfigFallback(),
          testimonials: readTestimonialsFallback({ stripEmail: true }),
        }),
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

      const resolvedPlans = resolveProfileVideoCallPlans(profileRow as Record<string, unknown> | null);
      const resolvedWhatsapp = resolveProfileWhatsapp(profileRow as Record<string, unknown> | null);
      const resolvedAbout = resolveProfileAboutSection(profileRow as Record<string, unknown> | null);
      const resolvedMimo = resolveProfileMimoConfig(profileRow as Record<string, unknown> | null);
      const resolvedTestimonials = resolveProfileTestimonials(profileRow as Record<string, unknown> | null, {
        stripEmail: true,
      });
      const rawProfile = profileRow
        ? {
            ...DEFAULT_CREATOR_PROFILE,
            ...profileRow,
            vip_monthly_price_brl: Number(profileRow.vip_monthly_price_brl || 49.9),
            avatar_url: profileRow.avatar_url || DEFAULT_CREATOR_PROFILE.avatar_url,
            hero_url: profileRow.hero_url || DEFAULT_CREATOR_PROFILE.hero_url,
            whatsapp_number: resolvedWhatsapp,
            video_call_plans: resolvedPlans,
            about_section: resolvedAbout,
            mimo_config: resolvedMimo,
            testimonials: resolvedTestimonials,
          }
        : {
            ...DEFAULT_CREATOR_PROFILE,
            whatsapp_number: resolvedWhatsapp,
            video_call_plans: resolvedPlans,
            about_section: resolvedAbout,
            mimo_config: resolvedMimo,
            testimonials: resolvedTestimonials,
          };

      const profile = maskProfileForClient(rawProfile);

      let fan = null;
      const unlockedSet = new Set<string>();

      if (fanEmail) {
        const { data: fanRow } = await client
          .from('fans')
          .select('*')
          .eq('email', fanEmail)
          .maybeSingle();
        if (fanRow) {
          fan = await enrichFanWithLoyalty(client, fanRow as Record<string, unknown>);
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

      const enriched = mediaRows.map((item) => {
        const isUnlocked =
          item.access_tier === 'free' ||
          (item.access_tier === 'vip' && isFanVip) ||
          unlockedSet.has(item.id);

        const { mediaUrl, previewUrl } = buildMaskedMediaUrls(item, isUnlocked);

        return {
          ...item,
          storage_path: '',
          price_brl: Number(item.price_brl || 0),
          is_unlocked: isUnlocked,
          media_url: mediaUrl,
          preview_url: previewUrl,
        };
      });

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
      let isNewFanSignup = false;
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
        isNewFanSignup = true;
      }

      if (isNewFanSignup) {
        const origin = req.headers.origin ? String(req.headers.origin) : '';
        await orchestrateFanWelcomeEmail(client, {
          fanId: fan.id,
          email: cleanEmail,
          displayName: fan.display_name,
          triggerSource: 'signup',
          siteUrl: origin || undefined,
        });
      }

      const enrichedFan = await enrichFanWithLoyalty(client, fan as Record<string, unknown>);

      res.json({ fan: enrichedFan, welcomeTriggered: isNewFanSignup });
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
      const { buyerEmail, buyerName, saleType, mediaId, videoCallPlanId, contactInfo, amountBrl, paymentMethod, ageConfirmed18 } =
        req.body || {};
      const cleanEmail = String(buyerEmail || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'E-mail válido é obrigatório para liberar o acesso.' });
        return;
      }
      if (!ageConfirmed18) {
        res.status(400).json({ error: 'Confirme ter 18 anos ou mais para continuar.' });
        return;
      }
      if (!['vip_subscription', 'ppv', 'tip', 'video_call'].includes(saleType)) {
        res.status(400).json({ error: 'Tipo de venda inválido.' });
        return;
      }

      let authoritativeAmount = Number(amountBrl || 0);
      let selectedVideoCallPlan: VideoCallPlanConfig | null = null;
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
      } else if (saleType === 'video_call') {
        if (paymentMethod && paymentMethod !== 'pix') {
          res.status(400).json({
            error: 'A vídeo chamada privativa 1 a 1 aceita exclusivamente pagamento via Pix.',
          });
          return;
        }
        const trimmedContact = String(contactInfo || '').trim();
        if (trimmedContact.length < 4) {
          res.status(400).json({
            error: 'Informe seu WhatsApp ou @Telegram para receber o link privativo da sessão 1 a 1.',
          });
          return;
        }
        const { data: prof } = await client
          .from('creator_profile')
          .select('*')
          .eq('slug', 'solo')
          .maybeSingle();
        const plans = resolveProfileVideoCallPlans(prof as Record<string, unknown> | null);
        selectedVideoCallPlan = plans.find((p) => p.id === videoCallPlanId && p.active) || null;
        if (!selectedVideoCallPlan) {
          res.status(404).json({ error: 'Plano de vídeo chamada não encontrado ou inativo.' });
          return;
        }
        authoritativeAmount = Number(selectedVideoCallPlan.price_brl || 0);
      }

      if (authoritativeAmount <= 0 && saleType === 'tip') {
        res.status(400).json({ error: 'Informe um valor positivo para o mimo.' });
        return;
      }

      const { count: priorSalesCount } = await client
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_email', cleanEmail);

      // Upsert fan
      const vipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingFan } = await client
        .from('fans')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let fanId: string;
      const cleanBuyerName = buyerName ? String(buyerName).trim() : '';
      const cleanContact = contactInfo ? String(contactInfo).trim() : '';
      const combinedBuyerLabel =
        cleanBuyerName && cleanContact
          ? `${cleanBuyerName} · ${cleanContact}`
          : cleanBuyerName || cleanContact || cleanEmail.split('@')[0];
      const resolvedBuyerName = cleanBuyerName || cleanEmail.split('@')[0];

      if (existingFan) {
        fanId = existingFan.id;
        if (saleType === 'vip_subscription') {
          await client
            .from('fans')
            .update({
              is_vip: true,
              vip_expires_at: vipExpiry,
              display_name: cleanBuyerName || existingFan.display_name,
            })
            .eq('id', fanId);
        }
      } else {
        const { data: newFan, error: fanErr } = await client
          .from('fans')
          .insert({
            email: cleanEmail,
            display_name: resolvedBuyerName,
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

      // Create sale record (with constraint-safe fallback if existing live Supabase DB hasn't altered sales_sale_type_check)
      const externalRef =
        saleType === 'video_call' && selectedVideoCallPlan
          ? `VC-${selectedVideoCallPlan.duration_minutes}MIN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
          : `MP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const resolvedPaymentMethod =
        saleType === 'video_call' ? 'pix' : paymentMethod === 'card' ? 'card' : 'pix';

      const saleInsertBase = {
        fan_id: fanId,
        buyer_email: cleanEmail,
        buyer_name: saleType === 'video_call' ? combinedBuyerLabel : cleanBuyerName || null,
        sale_type: saleType,
        media_id: saleType === 'ppv' ? mediaId : null,
        amount_brl: authoritativeAmount,
        payment_method: resolvedPaymentMethod,
        status: 'paid',
        external_ref: externalRef,
      };

      let { data: sale, error: saleErr } = await client
        .from('sales')
        .insert(saleInsertBase)
        .select('*')
        .single();

      if (
        saleErr &&
        saleType === 'video_call' &&
        (saleErr.code === '23514' ||
          saleErr.message.toLowerCase().includes('check constraint') ||
          saleErr.message.toLowerCase().includes('sale_type'))
      ) {
        const fallbackRes = await client
          .from('sales')
          .insert({ ...saleInsertBase, sale_type: 'ppv', media_id: null })
          .select('*')
          .single();
        sale = fallbackRes.data;
        saleErr = fallbackRes.error;
      }

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

      let welcomeTriggered = false;
      if (!existingFan || (priorSalesCount || 0) === 0) {
        const origin = req.headers.origin ? String(req.headers.origin) : '';
        await orchestrateFanWelcomeEmail(client, {
          fanId,
          email: cleanEmail,
          displayName: existingFan?.display_name || resolvedBuyerName,
          triggerSource: 'first_purchase',
          saleType,
          amountBrl: authoritativeAmount,
          siteUrl: origin || undefined,
        });
        welcomeTriggered = true;
      }

      const { data: fanPaidSales } = await client
        .from('sales')
        .select('amount_brl, status, created_at')
        .eq('buyer_email', cleanEmail)
        .eq('status', 'paid');
      const loyalty = computeFanLoyalty(fanPaidSales || []);

      res.json({
        ok: true,
        sale: sale ? normalizeSaleRecord(sale, new Map()) : sale,
        loyalty,
        welcomeTriggered,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao processar compra.' });
    }
  });

  app.post('/api/storefront/testimonials', async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Conecte seu banco Supabase antes de enviar depoimentos verificados.' });
      return;
    }
    try {
      const { email, authorName, authorLocation, category, rating, comment } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe o e-mail utilizado em sua assinatura ou compra para validar o depoimento.' });
        return;
      }

      const cleanComment = String(comment || '').trim();
      if (cleanComment.length < 15) {
        res.status(400).json({ error: 'Escreva um depoimento com pelo menos 15 caracteres.' });
        return;
      }
      if (cleanComment.length > 600) {
        res.status(400).json({ error: 'O depoimento pode ter no máximo 600 caracteres.' });
        return;
      }

      const { data: paidSales, error: salesErr } = await client
        .from('sales')
        .select('id, sale_type, amount_brl, status, created_at')
        .eq('buyer_email', cleanEmail)
        .eq('status', 'paid');

      if (salesErr) {
        res.status(500).json({ error: salesErr.message });
        return;
      }

      if (!paidSales || paidSales.length === 0) {
        res.status(403).json({
          error:
            'Apenas internautas com ao menos 1 compra ou assinatura confirmada (Pix/cartão pago) podem publicar um depoimento verificado.',
        });
        return;
      }

      const { data: fanRow } = await client
        .from('fans')
        .select('display_name')
        .eq('email', cleanEmail)
        .maybeSingle();

      const loyalty = computeFanLoyalty(paidSales);
      const validCat = ['video_call', 'instagram', 'vip_subscription', 'tip', 'ppv'].includes(String(category))
        ? (String(category) as FanTestimonial['category'])
        : 'video_call';
      const numericRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

      const fallbackName = fanRow?.display_name || cleanEmail.split('@')[0];
      const resolvedAuthorName = String(authorName || fallbackName).trim().slice(0, 60) || fallbackName;
      const resolvedLocation = String(authorLocation || 'Brasil').trim().slice(0, 50) || 'Brasil';

      const newTestimonial: FanTestimonial = {
        id: `testi-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        author_name: resolvedAuthorName,
        author_location: resolvedLocation,
        author_email: cleanEmail,
        category: validCat,
        rating: numericRating,
        comment: cleanComment,
        verified_purchase: true,
        loyalty_label: loyalty.tier_label,
        is_published: true,
        featured: false,
        created_at: new Date().toISOString(),
      };

      const { data: profileRow } = await client
        .from('creator_profile')
        .select('testimonials')
        .eq('slug', 'solo')
        .maybeSingle();

      const existing = resolveProfileTestimonials(profileRow as Record<string, unknown> | null, {
        stripEmail: false,
      });
      const updatedList = sanitizeTestimonials([newTestimonial, ...existing].slice(0, 60), {
        stripEmail: false,
      });

      saveTestimonialsFallback(updatedList);
      await client
        .from('creator_profile')
        .update({ testimonials: updatedList, updated_at: new Date().toISOString() })
        .eq('slug', 'solo')
        .then(() => {}, () => {});

      res.json({
        ok: true,
        testimonial: sanitizeTestimonials([newTestimonial], { stripEmail: true })[0],
        testimonials: sanitizeTestimonials(updatedList, { stripEmail: true }),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao publicar depoimento.' });
    }
  });

  // --- CREATOR STUDIO API (Protected) ---

  app.get('/api/creator/dashboard', requireCreatorAuth, async (_req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
        res.json({
          supabaseConnected: false,
          profile: maskProfileForClient({
            ...DEFAULT_CREATOR_PROFILE,
            whatsapp_number: readWhatsappFallback(),
            video_call_plans: readVideoCallPlansFallback(),
            about_section: readAboutSectionFallback(),
            mimo_config: readMimoConfigFallback(),
            testimonials: readTestimonialsFallback({ stripEmail: false }),
          }),
          dashboard: {
            mediaItems: [],
            sales: [],
            fans: [],
            metrics: {
              totalRevenueBrl: 0,
              vipRevenueBrl: 0,
              ppvRevenueBrl: 0,
              tipsRevenueBrl: 0,
              videoCallRevenueBrl: 0,
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

        const resolvedPlans = resolveProfileVideoCallPlans(profileRes.data as Record<string, unknown> | null);
        const resolvedWhatsapp = resolveProfileWhatsapp(profileRes.data as Record<string, unknown> | null);
        const resolvedAbout = resolveProfileAboutSection(profileRes.data as Record<string, unknown> | null);
        const resolvedMimo = resolveProfileMimoConfig(profileRes.data as Record<string, unknown> | null);
        const resolvedTestimonials = resolveProfileTestimonials(profileRes.data as Record<string, unknown> | null, {
          stripEmail: false,
        });
        const rawProfile = profileRes.data
          ? {
              ...DEFAULT_CREATOR_PROFILE,
              ...profileRes.data,
              vip_monthly_price_brl: Number(profileRes.data.vip_monthly_price_brl || 49.9),
              avatar_url: profileRes.data.avatar_url || DEFAULT_CREATOR_PROFILE.avatar_url,
              hero_url: profileRes.data.hero_url || DEFAULT_CREATOR_PROFILE.hero_url,
              whatsapp_number: resolvedWhatsapp,
              video_call_plans: resolvedPlans,
              about_section: resolvedAbout,
              mimo_config: resolvedMimo,
              testimonials: resolvedTestimonials,
            }
          : {
              ...DEFAULT_CREATOR_PROFILE,
              whatsapp_number: resolvedWhatsapp,
              video_call_plans: resolvedPlans,
              about_section: resolvedAbout,
              mimo_config: resolvedMimo,
              testimonials: resolvedTestimonials,
            };

        const profile = maskProfileForClient(rawProfile);

      const mediaRows = mediaRes.data || [];
      const mediaTitleMap = new Map<string, string>();
      for (const m of mediaRows) {
        mediaTitleMap.set(m.id, m.title);
      }

      const enrichedMedia = mediaRows.map((item) => {
        const { mediaUrl, previewUrl } = buildMaskedMediaUrls(item, true);
        return {
          ...item,
          storage_path: '',
          price_brl: Number(item.price_brl || 0),
          media_url: mediaUrl,
          preview_url: previewUrl,
          is_unlocked: true,
        };
      });

      const salesRows = (salesRes.data || []).map((s) => normalizeSaleRecord(s, mediaTitleMap));

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
      const videoCallRevenueBrl = paidSales
        .filter((s) => s.sale_type === 'video_call')
        .reduce((acc, s) => acc + s.amount_brl, 0);

      const paidSalesByEmail = new Map<string, typeof paidSales>();
      for (const sale of paidSales) {
        const key = String(sale.buyer_email || '').trim().toLowerCase();
        if (!key) continue;
        const list = paidSalesByEmail.get(key) || [];
        list.push(sale);
        paidSalesByEmail.set(key, list);
      }

      const fansRows = (fansRes.data || []).map((f) => {
        const key = String(f.email || '').trim().toLowerCase();
        const fanPaid = paidSalesByEmail.get(key) || [];
        return {
          ...f,
          loyalty: computeFanLoyalty(fanPaid),
        };
      });
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
            videoCallRevenueBrl,
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
        const rawHeaderName = String(req.headers['x-file-name'] || 'media.bin');
        let rawName = rawHeaderName;
        try {
          rawName = decodeURIComponent(rawHeaderName);
        } catch {
          // keep raw header string if not URI-encoded
        }
        let mimeType = String(req.headers['x-mime-type'] || req.headers['content-type'] || 'application/octet-stream');
        const targetBucket = req.headers['x-bucket'] === 'creator-previews' ? 'creator-previews' : 'creator-media';
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase() || 'media.bin';
        if (mimeType === 'application/octet-stream') {
          if (/\.(jpe?g|jfif)$/i.test(safeName)) mimeType = 'image/jpeg';
          else if (/\.png$/i.test(safeName)) mimeType = 'image/png';
          else if (/\.webp$/i.test(safeName)) mimeType = 'image/webp';
          else if (/\.gif$/i.test(safeName)) mimeType = 'image/gif';
          else if (/\.avif$/i.test(safeName)) mimeType = 'image/avif';
          else if (/\.heic$/i.test(safeName)) mimeType = 'image/heic';
          else if (/\.(mp4|m4v)$/i.test(safeName)) mimeType = 'video/mp4';
          else if (/\.mov$/i.test(safeName)) mimeType = 'video/quicktime';
          else if (/\.webm$/i.test(safeName)) mimeType = 'video/webm';
        }
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

      const cleanStoragePath = String(storagePath || '').trim();
      const cleanPreviewUrl = previewUrl ? String(previewUrl).trim() : '';

      if (!title || !cleanStoragePath || !['photo', 'video'].includes(mediaType)) {
        res.status(400).json({ error: 'Título, tipo de mídia e arquivo ou link são obrigatórios.' });
        return;
      }

      const isExternalSource =
        cleanStoragePath.startsWith('http://') ||
        cleanStoragePath.startsWith('https://') ||
        cleanStoragePath.includes('://') ||
        /^(javascript|data|ftp|file):/i.test(cleanStoragePath);
      if (isExternalSource && !isSafeExternalMediaUrl(cleanStoragePath)) {
        res.status(400).json({ error: 'Informe um link externo válido começando com http:// ou https://.' });
        return;
      }

      if (
        cleanPreviewUrl &&
        !cleanPreviewUrl.startsWith('/') &&
        (cleanPreviewUrl.includes('://') || /^(http|javascript|data|ftp|file):/i.test(cleanPreviewUrl)) &&
        !isSafeExternalMediaUrl(cleanPreviewUrl)
      ) {
        res.status(400).json({ error: 'O link da capa de prévia precisa começar com http:// ou https://.' });
        return;
      }

      const resolvedMime =
        mimeType ||
        (cleanStoragePath.startsWith('http')
          ? inferContentTypeFromPath(cleanStoragePath, mediaType === 'video' ? 'video/mp4' : 'image/jpeg')
          : null);

      const { data, error } = await client
        .from('media_items')
        .insert({
          title: String(title).trim(),
          description: String(description || '').trim(),
          media_type: mediaType,
          access_tier: ['free', 'vip', 'ppv'].includes(accessTier) ? accessTier : 'vip',
          price_brl: accessTier === 'ppv' ? Number(priceBrl || 29.9) : 0,
          collection_name: String(collectionName || 'Geral').trim() || 'Geral',
          storage_path: cleanStoragePath,
          media_url: cleanStoragePath,
          preview_url: cleanPreviewUrl || null,
          duration_seconds: durationSeconds ? Number(durationSeconds) : null,
          file_size_bytes: fileSizeBytes ? Number(fileSizeBytes) : null,
          mime_type: resolvedMime,
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
      const {
        title,
        description,
        access_tier,
        price_brl,
        collection_name,
        is_published,
        storage_path,
        preview_url,
        media_type,
        duration_seconds,
        file_size_bytes,
        mime_type,
      } = req.body || {};

      const { data: existing } = await client
        .from('media_items')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = String(title).trim();
      if (description !== undefined) updates.description = String(description).trim();
      if (access_tier !== undefined && ['free', 'vip', 'ppv'].includes(access_tier)) {
        updates.access_tier = access_tier;
      }
      if (price_brl !== undefined) updates.price_brl = Number(price_brl);
      if (collection_name !== undefined) updates.collection_name = String(collection_name).trim() || 'Geral';
      if (is_published !== undefined) updates.is_published = Boolean(is_published);
      if (media_type !== undefined && ['photo', 'video'].includes(media_type)) {
        updates.media_type = media_type;
      }
      if (storage_path !== undefined && String(storage_path).trim()) {
        const cleanNextPath = String(storage_path).trim();
        const looksExternal =
          cleanNextPath.startsWith('http://') ||
          cleanNextPath.startsWith('https://') ||
          cleanNextPath.includes('://') ||
          /^(javascript|data|ftp|file):/i.test(cleanNextPath);
        if (looksExternal && !isSafeExternalMediaUrl(cleanNextPath)) {
          res.status(400).json({ error: 'O link da mídia precisa começar com http:// ou https://.' });
          return;
        }
        updates.storage_path = cleanNextPath;
        updates.media_url = cleanNextPath;
        if (mime_type === undefined && cleanNextPath.startsWith('http')) {
          updates.mime_type = inferContentTypeFromPath(
            cleanNextPath,
            media_type === 'video' ? 'video/mp4' : 'image/jpeg'
          );
        }
      }
      if (preview_url !== undefined) {
        const cleanNextPreview = preview_url ? String(preview_url).trim() : '';
        if (
          cleanNextPreview &&
          !cleanNextPreview.startsWith('/') &&
          (cleanNextPreview.includes('://') || /^(http|javascript|data|ftp|file):/i.test(cleanNextPreview)) &&
          !isSafeExternalMediaUrl(cleanNextPreview)
        ) {
          res.status(400).json({ error: 'O link da capa de prévia precisa começar com http:// ou https://.' });
          return;
        }
        updates.preview_url = cleanNextPreview || null;
      }
      if (duration_seconds !== undefined) {
        updates.duration_seconds = duration_seconds === null ? null : Number(duration_seconds);
      }
      if (file_size_bytes !== undefined) {
        updates.file_size_bytes = file_size_bytes === null ? null : Number(file_size_bytes);
      }
      if (mime_type !== undefined) {
        updates.mime_type = mime_type ? String(mime_type) : null;
      }

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

      // Remove old file from storage if a new storage_path was uploaded
      if (
        storage_path &&
        existing?.storage_path &&
        existing.storage_path !== storage_path &&
        !existing.storage_path.startsWith('http') &&
        !existing.storage_path.startsWith('/')
      ) {
        await client.storage.from('creator-media').remove([existing.storage_path]).catch(() => {});
      }

      res.json({ item: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar mídia.' });
    }
  });

  app.post('/api/creator/fans', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { email, display_name, is_vip, vip_days } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido para o assinante.' });
        return;
      }
      const makeVip = Boolean(is_vip);
      const days = Number(vip_days || 30);
      const vipExpiresAt = makeVip ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data: beforeFan } = await client
        .from('fans')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      const { data, error } = await client
        .from('fans')
        .upsert(
          {
            email: cleanEmail,
            display_name: display_name ? String(display_name).trim() : cleanEmail.split('@')[0],
            is_vip: makeVip,
            vip_expires_at: vipExpiresAt,
            age_confirmed_18: true,
          },
          { onConflict: 'email' }
        )
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (!beforeFan && data) {
        const origin = req.headers.origin ? String(req.headers.origin) : '';
        await orchestrateFanWelcomeEmail(client, {
          fanId: data.id,
          email: cleanEmail,
          displayName: data.display_name,
          triggerSource: 'signup',
          siteUrl: origin || undefined,
        });
      }

      res.json({ fan: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar assinante.' });
    }
  });

  app.patch('/api/creator/fans/:id', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { id } = req.params;
      const { display_name, is_vip, extend_days } = req.body || {};
      const updates: Record<string, unknown> = {};
      if (display_name !== undefined) updates.display_name = String(display_name).trim();
      if (is_vip !== undefined) {
        updates.is_vip = Boolean(is_vip);
        if (is_vip) {
          const days = Number(extend_days || 30);
          updates.vip_expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        } else {
          updates.vip_expires_at = null;
        }
      } else if (extend_days) {
        updates.is_vip = true;
        updates.vip_expires_at = new Date(Date.now() + Number(extend_days) * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data, error } = await client
        .from('fans')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ fan: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar assinante.' });
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
        whatsapp_number,
        avatar_url,
        hero_url,
        newAdminEmail,
        newAdminPassword,
      } = req.body || {};

      const envUpdates: Record<string, string> = {};
      const previousAdminEmail = runtimeConfig.adminEmail;
      if (newAdminEmail && String(newAdminEmail).includes('@')) {
        const cleanNewEmail = String(newAdminEmail).trim().toLowerCase();
        runtimeConfig.adminEmail = cleanNewEmail;
        envUpdates.CREATOR_ADMIN_EMAIL = cleanNewEmail;
      }
      if (newAdminPassword && String(newAdminPassword).length >= 6) {
        const newHash = hashPassword(String(newAdminPassword));
        runtimeConfig.adminPasswordHash = newHash;
        envUpdates.CREATOR_ADMIN_HASH = newHash;
      }
      if (Object.keys(envUpdates).length > 0) {
        envUpdates.CREATOR_AUTH_SECRET = runtimeConfig.authSecret;
        saveEnvLocal(envUpdates);

        const targetEmail = runtimeConfig.adminEmail || previousAdminEmail;
        if (targetEmail) {
          const lookupEmail = previousAdminEmail || targetEmail;
          const sbUser = await hasSupabaseEmailPasswordUser(lookupEmail);
          if (sbUser.exists && sbUser.userId) {
            await client.auth.admin
              .updateUserById(sbUser.userId, {
                ...(newAdminEmail ? { email: targetEmail } : {}),
                ...(newAdminPassword && String(newAdminPassword).length >= 6
                  ? { password: String(newAdminPassword) }
                  : {}),
                email_confirm: true,
              })
              .catch(() => {});
          } else if (newAdminPassword && String(newAdminPassword).length >= 6) {
            await client.auth.admin
              .createUser({
                email: targetEmail,
                password: String(newAdminPassword),
                email_confirm: true,
                user_metadata: { role: 'creator_admin' },
              })
              .catch(() => {});
          }
        }
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
      if (avatar_url !== undefined && !String(avatar_url).startsWith('/api/profile/asset/')) {
        const cleanAvatar = String(avatar_url).trim();
        if (cleanAvatar.includes('://') && !isSafeExternalMediaUrl(cleanAvatar)) {
          res.status(400).json({ error: 'Informe um link http:// ou https:// válido para a foto de perfil.' });
          return;
        }
        payload.avatar_url = cleanAvatar;
      }
      if (hero_url !== undefined && !String(hero_url).startsWith('/api/profile/asset/')) {
        const cleanHero = String(hero_url).trim();
        if (cleanHero.includes('://') && !isSafeExternalMediaUrl(cleanHero)) {
          res.status(400).json({ error: 'Informe um link http:// ou https:// válido para a capa hero.' });
          return;
        }
        payload.hero_url = cleanHero;
      }

      const { data, error } = await client
        .from('creator_profile')
        .upsert(payload, { onConflict: 'slug' })
        .select('*')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (whatsapp_number !== undefined) {
        const cleanWhatsapp = sanitizeWhatsappNumber(whatsapp_number);
        saveWhatsappFallback(cleanWhatsapp);
        await client
          .from('creator_profile')
          .update({ whatsapp_number: cleanWhatsapp })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      if (newAdminEmail && String(newAdminEmail).includes('@')) {
        await client
          .from('creator_profile')
          .update({ admin_email: String(newAdminEmail).trim().toLowerCase() })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      if (Array.isArray(req.body?.video_call_plans)) {
        const sanitizedPlans = sanitizeVideoCallPlans(req.body.video_call_plans);
        saveVideoCallPlansFallback(sanitizedPlans);
        await client
          .from('creator_profile')
          .update({ video_call_plans: sanitizedPlans })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      let updatedAbout: CreatorAboutContent | null = null;
      if (req.body?.about_section && typeof req.body.about_section === 'object') {
        updatedAbout = sanitizeCreatorAboutContent(req.body.about_section);
        saveAboutSectionFallback(updatedAbout);
        await client
          .from('creator_profile')
          .update({ about_section: updatedAbout })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      let updatedMimo: MimoSectionConfig | null = null;
      if (req.body?.mimo_config && typeof req.body.mimo_config === 'object') {
        updatedMimo = sanitizeMimoSectionConfig(req.body.mimo_config);
        saveMimoConfigFallback(updatedMimo);
        await client
          .from('creator_profile')
          .update({ mimo_config: updatedMimo })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      const resolvedPlans = resolveProfileVideoCallPlans(data as Record<string, unknown>);
      const resolvedWhatsapp =
        whatsapp_number !== undefined
          ? sanitizeWhatsappNumber(whatsapp_number)
          : resolveProfileWhatsapp(data as Record<string, unknown>);
      const resolvedAbout = updatedAbout || resolveProfileAboutSection(data as Record<string, unknown>);
      const resolvedMimo = updatedMimo || resolveProfileMimoConfig(data as Record<string, unknown>);
      const resolvedTestimonials = resolveProfileTestimonials(data as Record<string, unknown>, {
        stripEmail: false,
      });
      res.json({
        profile: maskProfileForClient({
          ...data,
          whatsapp_number: resolvedWhatsapp,
          video_call_plans: resolvedPlans,
          about_section: resolvedAbout,
          mimo_config: resolvedMimo,
          testimonials: resolvedTestimonials,
        }),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar perfil.' });
    }
  });

  app.patch('/api/creator/video-calls', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const incoming = req.body?.plans;
      if (!Array.isArray(incoming) || incoming.length !== 4) {
        res.status(400).json({ error: 'Informe exatamente os 4 planos de Vídeo Chamada.' });
        return;
      }
      const sanitized = sanitizeVideoCallPlans(incoming);
      saveVideoCallPlansFallback(sanitized);

      const client = getAdminClient();
      if (client) {
        await client
          .from('creator_profile')
          .update({ video_call_plans: sanitized, updated_at: new Date().toISOString() })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      res.json({ ok: true, video_call_plans: sanitized });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar planos de Vídeo Chamada.' });
    }
  });

  app.patch('/api/creator/about', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const incoming = req.body?.about_section;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'Dados da seção Sobre a Criadora inválidos.' });
        return;
      }
      const sanitized = sanitizeCreatorAboutContent(incoming);
      saveAboutSectionFallback(sanitized);

      const client = getAdminClient();
      if (client) {
        await client
          .from('creator_profile')
          .update({ about_section: sanitized, updated_at: new Date().toISOString() })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      res.json({ ok: true, about_section: sanitized });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar seção Sobre a Criadora.' });
    }
  });

  app.patch('/api/creator/mimos', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const incoming = req.body?.mimo_config;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'Configuração de Mimos Especiais inválida.' });
        return;
      }
      const sanitized = sanitizeMimoSectionConfig(incoming);
      saveMimoConfigFallback(sanitized);

      const client = getAdminClient();
      if (client) {
        await client
          .from('creator_profile')
          .update({ mimo_config: sanitized, updated_at: new Date().toISOString() })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      res.json({ ok: true, mimo_config: sanitized });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar cartões de Mimos Especiais.' });
    }
  });

  app.patch('/api/creator/testimonials', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const incoming = req.body?.testimonials;
      if (!Array.isArray(incoming)) {
        res.status(400).json({ error: 'Lista de depoimentos inválida.' });
        return;
      }
      const sanitized = sanitizeTestimonials(incoming, { stripEmail: false });
      saveTestimonialsFallback(sanitized);

      const client = getAdminClient();
      if (client) {
        await client
          .from('creator_profile')
          .update({ testimonials: sanitized, updated_at: new Date().toISOString() })
          .eq('slug', 'solo')
          .then(() => {}, () => {});
      }

      res.json({ ok: true, testimonials: sanitized });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar depoimentos dos fãs.' });
    }
  });

  app.post('/api/creator/sales', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { buyerEmail, buyerName, saleType, mediaId, videoCallPlanId, amountBrl, paymentMethod, status, externalRef } =
        req.body || {};

      const cleanEmail = String(buyerEmail || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido do comprador para vincular ao banco de vendas.' });
        return;
      }
      if (!['vip_subscription', 'ppv', 'tip', 'video_call'].includes(saleType)) {
        res.status(400).json({ error: 'Tipo de transação inválido.' });
        return;
      }
      const normalizedStatus = ['paid', 'pending', 'refunded'].includes(status) ? status : 'pending';
      if (saleType === 'video_call' && paymentMethod && paymentMethod !== 'pix') {
        res.status(400).json({
          error: 'Vídeo chamada privativa 1 a 1 aceita exclusivamente pagamento via Pix.',
        });
        return;
      }
      const method = saleType === 'video_call' ? 'pix' : paymentMethod === 'card' ? 'card' : 'pix';

      let authoritativeAmount = Number(amountBrl || 0);
      let vcDuration = 15;
      if (saleType === 'vip_subscription' && (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0)) {
        const { data: prof } = await client
          .from('creator_profile')
          .select('vip_monthly_price_brl')
          .eq('slug', 'solo')
          .maybeSingle();
        authoritativeAmount = Number(prof?.vip_monthly_price_brl || 49.9);
      } else if (saleType === 'ppv') {
        if (!mediaId) {
          res.status(400).json({ error: 'Selecione a mídia avulsa (PPV) para vincular esta transação.' });
          return;
        }
        if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
          const { data: mediaRow } = await client
            .from('media_items')
            .select('price_brl')
            .eq('id', mediaId)
            .maybeSingle();
          authoritativeAmount = Number(mediaRow?.price_brl || 0);
        }
      } else if (saleType === 'video_call') {
        const { data: prof } = await client
          .from('creator_profile')
          .select('*')
          .eq('slug', 'solo')
          .maybeSingle();
        const plans = resolveProfileVideoCallPlans(prof as Record<string, unknown> | null);
        const plan = plans.find((p) => p.id === videoCallPlanId) || plans[0];
        if (plan) {
          vcDuration = plan.duration_minutes;
          if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
            authoritativeAmount = plan.price_brl;
          }
        }
      }

      if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
        res.status(400).json({ error: 'Informe um valor positivo em R$ para registrar a transação.' });
        return;
      }

      const { count: priorSalesCount } = await client
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_email', cleanEmail);

      const vipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingFan } = await client
        .from('fans')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      let fanId: string;
      const resolvedBuyerName = buyerName ? String(buyerName).trim() : cleanEmail.split('@')[0];
      if (existingFan) {
        fanId = existingFan.id;
        if (normalizedStatus === 'paid' && saleType === 'vip_subscription') {
          await client
            .from('fans')
            .update({
              is_vip: true,
              vip_expires_at: vipExpiry,
              display_name: buyerName ? String(buyerName).trim() : existingFan.display_name,
            })
            .eq('id', fanId);
        }
      } else {
        const { data: newFan, error: fanErr } = await client
          .from('fans')
          .insert({
            email: cleanEmail,
            display_name: resolvedBuyerName,
            is_vip: normalizedStatus === 'paid' && saleType === 'vip_subscription',
            vip_expires_at: normalizedStatus === 'paid' && saleType === 'vip_subscription' ? vipExpiry : null,
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

      const rawCleanRef = String(externalRef || '').trim();
      const cleanRef =
        saleType === 'video_call'
          ? rawCleanRef.startsWith('VC-')
            ? rawCleanRef
            : `VC-${vcDuration}MIN-${rawCleanRef || crypto.randomBytes(3).toString('hex').toUpperCase()}`
          : rawCleanRef || `MP-PIX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const saleInsertBase = {
        fan_id: fanId,
        buyer_email: cleanEmail,
        buyer_name: buyerName ? String(buyerName).trim() : null,
        sale_type: saleType,
        media_id: saleType === 'ppv' ? mediaId : null,
        amount_brl: authoritativeAmount,
        payment_method: method,
        status: normalizedStatus,
        external_ref: cleanRef,
      };

      let { data: sale, error: saleErr } = await client
        .from('sales')
        .insert(saleInsertBase)
        .select('*')
        .single();

      if (
        saleErr &&
        saleType === 'video_call' &&
        (saleErr.code === '23514' ||
          saleErr.message.toLowerCase().includes('check constraint') ||
          saleErr.message.toLowerCase().includes('sale_type'))
      ) {
        const fallbackRes = await client
          .from('sales')
          .insert({ ...saleInsertBase, sale_type: 'ppv', media_id: null })
          .select('*')
          .single();
        sale = fallbackRes.data;
        saleErr = fallbackRes.error;
      }

      if (saleErr) {
        res.status(500).json({ error: saleErr.message });
        return;
      }

      if (normalizedStatus === 'paid' && saleType === 'ppv' && mediaId) {
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

      if (!existingFan || (priorSalesCount || 0) === 0) {
        const origin = req.headers.origin ? String(req.headers.origin) : '';
        await orchestrateFanWelcomeEmail(client, {
          fanId,
          email: cleanEmail,
          displayName: existingFan?.display_name || resolvedBuyerName,
          triggerSource: 'first_purchase',
          saleType,
          amountBrl: authoritativeAmount,
          siteUrl: origin || undefined,
        });
      }

      res.json({ sale: sale ? normalizeSaleRecord(sale, new Map()) : sale });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao registrar transação.' });
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

      if (status === 'paid' && sale) {
        if (sale.sale_type === 'ppv' && sale.media_id && sale.buyer_email) {
          await client.from('unlocked_media').upsert(
            {
              fan_id: sale.fan_id,
              buyer_email: sale.buyer_email,
              media_id: sale.media_id,
              sale_id: sale.id,
            },
            { onConflict: 'buyer_email,media_id' }
          );
        } else if (sale.sale_type === 'vip_subscription' && sale.fan_id) {
          const vipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await client
            .from('fans')
            .update({ is_vip: true, vip_expires_at: vipExpiry })
            .eq('id', sale.fan_id);
        }
      } else if (status === 'refunded' && sale) {
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

  // --- WELCOME FAN EMAIL (SUPABASE EDGE FUNCTION ORCHESTRATION) ---

  app.get('/api/creator/welcome-emails', requireCreatorAuth, async (_req: Request, res: Response) => {
    const client = getAdminClient();
    const edgeUrl = runtimeConfig.supabaseUrl
      ? `${runtimeConfig.supabaseUrl.replace(/\/+$/, '')}/functions/v1/welcome-fan-email`
      : null;

    let edgeDeployed = false;
    if (edgeUrl && runtimeConfig.supabaseServiceRoleKey) {
      try {
        const probe = await fetch(edgeUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${runtimeConfig.supabaseServiceRoleKey}`,
            apikey: runtimeConfig.supabaseAnonKey || runtimeConfig.supabaseServiceRoleKey,
          },
        });
        edgeDeployed = probe.ok;
      } catch {
        edgeDeployed = false;
      }
    }

    let logs: unknown[] = [];
    let schemaNeedsMigration = false;
    if (client) {
      const { data, error } = await client
        .from('welcome_email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) {
        schemaNeedsMigration = true;
      } else {
        logs = data || [];
      }
    }

    res.json({
      edgeDeployed,
      edgeUrl,
      resendConfigured: Boolean(runtimeConfig.resendApiKey),
      fromEmail: runtimeConfig.resendFromEmail,
      schemaNeedsMigration,
      logs,
      edgeFunctionCode: readEdgeFunctionCode(),
      migrationSql: buildWelcomeMigrationSql(),
    });
  });

  app.post('/api/creator/welcome-emails/config', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const { resendApiKey, fromEmail } = req.body || {};
      const updates: Record<string, string> = {};

      if (typeof resendApiKey === 'string' && resendApiKey.trim()) {
        runtimeConfig.resendApiKey = resendApiKey.trim();
        updates.RESEND_API_KEY = resendApiKey.trim();
      }
      if (typeof fromEmail === 'string' && fromEmail.trim()) {
        runtimeConfig.resendFromEmail = fromEmail.trim();
        updates.RESEND_FROM_EMAIL = fromEmail.trim();
      }

      if (Object.keys(updates).length > 0) {
        saveEnvLocal(updates);
      }

      res.json({
        ok: true,
        resendConfigured: Boolean(runtimeConfig.resendApiKey),
        fromEmail: runtimeConfig.resendFromEmail,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao salvar configuração.' });
    }
  });

  app.post('/api/creator/welcome-emails/deploy', requireCreatorAuth, async (req: Request, res: Response) => {
    try {
      const { accessToken, resendApiKey, fromEmail } = req.body || {};
      const token = String(accessToken || '').trim();
      if (!token) {
        res.status(400).json({ error: 'Informe o Access Token pessoal do Supabase (sbp_...).' });
        return;
      }
      const projectRef = runtimeConfig.supabaseUrl ? extractProjectRef(runtimeConfig.supabaseUrl) : null;
      if (!projectRef) {
        res.status(400).json({ error: 'Projeto Supabase não conectado.' });
        return;
      }

      const envUpdates: Record<string, string> = {};
      if (typeof resendApiKey === 'string' && resendApiKey.trim()) {
        runtimeConfig.resendApiKey = resendApiKey.trim();
        envUpdates.RESEND_API_KEY = resendApiKey.trim();
      }
      if (typeof fromEmail === 'string' && fromEmail.trim()) {
        runtimeConfig.resendFromEmail = fromEmail.trim();
        envUpdates.RESEND_FROM_EMAIL = fromEmail.trim();
      }
      if (Object.keys(envUpdates).length > 0) {
        saveEnvLocal(envUpdates);
      }

      // 1. Run additive schema migration (welcome_email_sent_at + welcome_email_logs + triggers)
      const migrationSql = buildWelcomeMigrationSql();
      await executeSchemaViaManagementApi(token, projectRef, migrationSql);

      // 2. Push secrets to Supabase Edge Function environment
      const secretsToSet: Array<{ name: string; value: string }> = [];
      if (runtimeConfig.resendApiKey) {
        secretsToSet.push({ name: 'RESEND_API_KEY', value: runtimeConfig.resendApiKey });
      }
      if (runtimeConfig.resendFromEmail) {
        secretsToSet.push({ name: 'RESEND_FROM_EMAIL', value: runtimeConfig.resendFromEmail });
      }
      if (secretsToSet.length > 0) {
        await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(secretsToSet),
        });
      }

      // 3. Deploy welcome-fan-email Edge Function bundle via Management API
      const edgeCode = readEdgeFunctionCode();
      if (!edgeCode) {
        res.status(500).json({ error: 'Código da Edge Function não encontrado no servidor.' });
        return;
      }

      const form = new FormData();
      form.append(
        'metadata',
        JSON.stringify({
          name: 'welcome-fan-email',
          entrypoint_path: 'index.ts',
          verify_jwt: false,
        })
      );
      form.append('file', new Blob([edgeCode], { type: 'application/typescript' }), 'index.ts');

      const deployResp = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=welcome-fan-email`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );

      if (!deployResp.ok) {
        const errText = await deployResp.text();
        res.status(deployResp.status).json({
          error: `Falha ao publicar Edge Function no Supabase: ${errText}`,
        });
        return;
      }

      const deployed = await deployResp.json();
      res.json({
        ok: true,
        functionSlug: deployed?.slug || 'welcome-fan-email',
        version: deployed?.version,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao publicar Edge Function.' });
    }
  });

  app.post('/api/creator/welcome-emails/test', requireCreatorAuth, async (req: Request, res: Response) => {
    const client = getAdminClient();
    if (!client) {
      res.status(503).json({ error: 'Supabase não conectado.' });
      return;
    }
    try {
      const { email, displayName, triggerSource } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Informe um e-mail válido para testar o disparo.' });
        return;
      }
      const origin = req.headers.origin ? String(req.headers.origin) : '';
      const result = await orchestrateFanWelcomeEmail(client, {
        email: cleanEmail,
        displayName: displayName ? String(displayName).trim() : 'Assinante Teste',
        triggerSource:
          triggerSource === 'first_purchase' || triggerSource === 'signup' ? triggerSource : 'manual_test',
        saleType: triggerSource === 'first_purchase' ? 'vip_subscription' : undefined,
        amountBrl: triggerSource === 'first_purchase' ? 49.9 : undefined,
        siteUrl: origin || undefined,
        forceTest: true,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao testar disparo.' });
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
          if (
            entry.name === '.video-call-plans.json' ||
            entry.name === '.creator-contact.json' ||
            entry.name === '.creator-about.json' ||
            entry.name === '.creator-mimo-config.json' ||
            entry.name === '.creator-testimonials.json'
          ) {
            continue;
          }
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

  // --- SEO & AI CRAWLER DISCOVERABILITY (robots.txt, sitemap.xml, llms.txt, AI JSON-LD) ---

  const resolveOriginUrl = (req: Request): string => {
    if (process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`)
      .split(',')[0]
      .trim();
    return `${proto}://${host}`;
  };

  const loadPublicSeoSnapshot = async () => {
    const client = getAdminClient();
    let profileRow: Record<string, unknown> | null = null;
    let totalPhotos = 0;
    let totalVideos = 0;
    let collectionsCount = 0;

    if (client) {
      const [{ data: prof }, { data: pubMedia }] = await Promise.all([
        client.from('creator_profile').select('*').eq('slug', 'solo').maybeSingle(),
        client.from('media_items').select('media_type, collection_name').eq('is_published', true),
      ]);
      profileRow = prof as Record<string, unknown> | null;
      const rows = pubMedia || [];
      totalPhotos = rows.filter((m) => m.media_type === 'photo').length;
      totalVideos = rows.filter((m) => m.media_type === 'video').length;
      collectionsCount = new Set(rows.map((m) => m.collection_name || 'Geral')).size;
    }

    const plans = resolveProfileVideoCallPlans(profileRow);
    const about = resolveProfileAboutSection(profileRow);
    const mimo = resolveProfileMimoConfig(profileRow);
    const testimonials = resolveProfileTestimonials(profileRow, { stripEmail: true }).filter(
      (t) => t.is_published
    );

    const profile = {
      ...DEFAULT_CREATOR_PROFILE,
      ...(profileRow || {}),
      vip_monthly_price_brl: Number(profileRow?.vip_monthly_price_brl || DEFAULT_CREATOR_PROFILE.vip_monthly_price_brl),
      video_call_plans: plans,
      about_section: about,
      mimo_config: mimo,
      testimonials,
    };

    const stats = {
      totalPhotos,
      totalVideos,
      collectionsCount,
      vipPriceBrl: profile.vip_monthly_price_brl,
      activeVipCount: 0,
    };

    return { profile, stats, plans, about, mimo, testimonials };
  };

  // Prevent search/AI indexing of private /admin and /api/* responses at HTTP header level
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/admin') || req.path.startsWith('/api/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }
    next();
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = resolveOriginUrl(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /api/creator/',
      'Disallow: /api/supabase/',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: Google-Extended',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: OAI-SearchBot',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: GPTBot',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: PerplexityBot',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: Perplexity-User',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: anthropic-ai',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: Applebot-Extended',
      'Allow: /',
      'Disallow: /admin',
      '',
      'User-agent: Bingbot',
      'Allow: /',
      'Disallow: /admin',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    const origin = resolveOriginUrl(req);
    const { profile } = await loadPublicSeoSnapshot();
    const lastmod = String(profile.updated_at || new Date().toISOString()).slice(0, 10);
    const heroImg = `${origin}/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${heroImg}</image:loc>
      <image:title>Vídeo Chamada Modelo Feminina Atraente ${profile.display_name}</image:title>
      <image:caption>${profile.display_name} (${profile.handle}) — Vídeo Chamada Privativa 1:1 via Pix, Mimos e Clube VIP +18</image:caption>
    </image:image>
  </url>
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  });

  app.get(['/llms.txt', '/llms-full.txt'], async (req: Request, res: Response) => {
    const origin = resolveOriginUrl(req);
    const isFull = req.path === '/llms-full.txt';
    const { profile, stats, plans, mimo, testimonials } = await loadPublicSeoSnapshot();
    const ratingStats = computeTestimonialStats(testimonials);
    const activePlans = plans.filter((p) => p.active);
    const activeMimos = mimo.tiers.filter((t) => t.active);

    const lines: string[] = [
      `# Vídeo Chamada Modelo Feminina Atraente ${profile.display_name}`,
      '',
      `> ${profile.bio} Localização: ${profile.location}. Handle: ${profile.handle}. Site oficial: ${origin}/`,
      '',
      '## Resumo dos Serviços Públicos (+18)',
      `- **Vídeo Chamada Privativa 1:1 via Pix**: Somente 1 internauta + ${profile.display_name} ao vivo frente à câmera em sala privada fechada, mediante pagamento exclusivo via Pix.`,
      ...activePlans.map(
        (p) =>
          `  - ${p.title} (${p.duration_minutes} min): R$ ${Number(p.price_brl).toFixed(2)} via Pix — ${p.description}`
      ),
      `- **6 Cartões de Mimos Especiais**: ${mimo.section_description}`,
      ...activeMimos.map(
        (m) => `  - ${m.title} (${m.badge}): R$ ${Number(m.amount_brl).toFixed(2)} — ${m.perk}`
      ),
      `- **Clube VIP Mensal**: R$ ${Number(profile.vip_monthly_price_brl).toFixed(2)}/mês — ${profile.vip_description}`,
      `- **Galeria & Acervo 35mm**: ${stats.totalPhotos} fotos exclusivas e ${stats.totalVideos} vídeos em ${stats.collectionsCount} coleções.`,
      `- **Avaliação Verificada dos Fãs**: Nota média ${ratingStats.averageRating.toFixed(1)}/5.0 com ${ratingStats.verifiedCount} depoimentos verificados (${ratingStats.satisfactionPercent}% de satisfação).`,
      '',
      '## Navegação Pública',
      `- [Vitrine Oficial](${origin}/)`,
      `- [Sobre ${profile.display_name}](${origin}/#sobre-criadora)`,
      `- [Vídeo Chamada 1:1 via Pix](${origin}/#video-chamada)`,
      `- [6 Cartões de Mimos Especiais](${origin}/#enviar-mimo)`,
      `- [Galeria 35mm](${origin}/#vitrine-grid)`,
      `- [Depoimentos Verificados dos Fãs](${origin}/#depoimentos-fas)`,
      `- [Clube VIP](${origin}/#clube-vip)`,
      `- [Perguntas Frequentes](${origin}/#perguntas-frequentes)`,
    ];

    if (isFull) {
      lines.push('', '## Depoimentos Verificados dos Fãs (Homens Atendidos)');
      for (const item of testimonials.slice(0, 10)) {
        lines.push(
          `- **${item.author_name}** (${item.author_location}) [${item.rating}/5 · Compra Verificada]: "${item.comment}"`
        );
      }
      lines.push('', '## Perguntas Frequentes (FAQ / Respostas Diretas)');
      for (const faq of STOREFRONT_FAQS) {
        lines.push(`### ${faq.question}`, faq.answer, '');
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(lines.join('\n'));
  });

  app.get('/.well-known/ai-discover.json', async (req: Request, res: Response) => {
    const origin = resolveOriginUrl(req);
    const { profile, stats } = await loadPublicSeoSnapshot();
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.json({
      name: `Vídeo Chamada Modelo Feminina Atraente ${profile.display_name}`,
      language: 'pt-BR',
      canonical_url: `${origin}/`,
      llms_txt: `${origin}/llms.txt`,
      llms_full_txt: `${origin}/llms-full.txt`,
      sitemap_xml: `${origin}/sitemap.xml`,
      schema_org: buildStorefrontJsonLd(profile, stats, origin),
    });
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

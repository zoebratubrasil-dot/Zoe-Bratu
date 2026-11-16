import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw, PlusCircle, Link2, Download } from 'lucide-react';
import type { SupabaseStatus } from '../../types';

interface SupabaseSetupProps {
  creatorToken: string;
  status: SupabaseStatus | null;
  onRefreshStatus: () => Promise<void>;
}

type SetupMode = 'existing' | 'create_new';

export const SupabaseSetup: React.FC<SupabaseSetupProps> = ({ creatorToken, status, onRefreshStatus }) => {
  const [mode, setMode] = useState<SetupMode>('existing');

  // Existing project form
  const [supabaseUrl, setSupabaseUrl] = useState(status?.projectUrl || '');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [existingAccessToken, setExistingAccessToken] = useState('');

  // Create new project form
  const [accessToken, setAccessToken] = useState('');
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [projectName, setProjectName] = useState('maison-prive-db');
  const [region, setRegion] = useState('sa-east-1');
  const [dbPass, setDbPass] = useState('');
  const [provisioningRef, setProvisioningRef] = useState<string | null>(null);
  const [provisioningStatus, setProvisioningStatus] = useState<string>('');

  // SQL modal/viewer
  const [schemaSql, setSchemaSql] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [busy, setBusy] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/supabase/schema')
      .then((r) => r.json())
      .then((d) => setSchemaSql(d.sql || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status?.projectUrl && !supabaseUrl) {
      setSupabaseUrl(status.projectUrl);
    }
  }, [status?.projectUrl, supabaseUrl]);

  const handleCopySql = async () => {
    if (!schemaSql) return;
    await navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/supabase/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl,
          anonKey,
          serviceRoleKey,
          databaseUrl: databaseUrl || undefined,
          accessToken: existingAccessToken || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMessage({ type: 'err', text: data.error || 'Erro ao conectar Supabase.' });
      } else {
        setMessage({
          type: 'ok',
          text: data.status?.schemaReady
            ? 'Supabase conectado, buckets configurados e banco de dados pronto!'
            : `${data.message} Falta executar o SQL abaixo no SQL Editor do Supabase caso ainda não tenha criado as tabelas.`,
        });
        if (!data.status?.schemaReady) {
          setShowSql(true);
        }
        await onRefreshStatus();
      }
    } catch {
      setMessage({ type: 'err', text: 'Erro de rede ao testar conexão Supabase.' });
    } finally {
      setBusy(false);
    }
  };

  const handleLoadOrgs = async () => {
    setMessage(null);
    if (!accessToken.trim()) {
      setMessage({ type: 'err', text: 'Cole seu Personal Access Token (sbp_...) do Supabase.' });
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch('/api/supabase/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMessage({ type: 'err', text: data.error || 'Token inválido.' });
      } else {
        const list = data.organizations || [];
        setOrganizations(list);
        if (list.length > 0) setSelectedOrgId(list[0].id);
        setMessage({ type: 'ok', text: `${list.length} organização(ões) encontrada(s).` });
      }
    } catch {
      setMessage({ type: 'err', text: 'Erro ao consultar organizações no Supabase.' });
    } finally {
      setBusy(false);
    }
  };

  const handleProvisionNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/supabase/provision-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          organizationId: selectedOrgId,
          name: projectName,
          region,
          dbPass,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMessage({ type: 'err', text: data.error || 'Falha ao criar projeto.' });
        setBusy(false);
        return;
      }

      const ref = data.projectRef;
      setProvisioningRef(ref);
      setProvisioningStatus('Projeto criado! Aguardando inicialização do Postgres (30-90s)...');

      // Poll finalize-project until ready
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const finResp = await fetch('/api/supabase/finalize-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, projectRef: ref }),
        });
        const finData = await finResp.json();
        if (!finResp.ok) {
          setMessage({ type: 'err', text: finData.error || 'Erro ao configurar projeto.' });
          setBusy(false);
          return;
        }
        if (finData.ready) {
          setProvisioningStatus('');
          setProvisioningRef(null);
          setMessage({
            type: 'ok',
            text: `Projeto "${projectName}" criado, tabelas instaladas e Storage conectado com sucesso!`,
          });
          await onRefreshStatus();
          setBusy(false);
        } else if (attempts < 24) {
          setProvisioningStatus(`Inicializando banco (${finData.projectStatus || 'PROVISIONING'})... tentativa ${attempts}/24`);
          setTimeout(poll, 5000);
        } else {
          setMessage({
            type: 'err',
            text: 'O projeto está demorando para iniciar no Supabase. Clique em "Verificar Novamente" em 30 segundos.',
          });
          setBusy(false);
        }
      };

      setTimeout(poll, 5000);
    } catch {
      setMessage({ type: 'err', text: 'Erro ao criar projeto no Supabase.' });
      setBusy(false);
    }
  };

  const handleFinalizeManually = async () => {
    if (!provisioningRef || !accessToken) return;
    setBusy(true);
    try {
      const resp = await fetch('/api/supabase/finalize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, projectRef: provisioningRef }),
      });
      const data = await resp.json();
      if (data.ready) {
        setProvisioningRef(null);
        setProvisioningStatus('');
        setMessage({ type: 'ok', text: 'Projeto finalizado, tabelas criadas e conectado!' });
        await onRefreshStatus();
      } else {
        setMessage({ type: 'err', text: `Status atual no Supabase: ${data.projectStatus}` });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/creator/export-zip', {
        headers: { 'x-creator-token': creatorToken },
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setMessage({ type: 'err', text: errData.error || 'Erro ao exportar código.' });
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'maison-prive-codigo.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'err', text: 'Erro de rede ao baixar o arquivo ZIP.' });
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/20 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#524B45]">
            Infraestrutura & Backup
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Conexão & Provisionamento Supabase
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Crie um projeto novo no seu Supabase ou conecte um projeto existente para armazenar mídias, assinantes e vendas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportZip}
            disabled={exportingZip}
            className="inline-flex items-center gap-2 rounded-sm bg-[#181615] px-3.5 py-2 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {exportingZip ? 'Gerando .zip...' : 'Exportar Código (.zip)'}
          </button>
          <button
            type="button"
            onClick={onRefreshStatus}
            className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-3.5 py-2 text-xs font-semibold text-[#181615] hover:border-[#181615] hover:bg-[#E7E1D9] transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Verificar Conexão
          </button>
        </div>
      </div>

      {/* Live Connection Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#181615]/20 rounded-sm border border-[#181615]/20 bg-[#F3EFEA]">
        <div className="p-5 space-y-1">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#524B45]">API Supabase</p>
          <div className="flex items-center gap-2 text-sm font-bold">
            {status?.connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-900">Conectado</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-amber-900">Não configurado</span>
              </>
            )}
          </div>
          {status?.projectUrl && (
            <p className="font-mono text-xs text-[#524B45] truncate">{status.projectUrl}</p>
          )}
        </div>

        <div className="p-5 space-y-1">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#524B45]">
            Banco Postgres (5 Tabelas)
          </p>
          <div className="flex items-center gap-2 text-sm font-bold">
            {status?.schemaReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-900">Tabelas Ativas</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-amber-900">
                  Faltando ({status?.missingTables?.length || 5})
                </span>
              </>
            )}
          </div>
          {!status?.schemaReady && status?.missingTables?.length ? (
            <p className="font-mono text-xs text-[#524B45] truncate">
              {status.missingTables.join(', ')}
            </p>
          ) : null}
        </div>

        <div className="p-5 space-y-1">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#524B45]">
            Storage (Fotos e Vídeos)
          </p>
          <div className="flex items-center gap-2 text-sm font-bold">
            {status?.bucketsReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-900">Buckets Prontos</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-amber-900">Aguardando buckets</span>
              </>
            )}
          </div>
          <p className="font-mono text-xs text-[#524B45]">creator-media · creator-previews</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-sm bg-[#EFEBE5] border border-[#181615]/20 w-fit">
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
            mode === 'existing'
              ? 'bg-[#181615] text-[#FAF8F5] font-semibold'
              : 'text-[#524B45] hover:text-[#181615]'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          Conectar Projeto Existente
        </button>
        <button
          type="button"
          onClick={() => setMode('create_new')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
            mode === 'create_new'
              ? 'bg-[#181615] text-[#FAF8F5] font-semibold'
              : 'text-[#524B45] hover:text-[#181615]'
          }`}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Criar Novo Projeto no Supabase
        </button>
      </div>

      {message && (
        <div
          className={`rounded-sm border p-4 text-xs ${
            message.type === 'ok'
              ? 'border-emerald-700/35 bg-emerald-50 text-emerald-900'
              : 'border-rose-700/35 bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* MODE A: CONNECT EXISTING */}
      {mode === 'existing' && (
        <form onSubmit={handleConnectExisting} className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                Project URL (Supabase)
              </label>
              <input
                type="url"
                required
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://seuprojeto.supabase.co"
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                Anon / Publishable Key
              </label>
              <input
                type="text"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                Service Role Key (obrigatória para Storage privado e gestão do banco)
              </label>
              <input
                type="password"
                required
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOi... (Settings → API → service_role)"
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-[#181615]/15 pt-5 space-y-4">
            <p className="text-xs font-bold text-[#181615]">
              Criação Automática das Tabelas (opcional — ou use o SQL Editor abaixo)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#524B45] mb-1.5">
                  Postgres Connection String (URI)
                </label>
                <input
                  type="password"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  placeholder="postgresql://postgres:SENHA@db.xxxx.supabase.co:5432/postgres"
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#524B45] mb-1.5">
                  Ou Supabase Access Token (sbp_...)
                </label>
                <input
                  type="password"
                  value={existingAccessToken}
                  onChange={(e) => setExistingAccessToken(e.target.value)}
                  placeholder="sbp_..."
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-sm bg-[#181615] px-5 py-2.5 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Database className="h-4 w-4" />
              {busy ? 'Conectando...' : 'Conectar & Criar Buckets'}
            </button>
            <button
              type="button"
              onClick={() => setShowSql((v) => !v)}
              className="rounded-sm border border-[#181615]/30 bg-white px-4 py-2.5 text-xs font-semibold text-[#181615] hover:border-[#181615] transition-colors cursor-pointer"
            >
              {showSql ? 'Ocultar SQL' : 'Ver SQL das Tabelas (schema.sql)'}
            </button>
          </div>
        </form>
      )}

      {/* MODE B: CREATE BRAND NEW PROJECT */}
      {mode === 'create_new' && (
        <form onSubmit={handleProvisionNewProject} className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-6 space-y-5">
          <p className="text-xs text-[#524B45]">
            Gere um Personal Access Token em{' '}
            <span className="font-mono font-semibold text-[#181615]">supabase.com/dashboard/account/tokens</span>{' '}
            para criar o projeto, o banco de dados Postgres e os buckets de fotos/vídeos automaticamente.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                Supabase Personal Access Token
              </label>
              <input
                type="password"
                required
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="sbp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleLoadOrgs}
              disabled={busy}
              className="rounded-sm border border-[#181615]/30 bg-white px-4 py-2.5 text-xs font-semibold text-[#181615] hover:border-[#181615] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Carregar Organizações
            </button>
          </div>

          {organizations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#181615]/15">
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">Organização</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">Nome do Novo Projeto</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">Região do Servidor</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                >
                  <option value="sa-east-1">América do Sul (São Paulo — sa-east-1)</option>
                  <option value="us-east-1">EUA Leste (us-east-1)</option>
                  <option value="eu-west-1">Europa Oeste (eu-west-1)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">Senha forte do Postgres</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={dbPass}
                  onChange={(e) => setDbPass(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2.5 text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-sm bg-[#181615] px-5 py-2.5 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {busy ? 'Provisionando Projeto...' : 'Criar Projeto, Banco e Storage'}
                </button>
                {provisioningRef && !busy && (
                  <button
                    type="button"
                    onClick={handleFinalizeManually}
                    className="rounded-sm border border-[#181615]/30 bg-white px-4 py-2.5 text-xs font-semibold text-[#181615] hover:border-[#181615] cursor-pointer"
                  >
                    Verificar Novamente ({provisioningRef})
                  </button>
                )}
              </div>

              {provisioningStatus && (
                <p className="md:col-span-2 text-xs text-[#8A5A00] font-mono font-semibold">{provisioningStatus}</p>
              )}
            </div>
          )}
        </form>
      )}

      {/* SQL Viewer / Copy Fallback */}
      {(showSql || (status?.connected && !status?.schemaReady)) && (
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#181615]">
                Script SQL do Banco de Dados (supabase/schema.sql)
              </h3>
              <p className="text-xs text-[#524B45] mt-0.5">
                Caso não tenha usado o provisionamento automático, cole este script no SQL Editor do painel Supabase e clique em Run.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#181615] hover:border-[#181615] shrink-0 cursor-pointer"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSql ? 'Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-sm border border-[#181615] bg-[#181615] p-4 font-mono text-xs text-[#FAF8F5] leading-relaxed">
            {schemaSql}
          </pre>
        </div>
      )}
    </div>
  );
};

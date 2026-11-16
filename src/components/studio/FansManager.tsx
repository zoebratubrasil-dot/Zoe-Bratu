import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Search,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  ShieldOff,
  Mail,
  Send,
  Rocket,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { FanAccount, WelcomeEmailOverview } from '../../types';
import { formatDateShort } from '../../lib/format';

interface FansManagerProps {
  creatorToken: string;
  fans: FanAccount[];
  supabaseReady: boolean;
  onRefresh: () => Promise<void>;
}

export const FansManager: React.FC<FansManagerProps> = ({
  creatorToken,
  fans,
  supabaseReady,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<'fans' | 'welcome_email'>('fans');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'vip' | 'standard'>('all');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsVip, setNewIsVip] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Welcome Email Edge Function state
  const [welcomeInfo, setWelcomeInfo] = useState<WelcomeEmailOverview | null>(null);
  const [loadingWelcome, setLoadingWelcome] = useState(false);
  const [resendKeyInput, setResendKeyInput] = useState('');
  const [fromEmailInput, setFromEmailInput] = useState('Maison Privé <onboarding@resend.dev>');
  const [supabasePatInput, setSupabasePatInput] = useState('');
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testTrigger, setTestTrigger] = useState<'signup' | 'first_purchase'>('signup');
  const [edgeActionMsg, setEdgeActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [edgeBusy, setEdgeBusy] = useState<'save' | 'deploy' | 'test' | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<'code' | 'sql' | null>(null);

  const loadWelcomeOverview = useCallback(async () => {
    if (!creatorToken) return;
    setLoadingWelcome(true);
    try {
      const resp = await fetch('/api/creator/welcome-emails', {
        headers: { 'x-creator-token': creatorToken },
      });
      if (resp.ok) {
        const data: WelcomeEmailOverview = await resp.json();
        setWelcomeInfo(data);
        if (data.fromEmail) setFromEmailInput(data.fromEmail);
      }
    } finally {
      setLoadingWelcome(false);
    }
  }, [creatorToken]);

  useEffect(() => {
    if (subTab === 'welcome_email') {
      loadWelcomeOverview();
    }
  }, [subTab, loadWelcomeOverview]);

  const isFanVipActive = (fan: FanAccount) =>
    Boolean(fan.is_vip) && (!fan.vip_expires_at || new Date(fan.vip_expires_at).getTime() > Date.now());

  const filteredFans = useMemo(() => {
    return fans.filter((f) => {
      const vipActive = isFanVipActive(f);
      if (tierFilter === 'vip' && !vipActive) return false;
      if (tierFilter === 'standard' && vipActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${f.email} ${f.display_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fans, tierFilter, search]);

  const handleAddOrGrantFan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!supabaseReady) {
      setMsg({ type: 'err', text: 'Conecte o Supabase antes de gerenciar assinantes.' });
      return;
    }
    setAdding(true);
    try {
      const resp = await fetch('/api/creator/fans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          display_name: newName.trim() || undefined,
          is_vip: newIsVip,
          vip_days: 30,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setMsg({ type: 'err', text: data.error || 'Erro ao adicionar assinante.' });
      } else {
        setMsg({
          type: 'ok',
          text: newIsVip
            ? `Acesso VIP (30 dias) liberado para ${data.fan.email}!`
            : `Cadastro salvo para ${data.fan.email}.`,
        });
        setNewEmail('');
        setNewName('');
        await onRefresh();
      }
    } catch {
      setMsg({ type: 'err', text: 'Erro de rede ao cadastrar assinante.' });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateVip = async (fan: FanAccount, updates: { is_vip?: boolean; extend_days?: number }) => {
    setBusyId(fan.id);
    setMsg(null);
    try {
      const resp = await fetch(`/api/creator/fans/${fan.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify(updates),
      });
      if (resp.ok) {
        await onRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setEdgeActionMsg(null);
    setEdgeBusy('save');
    try {
      const resp = await fetch('/api/creator/welcome-emails/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          resendApiKey: resendKeyInput.trim() || undefined,
          fromEmail: fromEmailInput.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setEdgeActionMsg({ type: 'err', text: data.error || 'Erro ao salvar provedor de e-mail.' });
      } else {
        setEdgeActionMsg({ type: 'ok', text: 'Configuração de envio salva com sucesso.' });
        setResendKeyInput('');
        await loadWelcomeOverview();
      }
    } catch {
      setEdgeActionMsg({ type: 'err', text: 'Erro de conexão ao salvar configuração.' });
    } finally {
      setEdgeBusy(null);
    }
  };

  const handleDeployEdgeFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    setEdgeActionMsg(null);
    if (!supabasePatInput.trim()) {
      setEdgeActionMsg({
        type: 'err',
        text: 'Informe seu Token Pessoal do Supabase (sbp_...) para publicar a Edge Function.',
      });
      return;
    }
    setEdgeBusy('deploy');
    try {
      const resp = await fetch('/api/creator/welcome-emails/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          accessToken: supabasePatInput.trim(),
          resendApiKey: resendKeyInput.trim() || undefined,
          fromEmail: fromEmailInput.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setEdgeActionMsg({ type: 'err', text: data.error || 'Falha ao publicar Edge Function.' });
      } else {
        setEdgeActionMsg({
          type: 'ok',
          text: `Edge Function "${data.functionSlug}" publicada e tabela de logs configurada no Supabase!`,
        });
        setSupabasePatInput('');
        setResendKeyInput('');
        await loadWelcomeOverview();
      }
    } catch {
      setEdgeActionMsg({ type: 'err', text: 'Erro de rede ao publicar Edge Function.' });
    } finally {
      setEdgeBusy(null);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEdgeActionMsg(null);
    if (!testEmailInput.trim() || !testEmailInput.includes('@')) {
      setEdgeActionMsg({ type: 'err', text: 'Informe um e-mail válido para testar o disparo.' });
      return;
    }
    setEdgeBusy('test');
    try {
      const resp = await fetch('/api/creator/welcome-emails/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          email: testEmailInput.trim(),
          triggerSource: testTrigger,
        }),
      });
      const data = await resp.json();
      if (data.status === 'sent') {
        setEdgeActionMsg({
          type: 'ok',
          text: `E-mail de boas-vindas disparado para ${testEmailInput.trim()} via ${data.provider}!`,
        });
      } else if (data.status === 'pending_config') {
        setEdgeActionMsg({
          type: 'err',
          text:
            data.error ||
            'Disparo registrado como pendente: configure RESEND_API_KEY ou publique a Edge Function.',
        });
      } else {
        setEdgeActionMsg({
          type: 'err',
          text: data.error || 'Não foi possível concluir o envio de teste.',
        });
      }
      await loadWelcomeOverview();
    } catch {
      setEdgeActionMsg({ type: 'err', text: 'Erro de rede ao testar envio.' });
    } finally {
      setEdgeBusy(null);
    }
  };

  const handleCopyText = async (text: string, type: 'code' | 'sql') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(type);
      setTimeout(() => setCopiedBlock(null), 1800);
    } catch {
      // ignore clipboard block
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#453F3B] pb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            Assinantes & Acessos VIP ({fans.length})
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie acessos VIP por e-mail e o disparo automático de boas-vindas via Supabase Edge Function.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#23201E] border border-[#453F3B] w-fit shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('fans')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === 'fans'
                ? 'bg-[#E5C158] text-[#1C1918] font-semibold'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Assinantes
          </button>
          <button
            type="button"
            onClick={() => setSubTab('welcome_email')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === 'welcome_email'
                ? 'bg-[#E5C158] text-[#1C1918] font-semibold'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Boas-Vindas (Edge)
          </button>
        </div>
      </div>

      {subTab === 'fans' ? (
        <>
          {/* Add / Grant VIP form */}
          <form
            onSubmit={handleAddOrGrantFan}
            className="rounded-xl border border-[#453F3B] bg-[#23201E] p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <UserPlus className="h-4 w-4 text-[#D4AF37]" />
              <span>Cadastrar Cliente ou Liberar VIP Manualmente</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-xs text-zinc-400 mb-1">E-mail do Cliente</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs text-zinc-400 mb-1">Nome / Apelido (opcional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Lucas SP"
                  className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newIsVip}
                    onChange={(e) => setNewIsVip(e.target.checked)}
                    className="h-4 w-4 accent-[#D4AF37]"
                  />
                  <span>VIP 30 dias</span>
                </label>
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {adding ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            {msg && (
              <div
                className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                  msg.type === 'ok'
                    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
                }`}
              >
                {msg.type === 'ok' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{msg.text}</span>
              </div>
            )}
          </form>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#23201E] border border-[#453F3B] w-fit">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'vip', label: 'VIPs Ativos' },
                  { id: 'standard', label: 'Padrão' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTierFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    tierFilter === opt.id
                      ? 'bg-[#E5C158] text-[#1C1918] font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por e-mail ou nome..."
                className="w-64 rounded-lg border border-[#453F3B] bg-[#23201E] pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          </div>

          {/* Fans Table */}
          {filteredFans.length === 0 ? (
            <div className="rounded-xl border border-[#453F3B] bg-[#23201E] p-12 text-center space-y-2">
              <p className="font-display text-lg text-zinc-200">Nenhum assinante encontrado</p>
              <p className="text-xs text-zinc-400">
                Clientes cadastrados pela vitrine ou liberados manualmente aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#453F3B] bg-[#23201E]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#453F3B] text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Assinante</th>
                    <th className="px-4 py-3 font-medium">Status VIP</th>
                    <th className="px-4 py-3 font-medium">Expira em</th>
                    <th className="px-4 py-3 font-medium">Cadastro</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#453F3B]/70">
                  {filteredFans.map((fan) => {
                    const activeVip = isFanVipActive(fan);
                    return (
                      <tr key={fan.id} className="hover:bg-[#1C1918]/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-100">{fan.email}</p>
                          {fan.display_name && <p className="text-zinc-500">{fan.display_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {activeVip ? (
                            <span className="inline-flex items-center gap-1.5 text-[#E5C158] font-medium">
                              <Crown className="h-3.5 w-3.5" />
                              VIP Ativo
                            </span>
                          ) : (
                            <span className="text-zinc-400">Conta Padrão</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400 tabular-nums">
                          {fan.vip_expires_at ? formatDateShort(fan.vip_expires_at) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-500 tabular-nums">
                          {formatDateShort(fan.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === fan.id}
                              onClick={() => handleUpdateVip(fan, { is_vip: true, extend_days: 30 })}
                              className="inline-flex items-center gap-1 rounded-md border border-[#453F3B] bg-[#1C1918] px-2.5 py-1 text-xs text-[#E5C158] hover:border-[#D4AF37] disabled:opacity-50 cursor-pointer"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                              {activeVip ? '+30 dias' : 'Ativar VIP'}
                            </button>
                            {activeVip && (
                              <button
                                type="button"
                                disabled={busyId === fan.id}
                                onClick={() => handleUpdateVip(fan, { is_vip: false })}
                                className="inline-flex items-center gap-1 rounded-md border border-[#453F3B] bg-[#1C1918] px-2.5 py-1 text-xs text-zinc-400 hover:border-rose-500 hover:text-rose-300 disabled:opacity-50 cursor-pointer"
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                Remover VIP
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* WELCOME EMAIL EDGE FUNCTION TAB */
        <div className="space-y-6">
          {/* Status Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#453F3B] rounded-xl border border-[#453F3B] bg-[#23201E]">
            <div className="p-5 space-y-1">
              <p className="text-xs text-zinc-400">Edge Function (Supabase)</p>
              <p className="text-sm font-semibold text-zinc-100">
                {loadingWelcome
                  ? 'Verificando...'
                  : welcomeInfo?.edgeDeployed
                  ? 'welcome-fan-email Ativa'
                  : 'Aguardando Deploy no Supabase'}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-xs text-zinc-400">Provedor de Envio (Resend)</p>
              <p className="text-sm font-semibold text-zinc-100">
                {welcomeInfo?.resendConfigured ? 'Chave Resend Configurada' : 'Pendente (RESEND_API_KEY)'}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-xs text-zinc-400">Gatilhos Automáticos</p>
              <p className="text-sm font-semibold text-[#E5C158]">
                Novo Cadastro & 1ª Compra
              </p>
            </div>
          </div>

          {edgeActionMsg && (
            <div
              className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs ${
                edgeActionMsg.type === 'ok'
                  ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                  : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
              }`}
            >
              {edgeActionMsg.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{edgeActionMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deploy & Email Provider Card */}
            <div className="rounded-xl border border-[#453F3B] bg-[#23201E] p-6 space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-zinc-50">
                  Publicar Edge Function & Configurar Envio
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  A Edge Function <span className="font-mono text-zinc-300">welcome-fan-email</span> garante idempotência (1 boas-vindas por fã) e dispara via Resend API.
                </p>
              </div>

              <form onSubmit={handleSaveEmailConfig} className="space-y-3 border-b border-[#453F3B] pb-5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Chave API do Resend (re_...)
                  </label>
                  <input
                    type="password"
                    value={resendKeyInput}
                    onChange={(e) => setResendKeyInput(e.target.value)}
                    placeholder={welcomeInfo?.resendConfigured ? 'Chave já salva (digite para alterar)' : 're_xxxxxxxxxxxxx'}
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Remetente (From)
                  </label>
                  <input
                    type="text"
                    value={fromEmailInput}
                    onChange={(e) => setFromEmailInput(e.target.value)}
                    placeholder="Maison Privé <boasvindas@seudominio.com>"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={edgeBusy !== null}
                  className="rounded-lg border border-[#453F3B] bg-[#1C1918] px-4 py-2 text-xs font-medium text-zinc-100 hover:border-[#D4AF37] disabled:opacity-50 cursor-pointer"
                >
                  {edgeBusy === 'save' ? 'Salvando...' : 'Salvar Credenciais de E-mail'}
                </button>
              </form>

              <form onSubmit={handleDeployEdgeFunction} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Publicar Edge Function + Logs no Supabase (1 Clique)
                  </label>
                  <input
                    type="password"
                    value={supabasePatInput}
                    onChange={(e) => setSupabasePatInput(e.target.value)}
                    placeholder="Token Pessoal Supabase (sbp_...)"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={edgeBusy !== null || !supabaseReady}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 cursor-pointer"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {edgeBusy === 'deploy' ? 'Publicando no Supabase...' : 'Publicar Edge Function no Supabase'}
                </button>
              </form>
            </div>

            {/* Manual Test Card */}
            <div className="rounded-xl border border-[#453F3B] bg-[#23201E] p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-zinc-50">
                    Testar Disparo de Boas-Vindas
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Simule imediatamente um novo cadastro ou primeira compra para validar a Edge Function e os logs.
                  </p>
                </div>

                <form onSubmit={handleSendTestEmail} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">E-mail de Destino</label>
                    <input
                      type="email"
                      required
                      value={testEmailInput}
                      onChange={(e) => setTestEmailInput(e.target.value)}
                      placeholder="fa.teste@gmail.com"
                      className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Modelo de Mensagem</label>
                    <select
                      value={testTrigger}
                      onChange={(e) => setTestTrigger(e.target.value as 'signup' | 'first_purchase')}
                      className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3 py-2 text-xs text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="signup">Boas-Vindas de Novo Cadastro</option>
                      <option value="first_purchase">Boas-Vindas de Primeira Compra</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={edgeBusy !== null || !supabaseReady}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {edgeBusy === 'test' ? 'Disparando...' : 'Testar Disparo Agora'}
                  </button>
                </form>
              </div>

              {welcomeInfo && (
                <div className="border-t border-[#453F3B] pt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(welcomeInfo.edgeFunctionCode, 'code')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-[11px] text-zinc-300 hover:border-zinc-500 cursor-pointer"
                  >
                    {copiedBlock === 'code' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar Código Edge (.ts)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyText(welcomeInfo.migrationSql, 'sql')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-[11px] text-zinc-300 hover:border-zinc-500 cursor-pointer"
                  >
                    {copiedBlock === 'sql' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar SQL da Tabela de Logs
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dispatch History Ledger */}
          <div className="rounded-xl border border-[#453F3B] bg-[#23201E] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#453F3B]">
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-100">
                  Histórico de Disparos Automáticos
                </h3>
                <p className="text-xs text-zinc-400">
                  Registros de novos fãs e primeiras compras processados pela orquestração Edge.
                </p>
              </div>
              <button
                type="button"
                onClick={loadWelcomeOverview}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-xs text-zinc-300 hover:border-[#D4AF37] cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingWelcome ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {welcomeInfo?.schemaNeedsMigration ? (
              <div className="p-6 text-xs text-amber-200">
                A tabela <span className="font-mono">welcome_email_logs</span> ainda não foi criada no seu Supabase. Use o botão "Publicar Edge Function no Supabase" acima ou execute o SQL copiado no SQL Editor do Supabase.
              </div>
            ) : !welcomeInfo || welcomeInfo.logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Nenhum disparo registrado ainda. Quando um novo fã se cadastrar ou fizer a 1ª compra, o registro aparecerá aqui.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#453F3B] text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">E-mail do Fã</th>
                      <th className="px-4 py-3 font-medium">Gatilho</th>
                      <th className="px-4 py-3 font-medium">Provedor</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#453F3B]/70">
                    {welcomeInfo.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1C1918]/50">
                        <td className="px-4 py-3 font-medium text-zinc-100">{log.fan_email}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          {log.trigger_source === 'first_purchase'
                            ? '1ª Compra'
                            : log.trigger_source === 'signup'
                            ? 'Novo Cadastro'
                            : 'Teste Manual'}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{log.provider}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              log.status === 'sent'
                                ? 'text-emerald-300 font-medium'
                                : log.status === 'pending_config'
                                ? 'text-amber-300'
                                : log.status === 'failed'
                                ? 'text-rose-300'
                                : 'text-zinc-400'
                            }
                          >
                            {log.status === 'sent'
                              ? 'Enviado'
                              : log.status === 'pending_config'
                              ? 'Aguardando Config'
                              : log.status === 'failed'
                              ? 'Falhou'
                              : 'Ignorado'}
                          </span>
                          {log.error_message && (
                            <p className="text-[11px] text-zinc-500 mt-0.5 max-w-xs truncate" title={log.error_message}>
                              {log.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-400 tabular-nums">
                          {formatDateShort(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Crown, Search, UserPlus, CheckCircle2, AlertCircle, CalendarPlus, ShieldOff } from 'lucide-react';
import type { FanAccount } from '../../types';
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
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'vip' | 'standard'>('all');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsVip, setNewIsVip] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-800 pb-5">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">
          Assinantes & Acessos VIP ({fans.length})
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Libere acesso VIP manualmente por e-mail (ideal para confirmações de Pix direto) ou gerencie prazos ativos.
        </p>
      </div>

      {/* Add / Grant VIP form */}
      <form
        onSubmit={handleAddOrGrantFan}
        className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-4"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs text-zinc-400 mb-1">Nome / Apelido (opcional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Lucas SP"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
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
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121215] border border-zinc-800 w-fit">
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
                  ? 'bg-[#D4AF37] text-zinc-950 font-semibold'
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
            className="w-64 rounded-lg border border-zinc-800 bg-[#121215] pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>
      </div>

      {/* Fans Table */}
      {filteredFans.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-[#121215] p-12 text-center space-y-2">
          <p className="font-display text-lg text-zinc-200">Nenhum assinante encontrado</p>
          <p className="text-xs text-zinc-400">
            Clientes cadastrados pela vitrine ou liberados manualmente aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Assinante</th>
                <th className="px-4 py-3 font-medium">Status VIP</th>
                <th className="px-4 py-3 font-medium">Expira em</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filteredFans.map((fan) => {
                const activeVip = isFanVipActive(fan);
                return (
                  <tr key={fan.id} className="hover:bg-zinc-900/50 transition-colors">
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
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-[#E5C158] hover:border-[#D4AF37] disabled:opacity-50 cursor-pointer"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {activeVip ? '+30 dias' : 'Ativar VIP'}
                        </button>
                        {activeVip && (
                          <button
                            type="button"
                            disabled={busyId === fan.id}
                            onClick={() => handleUpdateVip(fan, { is_vip: false })}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:border-rose-500 hover:text-rose-300 disabled:opacity-50 cursor-pointer"
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
    </div>
  );
};

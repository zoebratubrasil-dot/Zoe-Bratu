import React, { useEffect, useMemo, useState } from 'react';
import { Video, CheckCircle2, AlertCircle, RotateCcw, Clock } from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, VideoCallPlan } from '../../types';
import { DEFAULT_VIDEO_CALL_PLANS, resolveVideoCallPlans } from '../../lib/videoCalls';
import { formatBrl, formatDateTime } from '../../lib/format';

interface VideoCallSettingsProps {
  creatorToken: string;
  profile: CreatorProfile;
  dashboard: CreatorDashboardData;
  onUpdated: () => Promise<void>;
}

export const VideoCallSettings: React.FC<VideoCallSettingsProps> = ({
  creatorToken,
  profile,
  dashboard,
  onUpdated,
}) => {
  const [plans, setPlans] = useState<VideoCallPlan[]>(() => resolveVideoCallPlans(profile.video_call_plans));
  const [saving, setSaving] = useState(false);
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setPlans(resolveVideoCallPlans(profile.video_call_plans));
  }, [profile.video_call_plans]);

  const handleStatusChange = async (saleId: string, status: 'paid' | 'pending' | 'refunded') => {
    setUpdatingSaleId(saleId);
    try {
      await fetch(`/api/creator/sales/${saleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ status }),
      });
      await onUpdated();
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const videoCallSales = useMemo(() => {
    return dashboard.sales.filter((s) => s.sale_type === 'video_call');
  }, [dashboard.sales]);

  const paidCallRevenue = useMemo(() => {
    return videoCallSales.filter((s) => s.status === 'paid').reduce((acc, s) => acc + s.amount_brl, 0);
  }, [videoCallSales]);

  const updatePlanField = <K extends keyof VideoCallPlan>(idx: number, key: K, value: VideoCallPlan[K]) => {
    setPlans((prev) =>
      prev.map((plan, i) => (i === idx ? { ...plan, [key]: value } : plan))
    );
  };

  const handleResetDefaults = () => {
    setPlans(DEFAULT_VIDEO_CALL_PLANS.map((p) => ({ ...p })));
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      if (!p.title.trim()) {
        setMsg({ type: 'err', text: `Informe o título do Plano ${i + 1}.` });
        return;
      }
      if (!Number.isFinite(Number(p.duration_minutes)) || Number(p.duration_minutes) < 1) {
        setMsg({ type: 'err', text: `A duração do Plano ${i + 1} deve ser de pelo menos 1 minuto.` });
        return;
      }
      if (!Number.isFinite(Number(p.price_brl)) || Number(p.price_brl) < 1) {
        setMsg({ type: 'err', text: `O valor em R$ do Plano ${i + 1} deve ser positivo.` });
        return;
      }
    }

    setSaving(true);
    try {
      const resp = await fetch('/api/creator/video-calls', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ plans }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Não foi possível salvar os planos.');
      }
      await onUpdated();
      setMsg({
        type: 'ok',
        text: 'Os 4 planos de Vídeo Chamada foram atualizados na vitrine pública e integrados ao checkout!',
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar planos de Vídeo Chamada.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/20 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#524B45]">
            Chamada Privativa 1 a 1 · Somente Pix
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Planos de Vídeo Chamada (1:1)
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Sessão exclusiva entre 1 internauta + modelo liberada somente perante pagamento via Pix. Edite os 4 planos abaixo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#181615] hover:border-[#181615] hover:bg-[#E7E1D9] transition-colors shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Valores Padrão
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#181615]/15 rounded-sm border border-[#181615]/20 bg-[#F3EFEA]">
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Planos Ativos na Vitrine
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {plans.filter((p) => p.active).length} / 4
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Receita em Vídeo Chamadas
          </p>
          <p className="font-mono text-2xl font-bold text-[#8A5A00] tabular-nums">
            {formatBrl(paidCallRevenue)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Reservas Registradas
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {videoCallSales.length}
          </p>
        </div>
      </div>

      {/* Editable 4 Plans Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan, idx) => (
            <div
              key={plan.id}
              className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#181615]/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-lg font-bold text-[#181615] tabular-nums">
                    0{idx + 1}.
                  </span>
                  <Video className="h-4 w-4 text-[#181615]" />
                  <span className="font-display text-lg font-bold uppercase tracking-tight text-[#181615]">
                    Plano {idx + 1}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#181615] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={(e) => updatePlanField(idx, 'active', e.target.checked)}
                    className="h-4 w-4 accent-[#181615]"
                  />
                  <span>Exibir na vitrine</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                  Nome do Plano
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={plan.title}
                  onChange={(e) => updatePlanField(idx, 'title', e.target.value)}
                  placeholder="Ex: Chamada Express"
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                    Duração (minutos)
                  </label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#524B45]" />
                    <input
                      type="number"
                      min="1"
                      max="480"
                      step="1"
                      required
                      value={plan.duration_minutes}
                      onChange={(e) => updatePlanField(idx, 'duration_minutes', Number(e.target.value))}
                      className="w-full rounded-sm border border-[#181615]/25 bg-white pl-8 pr-3 py-2 font-mono text-sm text-[#181615] tabular-nums focus:border-[#181615] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.50"
                    required
                    value={plan.price_brl}
                    onChange={(e) => updatePlanField(idx, 'price_brl', Number(e.target.value))}
                    className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2 font-mono text-sm font-bold text-[#8A5A00] tabular-nums focus:border-[#181615] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1.5">
                  Descrição curta na vitrine
                </label>
                <textarea
                  rows={2}
                  maxLength={220}
                  value={plan.description}
                  onChange={(e) => updatePlanField(idx, 'description', e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3.5 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <p className="text-[11px] font-mono text-[#524B45] pt-1">
                Prévia: {plan.duration_minutes} min · {formatBrl(plan.price_brl)}
              </p>
            </div>
          ))}
        </div>

        {msg && (
          <div
            className={`flex items-center gap-2.5 rounded-sm border p-3.5 text-xs ${
              msg.type === 'ok'
                ? 'border-emerald-700/35 bg-emerald-50 text-emerald-900'
                : 'border-rose-700/35 bg-rose-50 text-rose-900'
            }`}
          >
            {msg.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-[#181615] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? 'Salvando Planos...' : 'Salvar os 4 Planos de Vídeo Chamada'}
        </button>
      </form>

      {/* Video Call Bookings Table */}
      <div className="space-y-4 pt-4 border-t border-[#181615]/15">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#181615]">
          Reservas de Vídeo Chamada Recentes ({videoCallSales.length})
        </h3>
        {videoCallSales.length === 0 ? (
          <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-8 text-center text-xs text-[#524B45]">
            Nenhuma Vídeo Chamada reservada ainda. As compras feitas na seção de destaque da página pública aparecerão aqui com o contato do cliente.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-[#181615]/20 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#181615]/15 bg-[#F3EFEA] text-[#524B45] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-4 py-3 font-semibold">Ref</th>
                  <th className="px-4 py-3 font-semibold">Comprador & Contato</th>
                  <th className="px-4 py-3 font-semibold">Plano</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181615]/10">
                {videoCallSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="px-4 py-3 font-mono text-[#524B45] tabular-nums whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#181615] whitespace-nowrap">
                      {sale.external_ref || sale.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#181615] font-semibold">{sale.buyer_email}</p>
                      {sale.buyer_name && <p className="text-[#524B45]">{sale.buyer_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#181615]">
                      {sale.media_title || 'Vídeo Chamada ao Vivo'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#8A5A00] tabular-nums">
                      {formatBrl(sale.amount_brl)}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#181615]">
                      <select
                        value={sale.status}
                        disabled={updatingSaleId === sale.id}
                        onChange={(e) =>
                          handleStatusChange(sale.id, e.target.value as 'paid' | 'pending' | 'refunded')
                        }
                        className={`rounded-sm border border-[#181615]/25 bg-white px-2 py-1 text-xs font-semibold focus:outline-none ${
                          sale.status === 'paid'
                            ? 'text-emerald-800'
                            : sale.status === 'pending'
                            ? 'text-amber-800'
                            : 'text-rose-800'
                        }`}
                      >
                        <option value="paid">Pix Pago</option>
                        <option value="pending">Pendente Pix</option>
                        <option value="refunded">Estornado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

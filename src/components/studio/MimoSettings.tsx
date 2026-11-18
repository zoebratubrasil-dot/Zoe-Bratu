import React, { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Heart,
  Sparkles,
  Crown,
  Wine,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type {
  CreatorDashboardData,
  CreatorProfile,
  MimoGiftIcon,
  MimoGiftTier,
  MimoSectionConfig,
} from '../../types';
import { DEFAULT_MIMO_SECTION, resolveMimoSectionConfig } from '../../lib/mimoGifts';
import { formatBrl, formatDateTime } from '../../lib/format';

interface MimoSettingsProps {
  creatorToken: string;
  profile: CreatorProfile;
  dashboard: CreatorDashboardData;
  onUpdated: () => Promise<void>;
}

const ICON_OPTIONS: Array<{ value: MimoGiftIcon; label: string }> = [
  { value: 'wine', label: 'Taça de Champagne' },
  { value: 'heart', label: 'Coração' },
  { value: 'sparkles', label: 'Brilho / Sedução' },
  { value: 'crown', label: 'Coroa VIP' },
];

const renderPreviewIcon = (icon: MimoGiftIcon) => {
  if (icon === 'wine') return <Wine className="h-4 w-4 text-[#8A5A00]" />;
  if (icon === 'heart') return <Heart className="h-4 w-4 text-rose-700" />;
  if (icon === 'sparkles') return <Sparkles className="h-4 w-4 text-[#8A5A00]" />;
  return <Crown className="h-4 w-4 text-[#8A5A00]" />;
};

export const MimoSettings: React.FC<MimoSettingsProps> = ({
  creatorToken,
  profile,
  dashboard,
  onUpdated,
}) => {
  const [config, setConfig] = useState<MimoSectionConfig>(() =>
    resolveMimoSectionConfig(profile.mimo_config)
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setConfig(resolveMimoSectionConfig(profile.mimo_config));
  }, [profile.mimo_config]);

  const mimoSales = useMemo(() => {
    return dashboard.sales.filter((s) => s.sale_type === 'tip');
  }, [dashboard.sales]);

  const paidMimoRevenue = useMemo(() => {
    return mimoSales.filter((s) => s.status === 'paid').reduce((acc, s) => acc + s.amount_brl, 0);
  }, [mimoSales]);

  const updateTierField = <K extends keyof MimoGiftTier>(
    idx: number,
    key: K,
    value: MimoGiftTier[K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === idx ? { ...tier, [key]: value } : tier)),
    }));
  };

  const handleResetDefaults = () => {
    setConfig(resolveMimoSectionConfig(DEFAULT_MIMO_SECTION));
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!config.section_title.trim()) {
      setMsg({ type: 'err', text: 'Informe o título principal da vitrine de Mimos.' });
      return;
    }

    for (let i = 0; i < config.tiers.length; i++) {
      const t = config.tiers[i];
      if (!t.title.trim()) {
        setMsg({ type: 'err', text: `Informe o título do Cartão de Mimo 0${i + 1}.` });
        return;
      }
      if (!Number.isFinite(Number(t.amount_brl)) || Number(t.amount_brl) < 5) {
        setMsg({ type: 'err', text: `O valor do Cartão 0${i + 1} deve ser de pelo menos R$ 5,00.` });
        return;
      }
    }

    setSaving(true);
    try {
      const resp = await fetch('/api/creator/mimos', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ mimo_config: config }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Não foi possível salvar os cartões de Mimos.');
      }
      await onUpdated();
      setMsg({
        type: 'ok',
        text: 'Os 6 Cartões de Mimos Especiais e os textos da vitrine foram salvos e publicados!',
      });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar Mimos Especiais.',
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
            Apoio & Cortesia VIP
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            6 Cartões de Mimos Especiais
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Edite títulos, subtítulos, valores em R$, etiquetas, ícones, benefícios, destaque dourado e textos da vitrine e do modal de Mimo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#181615] hover:border-[#181615] hover:bg-[#E7E1D9] transition-colors shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Padrão
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#181615]/15 rounded-sm border border-[#181615]/20 bg-[#F3EFEA]">
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Cartões Ativos na Vitrine
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {config.tiers.filter((t) => t.active).length} / {config.tiers.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Receita em Mimos
          </p>
          <p className="font-mono text-2xl font-bold text-[#8A5A00] tabular-nums">
            {formatBrl(paidMimoRevenue)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Mimos Recebidos
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {mimoSales.length}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Showcase & Modal Texts */}
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-6 space-y-4">
          <div className="border-b border-[#181615]/15 pb-3">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#181615]">
              Textos da Vitrine & Modal de Mimo
            </h3>
            <p className="text-xs text-[#524B45]">
              Chamadas persuasivas exibidas acima dos 6 cartões na página pública e ao abrir a janela de envio de mimo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">
                Selo Superior (Kicker)
              </label>
              <input
                type="text"
                maxLength={80}
                value={config.section_kicker}
                onChange={(e) => setConfig({ ...config, section_kicker: e.target.value })}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">
                Etiqueta Lateral
              </label>
              <input
                type="text"
                maxLength={60}
                value={config.section_tag}
                onChange={(e) => setConfig({ ...config, section_tag: e.target.value })}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">
                Título Principal da Seção de Mimos
              </label>
              <input
                type="text"
                required
                maxLength={90}
                value={config.section_title}
                onChange={(e) => setConfig({ ...config, section_title: e.target.value })}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">
                  Texto Botão Principal
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={config.cta_label}
                  onChange={(e) => setConfig({ ...config, cta_label: e.target.value })}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">
                  Rodapé de Cada Cartão
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={config.card_cta_label}
                  onChange={(e) => setConfig({ ...config, card_cta_label: e.target.value })}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-semibold text-[#181615]">
                Descrição da Vitrine de Mimos (até 1.200 caracteres)
              </label>
              <span className="font-mono text-[11px] text-[#524B45] tabular-nums">
                {config.section_description.length}/1200
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={1200}
              value={config.section_description}
              onChange={(e) => setConfig({ ...config, section_description: e.target.value })}
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div className="space-y-4 pt-2 border-t border-[#181615]/10">
            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">
                Título Dentro da Janela de Mimo (Modal)
              </label>
              <input
                type="text"
                maxLength={90}
                value={config.modal_title}
                onChange={(e) => setConfig({ ...config, modal_title: e.target.value })}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-semibold text-[#181615]">
                  Descrição Dentro da Janela de Mimo (Modal — até 1.200 caracteres)
                </label>
                <span className="font-mono text-[11px] text-[#524B45] tabular-nums">
                  {config.modal_description.length}/1200
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={1200}
                value={config.modal_description}
                onChange={(e) => setConfig({ ...config, modal_description: e.target.value })}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 6 Editable Special Gift Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {config.tiers.map((tier, idx) => (
            <div
              key={tier.id}
              className={`rounded-sm border p-6 space-y-4 ${
                tier.featured
                  ? 'border-[#8A5A00] bg-[#EFE9DF]'
                  : 'border-[#181615]/20 bg-[#F3EFEA]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181615]/15 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold text-[#181615] tabular-nums">
                    0{idx + 1}.
                  </span>
                  {renderPreviewIcon(tier.icon)}
                  <span className="font-display text-lg font-bold uppercase tracking-tight text-[#181615]">
                    Cartão {idx + 1}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#181615] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tier.featured}
                      onChange={(e) => updateTierField(idx, 'featured', e.target.checked)}
                      className="h-4 w-4 accent-[#8A5A00]"
                    />
                    <span>Destaque dourado</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#181615] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tier.active}
                      onChange={(e) => updateTierField(idx, 'active', e.target.checked)}
                      className="h-4 w-4 accent-[#181615]"
                    />
                    <span>Exibir</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1">
                    Nome do Mimo
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={tier.title}
                    onChange={(e) => updateTierField(idx, 'title', e.target.value)}
                    className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1">
                    Etiqueta / Selo
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={tier.badge}
                    onChange={(e) => updateTierField(idx, 'badge', e.target.value)}
                    className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">
                  Subtítulo Chamativo
                </label>
                <input
                  type="text"
                  maxLength={90}
                  value={tier.subtitle}
                  onChange={(e) => updateTierField(idx, 'subtitle', e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="1"
                    required
                    value={tier.amount_brl}
                    onChange={(e) => updateTierField(idx, 'amount_brl', Number(e.target.value))}
                    className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 font-mono text-sm font-bold text-[#8A5A00] tabular-nums focus:border-[#181615] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#181615] mb-1">
                    Ícone do Cartão
                  </label>
                  <select
                    value={tier.icon}
                    onChange={(e) => updateTierField(idx, 'icon', e.target.value as MimoGiftIcon)}
                    className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs font-medium text-[#181615] focus:border-[#181615] focus:outline-none"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-[#181615]">
                    Descrição do Mimo / Benefício ao Presentear
                  </label>
                  <span className="font-mono text-[11px] text-[#524B45] tabular-nums">
                    {tier.perk.length}/1200
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1200}
                  value={tier.perk}
                  onChange={(e) => updateTierField(idx, 'perk', e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>

              <p className="text-[11px] font-mono text-[#524B45] flex items-center justify-between pt-1">
                <span>Prévia: {tier.title}</span>
                <span className="font-bold text-[#8A5A00]">{formatBrl(tier.amount_brl)}</span>
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
          className="inline-flex items-center gap-2 rounded-sm bg-[#181615] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Gift className="h-4 w-4 text-[#E5C158]" />
          {saving ? 'Salvando Mimos...' : 'Salvar os 6 Cartões & Textos de Mimos'}
        </button>
      </form>

      {/* Recent Mimos Table */}
      <div className="space-y-4 pt-4 border-t border-[#181615]/15">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#181615]">
          Mimos Recebidos Recentemente ({mimoSales.length})
        </h3>
        {mimoSales.length === 0 ? (
          <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-8 text-center text-xs text-[#524B45]">
            Nenhum mimo enviado ainda. Assim que um fã escolher um dos cartões na vitrine, o registro e o recado dele aparecerão aqui.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-[#181615]/20 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#181615]/15 bg-[#F3EFEA] text-[#524B45] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-4 py-3 font-semibold">Fã & Recado</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181615]/10">
                {mimoSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="px-4 py-3 font-mono text-[#524B45] tabular-nums whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#181615] font-semibold">{sale.buyer_email}</p>
                      {sale.buyer_name && <p className="text-[#524B45]">{sale.buyer_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#8A5A00] tabular-nums">
                      {formatBrl(sale.amount_brl)}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#181615]">
                      {sale.status === 'paid' ? 'Pago' : sale.status === 'pending' ? 'Pendente' : 'Estornado'}
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

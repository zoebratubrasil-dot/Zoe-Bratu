import React from 'react';
import { motion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  Crown,
  Gift,
  LogOut,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { CreatorProfile, FanAccount } from '../types';
import { formatBrl, formatDateShort } from '../lib/format';
import { computeFanLoyalty, LOYALTY_MILESTONES } from '../lib/loyalty';
import { LoyaltyBadge } from './LoyaltyBadge';

interface FanAccountPanelProps {
  fan: FanAccount;
  profile: CreatorProfile;
  onOpenVipModal: () => void;
  onOpenTipModal: () => void;
  onLogoutFan: () => void;
  onClose?: () => void;
}

const SALE_TYPE_LABELS: Record<string, string> = {
  vip_subscription: 'Clube VIP (30 dias)',
  ppv: 'Conteúdo Avulso',
  tip: 'Mimo Especial',
  video_call: 'Vídeo Chamada 1:1',
};

export const FanAccountPanel: React.FC<FanAccountPanelProps> = ({
  fan,
  profile,
  onOpenVipModal,
  onOpenTipModal,
  onLogoutFan,
  onClose,
}) => {
  const loyalty = fan.loyalty || computeFanLoyalty([]);
  const isGoldVip = loyalty.is_gold_vip;
  const recentOrders = fan.recent_orders || [];
  const displayName = fan.display_name || fan.email.split('@')[0];

  return (
    <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
      {/* Fan Profile Header with Fã VIP Ouro Badge */}
      <div
        className={`relative overflow-hidden rounded-sm border p-4 sm:p-6 ${
          isGoldVip
            ? 'border-[#E5C158] bg-gradient-to-br from-[#231D16] via-[#2F2519] to-[#1C1918]'
            : 'border-[#453F3B] bg-[#1C1918]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border font-display text-2xl font-bold uppercase ${
                isGoldVip
                  ? 'border-[#E5C158] bg-[#3A2B18] text-[#E5C158] shadow-[0_0_24px_-6px_rgba(229,193,88,0.65)]'
                  : 'border-[#453F3B] bg-[#2B2725] text-[#F4F1ED]'
              }`}
            >
              {displayName.slice(0, 1)}
              {isGoldVip && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-sm bg-[#E5C158] text-[#1C1918] shadow"
                >
                  <Crown className="h-3 w-3" />
                </span>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[#F4F1ED] truncate">
                  {displayName}
                </h2>
                <LoyaltyBadge loyalty={loyalty} size="md" />
              </div>
              <p className="text-xs text-[#C7C1BA] truncate">{fan.email}</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={`font-semibold ${
                    fan.is_vip ? 'text-[#E5C158]' : 'text-[#9B948D]'
                  }`}
                >
                  {fan.is_vip
                    ? `Clube VIP Ativo${fan.vip_expires_at ? ` · até ${formatDateShort(fan.vip_expires_at)}` : ''}`
                    : 'Assinatura VIP Inativa'}
                </span>
                <span className="text-[#6E6761]">·</span>
                <span className="text-[#C7C1BA]">
                  Membro desde {formatDateShort(fan.created_at)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onLogoutFan();
              if (onClose) onClose();
            }}
            className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-sm border border-[#453F3B] bg-[#23201E] px-3 py-1.5 text-xs font-medium text-[#C7C1BA] hover:border-rose-400/60 hover:text-rose-200 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </button>
        </div>
      </div>

      {/* Loyalty Level Progress Card */}
      <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#342F2C] pb-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#E5C158]">
              <Award className="h-3.5 w-3.5" />
              <span>Programa Nível de Lealdade · {profile.display_name}</span>
            </p>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#F4F1ED]">
              {isGoldVip
                ? 'Conquista Desbloqueada: Fã VIP Ouro'
                : `Nível Atual: ${loyalty.tier_label}`}
            </h3>
          </div>

          <div className="text-left sm:text-right">
            <p className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums">
              {loyalty.progress_percent}%
            </p>
            <p className="text-[11px] text-[#9B948D]">
              {isGoldVip ? 'Nível máximo atingido' : 'Rumo a Fã VIP Ouro'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <span className="text-[#DED9D3] font-medium">
              {isGoldVip ? (
                'Parabéns! Suas compras regulares garantiram o badge permanente de Fã VIP Ouro no seu perfil.'
              ) : loyalty.remaining_for_gold === 1 ? (
                <>
                  Falta apenas <strong className="text-[#E5C158]">1 compra regular</strong> para conquistar o badge{' '}
                  <strong className="text-[#E5C158]">Fã VIP Ouro</strong>!
                </>
              ) : (
                <>
                  Faltam <strong className="text-[#E5C158]">{loyalty.remaining_for_gold} compras regulares</strong> para conquistar o badge{' '}
                  <strong className="text-[#E5C158]">Fã VIP Ouro</strong>.
                </>
              )}
            </span>
            <span className="font-mono text-[11px] text-[#E5C158] tabular-nums shrink-0 sm:ml-2">
              {Math.min(loyalty.purchases_count, loyalty.gold_target_purchases)}/{loyalty.gold_target_purchases} compras
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={loyalty.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do Nível de Lealdade até Fã VIP Ouro"
            className="relative h-3.5 w-full overflow-hidden rounded-sm border border-[#453F3B] bg-[#12100F]"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(loyalty.progress_percent, loyalty.purchases_count > 0 ? 6 : 0)}%` }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-sm ${
                isGoldVip
                  ? 'bg-gradient-to-r from-[#B8862D] via-[#E5C158] to-[#FFF0B3]'
                  : 'bg-gradient-to-r from-[#8A611C] via-[#C99C3B] to-[#E5C158]'
              }`}
            />
          </div>

          {/* Tier Milestones */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {LOYALTY_MILESTONES.map((step) => {
              const reached = loyalty.purchases_count >= step.minPurchases || (step.id === 'gold_vip' && isGoldVip);
              return (
                <div
                  key={step.id}
                  className={`rounded-sm border px-2.5 py-2 text-center transition-colors ${
                    reached
                      ? step.id === 'gold_vip'
                        ? 'border-[#E5C158] bg-[#362815] text-[#F7DF8D]'
                        : 'border-[#E5C158]/45 bg-[#27221E] text-[#F4F1ED]'
                      : 'border-[#342F2C] bg-[#161413] text-[#7A726B]'
                  }`}
                >
                  <p className="text-[10px] font-mono uppercase tracking-wider">
                    {step.minPurchases === 0 ? 'Início' : `${step.minPurchases}+ compra${step.minPurchases > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-[11px] font-semibold mt-0.5 truncate">{step.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Loyalty Stats Grid */}
        <div className="grid grid-cols-3 divide-x divide-[#342F2C] rounded-sm border border-[#342F2C] bg-[#141211]">
          <div className="p-2.5 sm:p-3.5 text-center">
            <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#9B948D]">Compras Totais</p>
            <p className="font-mono text-base sm:text-xl font-bold text-[#F4F1ED] tabular-nums mt-0.5">
              {loyalty.purchases_count}
            </p>
          </div>
          <div className="p-2.5 sm:p-3.5 text-center">
            <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#9B948D]">Últimos 30d</p>
            <p className="font-mono text-base sm:text-xl font-bold text-[#E5C158] tabular-nums mt-0.5">
              {loyalty.recent_purchases_30d}
            </p>
          </div>
          <div className="p-2.5 sm:p-3.5 text-center">
            <p className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-[#9B948D]">Investido</p>
            <p className="font-mono text-sm sm:text-xl font-bold text-[#F4F1ED] tabular-nums mt-0.5 truncate">
              {formatBrl(loyalty.total_spent_brl)}
            </p>
          </div>
        </div>

        {/* Gold VIP Perks */}
        <div className="rounded-sm border border-[#E5C158]/30 bg-[#231D16]/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#E5C158]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Benefícios do Badge Fã VIP Ouro</span>
            </p>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#C7C1BA]">
              {isGoldVip ? 'Ativos no seu perfil' : 'Desbloqueie com 5 compras'}
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#DED9D3]">
            {loyalty.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                    isGoldVip ? 'text-[#E5C158]' : 'text-[#6E6761]'
                  }`}
                />
                <span className={isGoldVip ? 'text-[#F4F1ED]' : 'text-[#9B948D]'}>{perk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent Purchases History */}
      <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 sm:px-5 py-3.5 border-b border-[#342F2C] bg-[#181615]">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED]">
            <ShoppingBag className="h-3.5 w-3.5 text-[#E5C158]" />
            <span>Histórico de Compras & Lealdade ({recentOrders.length})</span>
          </p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#9B948D]">
            Cada compra avança seu nível
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#9B948D]">
            Nenhuma compra registrada ainda neste e-mail. Sua primeira assinatura VIP, conteúdo avulso, mimo ou vídeo chamada já inicia sua jornada!
          </div>
        ) : (
          <div className="divide-y divide-[#2B2725]">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 px-5 py-3 text-xs hover:bg-[#23201E] transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#F4F1ED] truncate">
                    {order.media_title || SALE_TYPE_LABELS[order.sale_type] || 'Compra na Vitrine'}
                  </p>
                  <p className="text-[11px] text-[#9B948D] font-mono">
                    {formatDateShort(order.created_at)} · {order.payment_method === 'pix' ? 'Pix' : 'Cartão'}
                    {order.external_ref ? ` · ${order.external_ref}` : ''}
                  </p>
                </div>
                <span className="font-mono font-semibold text-[#E5C158] tabular-nums shrink-0">
                  {formatBrl(order.amount_brl)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            onOpenVipModal();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#E5C158] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
        >
          <TrendingUp className="h-4 w-4" />
          <span>{fan.is_vip ? 'Renovar Clube VIP (+1 Compra)' : 'Assinar Clube VIP'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            onOpenTipModal();
          }}
          className="mimo-shimmer-btn inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] cursor-pointer"
        >
          <Gift className="h-4 w-4 text-[#E5C158]" />
          <span>Enviar Mimo Especial (+1 Compra)</span>
        </button>
      </div>
    </div>
  );
};

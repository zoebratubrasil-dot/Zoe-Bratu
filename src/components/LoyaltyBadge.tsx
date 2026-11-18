import React from 'react';
import { Award, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import type { FanLoyaltySummary } from '../types';

interface LoyaltyBadgeProps {
  loyalty?: FanLoyaltySummary | null;
  size?: 'xs' | 'sm' | 'md';
  showNonGoldTier?: boolean;
  className?: string;
}

export const LoyaltyBadge: React.FC<LoyaltyBadgeProps> = ({
  loyalty,
  size = 'sm',
  showNonGoldTier = true,
  className = '',
}) => {
  if (!loyalty) return null;

  if (loyalty.is_gold_vip) {
    const sizeClasses =
      size === 'xs'
        ? 'px-2 py-0.5 text-[10px] gap-1'
        : size === 'md'
        ? 'px-3 py-1.5 text-xs gap-1.5'
        : 'px-2.5 py-1 text-[11px] gap-1.5';

    return (
      <span
        className={`mimo-card-sheen inline-flex items-center rounded-sm border border-[#E5C158] bg-gradient-to-r from-[#2B2012] via-[#4A3416] to-[#2B2012] font-semibold uppercase tracking-wider text-[#F7DF8D] shadow-[0_2px_12px_-4px_rgba(229,193,88,0.55)] whitespace-nowrap shrink-0 ${sizeClasses} ${className}`}
        title="Fã VIP Ouro — Conquistado por compras regulares no acervo"
      >
        <Crown className={size === 'xs' ? 'h-3 w-3 text-[#E5C158]' : 'h-3.5 w-3.5 text-[#E5C158]'} />
        <span>Fã VIP Ouro</span>
      </span>
    );
  }

  if (!showNonGoldTier) return null;

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : size === 'md'
      ? 'px-3 py-1 text-xs gap-1.5'
      : 'px-2 py-0.5 text-[10px] gap-1';

  if (loyalty.tier_id === 'silver') {
    return (
      <span
        className={`inline-flex items-center rounded-sm border border-zinc-400/50 bg-[#2C2A29] font-semibold uppercase tracking-wider text-zinc-200 whitespace-nowrap shrink-0 ${sizeClasses} ${className}`}
      >
        <Award className="h-3 w-3 text-zinc-300" />
        <span>Fã Prata</span>
      </span>
    );
  }

  if (loyalty.tier_id === 'bronze') {
    return (
      <span
        className={`inline-flex items-center rounded-sm border border-[#B07A4A]/50 bg-[#2B211B] font-semibold uppercase tracking-wider text-[#E2B48D] whitespace-nowrap shrink-0 ${sizeClasses} ${className}`}
      >
        <Sparkles className="h-3 w-3 text-[#D4986A]" />
        <span>Fã Bronze</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-sm border border-[#453F3B] bg-[#1C1918] font-medium uppercase tracking-wider text-[#C7C1BA] whitespace-nowrap shrink-0 ${sizeClasses} ${className}`}
    >
      <ShieldCheck className="h-3 w-3 text-[#9B948D]" />
      <span>Admirador</span>
    </span>
  );
};

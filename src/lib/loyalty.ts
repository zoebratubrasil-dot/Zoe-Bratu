import type { FanLoyaltySummary, LoyaltyTierId } from '../types';

export const GOLD_VIP_PURCHASES_TARGET = 5;
export const GOLD_VIP_SPEND_FALLBACK_BRL = 250;
export const GOLD_VIP_MIN_PURCHASES_WITH_SPEND = 3;

export interface LoyaltySaleInput {
  amount_brl?: number | string | null;
  status?: string | null;
  created_at?: string | null;
}

export const GOLD_VIP_PERKS: string[] = [
  'Badge exclusivo "Fã VIP Ouro" visível no seu perfil e no painel da criadora',
  'Destaque prioritário ao enviar Mimos e dedicatórias especiais',
  'Prioridade máxima no agendamento de Vídeo Chamadas ao Vivo 1 a 1',
  'Atendimento preferencial no WhatsApp para solicitações personalizadas',
];

export const LOYALTY_MILESTONES: Array<{
  id: LoyaltyTierId;
  label: string;
  minPurchases: number;
  percent: number;
}> = [
  { id: 'admirer', label: 'Admirador', minPurchases: 0, percent: 0 },
  { id: 'bronze', label: 'Bronze', minPurchases: 1, percent: 20 },
  { id: 'silver', label: 'Prata', minPurchases: 3, percent: 60 },
  { id: 'gold_vip', label: 'Fã VIP Ouro', minPurchases: 5, percent: 100 },
];

export function computeFanLoyalty(sales: LoyaltySaleInput[]): FanLoyaltySummary {
  const paidSales = sales.filter((s) => !s.status || s.status === 'paid');
  const purchasesCount = paidSales.length;
  const totalSpentBrl = Number(
    paidSales.reduce((acc, s) => acc + Number(s.amount_brl || 0), 0).toFixed(2)
  );

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPurchases30d = paidSales.filter((s) => {
    if (!s.created_at) return false;
    const t = new Date(s.created_at).getTime();
    return Number.isFinite(t) && t >= thirtyDaysAgo;
  }).length;

  const isGoldVip =
    purchasesCount >= GOLD_VIP_PURCHASES_TARGET ||
    (purchasesCount >= GOLD_VIP_MIN_PURCHASES_WITH_SPEND &&
      totalSpentBrl >= GOLD_VIP_SPEND_FALLBACK_BRL);

  let tierId: LoyaltyTierId = 'admirer';
  let tierLabel = 'Admirador';
  let badgeLabel: string | null = null;
  let nextTierLabel: string | null = 'Fã Bronze';
  let remainingForNext = Math.max(0, 1 - purchasesCount);

  if (isGoldVip) {
    tierId = 'gold_vip';
    tierLabel = 'Fã VIP Ouro';
    badgeLabel = 'Fã VIP Ouro';
    nextTierLabel = null;
    remainingForNext = 0;
  } else if (purchasesCount >= 3 || (purchasesCount >= 2 && totalSpentBrl >= 150)) {
    tierId = 'silver';
    tierLabel = 'Fã Prata';
    badgeLabel = 'Fã Prata';
    nextTierLabel = 'Fã VIP Ouro';
    remainingForNext = Math.max(1, GOLD_VIP_PURCHASES_TARGET - purchasesCount);
  } else if (purchasesCount >= 1) {
    tierId = 'bronze';
    tierLabel = 'Fã Bronze';
    badgeLabel = 'Fã Bronze';
    nextTierLabel = 'Fã Prata';
    remainingForNext = Math.max(1, 3 - purchasesCount);
  }

  const purchaseRatio = Math.min(1, purchasesCount / GOLD_VIP_PURCHASES_TARGET);
  const spendBoostRatio =
    purchasesCount >= GOLD_VIP_MIN_PURCHASES_WITH_SPEND
      ? Math.min(1, totalSpentBrl / GOLD_VIP_SPEND_FALLBACK_BRL)
      : 0;

  const progressPercent = isGoldVip
    ? 100
    : Math.min(99, Math.round(Math.max(purchaseRatio, spendBoostRatio) * 100));

  const remainingForGold = isGoldVip
    ? 0
    : Math.max(1, GOLD_VIP_PURCHASES_TARGET - purchasesCount);

  return {
    tier_id: tierId,
    tier_label: tierLabel,
    badge_label: badgeLabel,
    is_gold_vip: isGoldVip,
    purchases_count: purchasesCount,
    recent_purchases_30d: recentPurchases30d,
    total_spent_brl: totalSpentBrl,
    gold_target_purchases: GOLD_VIP_PURCHASES_TARGET,
    remaining_for_next: remainingForNext,
    remaining_for_gold: remainingForGold,
    next_tier_label: nextTierLabel,
    progress_percent: progressPercent,
    perks: GOLD_VIP_PERKS,
  };
}

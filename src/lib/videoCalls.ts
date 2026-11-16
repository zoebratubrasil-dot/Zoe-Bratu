import type { VideoCallPlan } from '../types';

export const DEFAULT_VIDEO_CALL_PLANS: VideoCallPlan[] = [
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

export function resolveVideoCallPlans(plans?: VideoCallPlan[] | null): VideoCallPlan[] {
  if (!Array.isArray(plans) || plans.length === 0) {
    return DEFAULT_VIDEO_CALL_PLANS.map((p) => ({ ...p }));
  }
  return DEFAULT_VIDEO_CALL_PLANS.map((fallback, idx) => {
    const item = plans[idx];
    if (!item) return { ...fallback };
    return {
      id: item.id || fallback.id,
      title: item.title || fallback.title,
      duration_minutes: Number(item.duration_minutes) > 0 ? Number(item.duration_minutes) : fallback.duration_minutes,
      price_brl: Number(item.price_brl) > 0 ? Number(item.price_brl) : fallback.price_brl,
      description: item.description || fallback.description,
      active: typeof item.active === 'boolean' ? item.active : fallback.active,
    };
  });
}

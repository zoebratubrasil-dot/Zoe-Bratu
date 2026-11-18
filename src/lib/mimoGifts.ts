import type { MimoGiftIcon, MimoGiftTier, MimoSectionConfig } from '../types';

const VALID_ICONS: MimoGiftIcon[] = ['wine', 'heart', 'sparkles', 'crown'];

export const DEFAULT_MIMO_TIERS: MimoGiftTier[] = [
  {
    id: 'mimo-champagne',
    title: 'Taça de Champagne',
    subtitle: 'Um brinde elegante à Carioca',
    amount_brl: 25,
    badge: 'Gesto Carinhoso',
    perk: 'Agradecimento direto no registro do seu pedido.',
    icon: 'wine',
    featured: false,
    active: true,
  },
  {
    id: 'mimo-buque',
    title: 'Buquê Carioca',
    subtitle: 'O gesto favorito para encantar',
    amount_brl: 50,
    badge: 'Mais Escolhido',
    perk: 'Seu nome em destaque e carinho especial no recado.',
    icon: 'heart',
    featured: true,
    active: true,
  },
  {
    id: 'mimo-seducao',
    title: 'Dose de Sedução',
    subtitle: 'Presença marcante & charme',
    amount_brl: 100,
    badge: 'Destaque Dourado',
    perk: 'Prioridade total no atendimento e atenção personalizada.',
    icon: 'sparkles',
    featured: false,
    active: true,
  },
  {
    id: 'mimo-sunset',
    title: 'Brinde Sunset Copacabana',
    subtitle: 'Clima carioca & intimidade',
    amount_brl: 150,
    badge: 'Charme Carioca',
    perk: 'Reconhecimento especial e carinho redobrado na sua mensagem.',
    icon: 'wine',
    featured: false,
    active: true,
  },
  {
    id: 'mimo-vip',
    title: 'Noite de Luxo VIP',
    subtitle: 'Reconhecimento máximo 1 a 1',
    amount_brl: 200,
    badge: 'Mimo Supremo',
    perk: 'Tratamento de cavalheiro VIP e lembrança inesquecível.',
    icon: 'crown',
    featured: false,
    active: true,
  },
  {
    id: 'mimo-diamante',
    title: 'Joia da Carioca',
    subtitle: 'O presente mais desejado do acervo',
    amount_brl: 350,
    badge: 'Exclusividade Total',
    perk: 'Gesto supremo de cavalheirismo com prioridade absoluta 1 a 1.',
    icon: 'crown',
    featured: false,
    active: true,
  },
];

export const DEFAULT_MIMO_SECTION: MimoSectionConfig = {
  section_kicker: 'Experiência de Cortesia & Sedução',
  section_tag: 'Reconhecimento Direto',
  section_title: 'Envie Um Mimo Especial',
  section_description:
    'Surpreenda a Carioca com um gesto elegante, deixe seu recado secreto e faça seu nome brilhar com prioridade especial. Um cavalheiro generoso sempre desperta os melhores sorrisos e atenção redobrada.',
  cta_label: 'Enviar Mimo Agora',
  card_cta_label: 'Presentear Agora',
  modal_title: 'Surpreenda Com Um Mimo',
  modal_description:
    'Escolha um mimo abaixo ou defina um valor livre. Seu gesto ganha destaque imediato junto com seu recado pessoal para a Carioca.',
  tiers: DEFAULT_MIMO_TIERS,
};

export function sanitizeMimoTiers(input: unknown): MimoGiftTier[] {
  const arr = Array.isArray(input) ? input : [];
  const defaultIds = new Set(DEFAULT_MIMO_TIERS.map((d) => d.id));
  return DEFAULT_MIMO_TIERS.map((fallback, idx) => {
    const byId = arr.find(
      (entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).id === fallback.id
    );
    const atIndex = arr[idx] && typeof arr[idx] === 'object' ? (arr[idx] as Record<string, unknown>) : null;
    const atIndexBelongsElsewhere =
      atIndex && typeof atIndex.id === 'string' && atIndex.id !== fallback.id && defaultIds.has(atIndex.id);
    const item = ((byId && typeof byId === 'object' ? byId : !atIndexBelongsElsewhere ? atIndex : {}) ||
      {}) as Record<string, unknown>;

    const cleanStr = (val: unknown, fb: string, maxLen: number) =>
      typeof val === 'string' && val.trim() ? val.trim().slice(0, maxLen) : fb;
    const priceNum = Number(item.amount_brl);
    const iconCandidate = typeof item.icon === 'string' ? (item.icon as MimoGiftIcon) : fallback.icon;

    return {
      id: cleanStr(item.id, fallback.id, 32),
      title: cleanStr(item.title, fallback.title, 60),
      subtitle: cleanStr(item.subtitle, fallback.subtitle, 90),
      amount_brl: Number.isFinite(priceNum) && priceNum >= 5 ? Number(priceNum.toFixed(2)) : fallback.amount_brl,
      badge: cleanStr(item.badge, fallback.badge, 40),
      perk: cleanStr(item.perk, fallback.perk, 200),
      icon: VALID_ICONS.includes(iconCandidate) ? iconCandidate : fallback.icon,
      featured: typeof item.featured === 'boolean' ? item.featured : fallback.featured,
      active: typeof item.active === 'boolean' ? item.active : fallback.active,
    };
  });
}

export function sanitizeMimoSectionConfig(input: unknown): MimoSectionConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const cleanStr = (val: unknown, fallback: string, maxLen: number) =>
    typeof val === 'string' && val.trim() ? val.trim().slice(0, maxLen) : fallback;

  return {
    section_kicker: cleanStr(src.section_kicker, DEFAULT_MIMO_SECTION.section_kicker, 80),
    section_tag: cleanStr(src.section_tag, DEFAULT_MIMO_SECTION.section_tag, 60),
    section_title: cleanStr(src.section_title, DEFAULT_MIMO_SECTION.section_title, 90),
    section_description: cleanStr(src.section_description, DEFAULT_MIMO_SECTION.section_description, 420),
    cta_label: cleanStr(src.cta_label, DEFAULT_MIMO_SECTION.cta_label, 40),
    card_cta_label: cleanStr(src.card_cta_label, DEFAULT_MIMO_SECTION.card_cta_label, 40),
    modal_title: cleanStr(src.modal_title, DEFAULT_MIMO_SECTION.modal_title, 90),
    modal_description: cleanStr(src.modal_description, DEFAULT_MIMO_SECTION.modal_description, 320),
    tiers: sanitizeMimoTiers(src.tiers),
  };
}

export function resolveMimoSectionConfig(input?: Partial<MimoSectionConfig> | null): MimoSectionConfig {
  if (!input) {
    return sanitizeMimoSectionConfig(DEFAULT_MIMO_SECTION);
  }
  return sanitizeMimoSectionConfig(input);
}

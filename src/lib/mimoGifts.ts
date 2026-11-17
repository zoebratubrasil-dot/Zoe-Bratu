export interface MimoGiftTier {
  id: string;
  title: string;
  subtitle: string;
  amount_brl: number;
  badge: string;
  perk: string;
  icon: 'wine' | 'heart' | 'sparkles' | 'crown';
  featured?: boolean;
}

export const MIMO_GIFT_TIERS: MimoGiftTier[] = [
  {
    id: 'mimo-champagne',
    title: 'Taça de Champagne',
    subtitle: 'Um brinde elegante à Carioca',
    amount_brl: 25,
    badge: 'Gesto Carinhoso',
    perk: 'Agradecimento direto no registro do seu pedido.',
    icon: 'wine',
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
  },
  {
    id: 'mimo-seducao',
    title: 'Dose de Sedução',
    subtitle: 'Presença marcante & charme',
    amount_brl: 100,
    badge: 'Destaque Dourado',
    perk: 'Prioridade total no atendimento e atenção personalizada.',
    icon: 'sparkles',
  },
  {
    id: 'mimo-vip',
    title: 'Noite de Luxo VIP',
    subtitle: 'Reconhecimento máximo 1 a 1',
    amount_brl: 200,
    badge: 'Mimo Supremo',
    perk: 'Tratamento de cavalheiro VIP e lembrança inesquecível.',
    icon: 'crown',
  },
];

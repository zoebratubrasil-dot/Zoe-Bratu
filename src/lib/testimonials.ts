import type { FanTestimonial, TestimonialCategory } from '../types';

const VALID_CATEGORIES: TestimonialCategory[] = [
  'video_call',
  'instagram',
  'vip_subscription',
  'ppv',
  'tip',
];

export const TESTIMONIAL_CATEGORY_LABELS: Record<TestimonialCategory, string> = {
  video_call: 'Vídeo Chamada 1:1',
  instagram: 'Mensagens no Instagram',
  vip_subscription: 'Clube VIP · Fotos & Vídeos',
  ppv: 'Fotos & Vídeos Avulsos',
  tip: 'Mimo & Atendimento VIP',
};

export const DEFAULT_FAN_TESTIMONIALS: FanTestimonial[] = [
  {
    id: 'testi-1',
    author_name: 'Rafael Monteiro',
    author_location: 'São Paulo, SP',
    category: 'video_call',
    rating: 5,
    comment:
      'Reservei a vídeo chamada privativa 1:1 com a Lorena e a atuação dela ao vivo é simplesmente envolvente demais. Olhar direto na câmera, voz calma e uma presença marcante que faz o homem se sentir único, como se tudo ao redor parasse só para nós dois. Talento e entrega raros.',
    verified_purchase: true,
    loyalty_label: 'Fã VIP Ouro',
    is_published: true,
    featured: true,
    created_at: '2026-10-18T21:30:00.000Z',
  },
  {
    id: 'testi-2',
    author_name: 'Henrique Vasconcelos',
    author_location: 'Belo Horizonte, MG',
    category: 'instagram',
    rating: 5,
    comment:
      'Adquiri o acesso e combinei com a Lorena as mensagens exclusivas no Instagram. Ela cumpriu cada detalhe exatamente como combinado, com atenção verdadeira e carinho fora do comum. Dá para sentir o talento e a dedicação no que ela faz para deixar o homem se sentir único.',
    verified_purchase: true,
    loyalty_label: 'Fã VIP Ouro',
    is_published: true,
    featured: true,
    created_at: '2026-10-29T19:15:00.000Z',
  },
  {
    id: 'testi-3',
    author_name: 'Gabriel Silveira',
    author_location: 'Rio de Janeiro, RJ',
    category: 'vip_subscription',
    rating: 5,
    comment:
      'Sou assinante do Clube VIP e o material fotográfico e os vídeos no site são de altíssimo nível. Iluminação cinematográfica, poses elegantes e produção feita com muito capricho — dá para notar a dedicação e o talento da Lorena em cada ensaio 4K da galeria.',
    verified_purchase: true,
    loyalty_label: 'Fã VIP Ouro',
    is_published: true,
    featured: false,
    created_at: '2026-11-04T23:10:00.000Z',
  },
  {
    id: 'testi-4',
    author_name: 'Lucas Cavalcanti',
    author_location: 'Curitiba, PR',
    category: 'video_call',
    rating: 5,
    comment:
      'A vídeo chamada de 30 minutos com a Lorena superou qualquer expectativa. Ela domina a câmera com sensualidade natural, conversa envolvente e uma atuação intensa que deixa o homem completamente à vontade, valorizado e único do início ao fim.',
    verified_purchase: true,
    loyalty_label: 'Fã Prata',
    is_published: true,
    featured: false,
    created_at: '2026-11-09T20:45:00.000Z',
  },
  {
    id: 'testi-5',
    author_name: 'Matheus Almeida',
    author_location: 'Florianópolis, SC',
    category: 'ppv',
    rating: 5,
    comment:
      'Desbloqueei ensaios e vídeos avulsos aqui no site e fiquei impressionado com o acabamento visual. A Lorena tem muito talento diante das lentes: cada foto e cada vídeo mostram dedicação absoluta nos detalhes e entregam uma proximidade real.',
    verified_purchase: true,
    loyalty_label: 'Fã Prata',
    is_published: true,
    featured: false,
    created_at: '2026-11-12T18:20:00.000Z',
  },
  {
    id: 'testi-6',
    author_name: 'Eduardo Nogueira',
    author_location: 'Brasília, DF',
    category: 'instagram',
    rating: 5,
    comment:
      'Depois do meu mimo especial, recebi todas as mensagens no Instagram exatamente como combinado no horário acertado. A forma atenciosa e dedicada com que a Lorena trata cada conversa prova seu talento: ela realmente sabe fazer o homem se sentir único.',
    verified_purchase: true,
    loyalty_label: 'Fã VIP Ouro',
    is_published: true,
    featured: false,
    created_at: '2026-11-15T22:05:00.000Z',
  },
];

export function sanitizeTestimonials(input: unknown, options?: { stripEmail?: boolean }): FanTestimonial[] {
  if (!Array.isArray(input)) {
    return DEFAULT_FAN_TESTIMONIALS.map((item) => ({ ...item }));
  }

  const cleanStr = (val: unknown, fallback: string, maxLen: number) =>
    typeof val === 'string' && val.trim() ? val.trim().slice(0, maxLen) : fallback;

  const list: FanTestimonial[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const comment = cleanStr(item.comment, '', 600);
    const authorName = cleanStr(item.author_name, '', 60);
    if (!comment || !authorName) continue;

    const categoryCandidate = typeof item.category === 'string' ? (item.category as TestimonialCategory) : 'vip_subscription';
    const ratingNum = Number(item.rating);
    const clampedRating = Number.isFinite(ratingNum) ? Math.min(5, Math.max(1, Math.round(ratingNum))) : 5;
    const createdAtRaw = typeof item.created_at === 'string' && !Number.isNaN(Date.parse(item.created_at))
      ? item.created_at
      : new Date().toISOString();

    const record: FanTestimonial = {
      id: cleanStr(item.id, `testi-${Date.now()}-${i}`, 48),
      author_name: authorName,
      author_location: cleanStr(item.author_location, 'Brasil', 50),
      category: VALID_CATEGORIES.includes(categoryCandidate) ? categoryCandidate : 'vip_subscription',
      rating: clampedRating,
      comment,
      verified_purchase: typeof item.verified_purchase === 'boolean' ? item.verified_purchase : true,
      loyalty_label:
        typeof item.loyalty_label === 'string' && item.loyalty_label.trim()
          ? item.loyalty_label.trim().slice(0, 32)
          : null,
      is_published: typeof item.is_published === 'boolean' ? item.is_published : true,
      featured: typeof item.featured === 'boolean' ? item.featured : false,
      created_at: createdAtRaw,
    };

    if (!options?.stripEmail && typeof item.author_email === 'string' && item.author_email.trim()) {
      record.author_email = item.author_email.trim().toLowerCase().slice(0, 120);
    }

    list.push(record);
  }

  return list;
}

export function resolveTestimonials(input?: FanTestimonial[] | null): FanTestimonial[] {
  if (!input || input.length === 0) {
    return DEFAULT_FAN_TESTIMONIALS.map((item) => ({ ...item }));
  }
  return sanitizeTestimonials(input, { stripEmail: true });
}

export function computeTestimonialStats(items: FanTestimonial[]) {
  const published = items.filter((item) => item.is_published);
  const totalCount = published.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      verifiedCount: 0,
      averageRating: 5.0,
      satisfactionPercent: 100,
    };
  }
  const verifiedCount = published.filter((item) => item.verified_purchase).length;
  const ratingSum = published.reduce((acc, item) => acc + item.rating, 0);
  const positiveCount = published.filter((item) => item.rating >= 4).length;

  return {
    totalCount,
    verifiedCount,
    averageRating: Number((ratingSum / totalCount).toFixed(1)),
    satisfactionPercent: Math.round((positiveCount / totalCount) * 100),
  };
}

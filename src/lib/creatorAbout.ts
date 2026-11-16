import type { CreatorAboutContent } from '../types';

export const DEFAULT_CREATOR_ABOUT: CreatorAboutContent = {
  headline_tag: 'Rio de Janeiro · Carioca Autêntica',
  carioca_title: 'Charme Carioca, Beleza, Inteligência & Feminilidade',
  carioca_bio:
    'Carioca da gema, apaixonada por boas conversas e pela arte de encantar nos detalhes. Reúne beleza solar, feminilidade extrema, educação impecável e uma inteligência envolvente que transforma cada encontro — nas fotos ou ao vivo — em uma experiência intensamente sexy, elegante e inesquecível.',
  carioca_traits: [
    'Charme & Educação Impecável',
    'Inteligência & Papo Envolvente',
    'Extremamente Feminina',
    'Sexy na Medida Certa',
  ],
  site_how_title: 'Como o Site Funciona · Tecnologia Privada',
  site_how_intro:
    'Plataforma projetada com arquitetura privada de streaming: você navega pelas prévias em rolo de filme, salva seus ensaios favoritos no próprio aparelho e desbloqueia fotos VIP, vídeos avulsos ou chamadas ao vivo com entrega segura direto no seu acesso.',
  site_steps: [
    {
      id: 'step-1',
      step: '01',
      title: 'Explore & Favorite',
      description: 'Assista às prévias gratuitas nos rolos 35mm e clique no coração para montar sua lista privada de favoritos.',
    },
    {
      id: 'step-2',
      step: '02',
      title: 'Escolha VIP, Avulso ou Chamada',
      description: 'Assine o Clube VIP para liberar todo o acervo, compre um item avulso ou reserve sua vídeo chamada 1 a 1.',
    },
    {
      id: 'step-3',
      step: '03',
      title: 'Pix Instantâneo & WhatsApp',
      description: 'Finalize o pagamento em segundos e envie seu comprovante com 1 clique pelo WhatsApp para confirmação ágil.',
    },
    {
      id: 'step-4',
      step: '04',
      title: 'Streaming Criptografado',
      description: 'Mídias reproduzidas por túnel protegido sem exposição de link e sala de vídeo fechada exclusiva para você.',
    },
  ],
  videocall_title: 'Como Aproveitar Esta Carioca na Vídeo Chamada',
  videocall_intro:
    'Mais do que uma ligação comum: é um encontro particular em câmera 4K dedicado só a você. Use a criatividade para conduzir o ritmo — do papo inteligente e sorrisos provocantes à realização de desejos e poses sob medida em tempo real.',
  videocall_experiences: [
    {
      id: 'exp-1',
      badge: 'Modo 01 · Química & Olhar',
      title: 'Sedução Olho no Olho & Sotaque Carioca',
      subtitle: 'Conexão íntima em câmera próxima',
      description:
        'Comece quebrando o gelo com a simpatia e a voz envolvente de quem sabe conduzir o clima. Peça ângulos favoritos, troque olhares sem pressa e sinta a atenção 100% voltada para você.',
      duration_hint: 'Ideal: 5 a 15 min',
    },
    {
      id: 'exp-2',
      badge: 'Modo 02 · Mente & Desejo',
      title: 'Papo Inteligente que Esquenta o Clima',
      subtitle: 'Elegância, cumplicidade e fantasia',
      description:
        'A inteligência e a educação dela tornam a conversa naturalmente excitante. Compartilhe suas ideias, descubra curiosidades e deixe a tensão crescer em diálogo aberto e sem roteiros engessados.',
      duration_hint: 'Ideal: 15 a 30 min',
    },
    {
      id: 'exp-3',
      badge: 'Modo 03 · Direção Criativa',
      title: 'Você Dirige a Cena em 4K Privado',
      subtitle: 'Personalização total ao vivo',
      description:
        'Escolha o figurino, a iluminação, a música de fundo e o ritmo da câmera. Como a sala é exclusiva de quem comprou, você conduz cada minuto com liberdade, respeito e muita química.',
      duration_hint: 'Ideal: 30 a 60 min',
    },
  ],
  signature_quote:
    '“Elegância para conversar, feminilidade em cada gesto e intensidade ao vivo só para quem entra na minha sala.”',
};

export function sanitizeCreatorAboutContent(input: unknown): CreatorAboutContent {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const cleanStr = (val: unknown, fallback: string, maxLen = 600) =>
    typeof val === 'string' && val.trim() ? val.trim().slice(0, maxLen) : fallback;

  const rawTraits = Array.isArray(src.carioca_traits) ? src.carioca_traits : [];
  const carioca_traits = DEFAULT_CREATOR_ABOUT.carioca_traits.map((fallback, idx) =>
    cleanStr(rawTraits[idx], fallback, 60)
  );

  const rawSteps = Array.isArray(src.site_steps) ? src.site_steps : [];
  const site_steps = DEFAULT_CREATOR_ABOUT.site_steps.map((fallback, idx) => {
    const item = (rawSteps[idx] && typeof rawSteps[idx] === 'object' ? rawSteps[idx] : {}) as Record<string, unknown>;
    return {
      id: cleanStr(item.id, fallback.id, 24),
      step: cleanStr(item.step, fallback.step, 8),
      title: cleanStr(item.title, fallback.title, 70),
      description: cleanStr(item.description, fallback.description, 220),
    };
  });

  const rawExps = Array.isArray(src.videocall_experiences) ? src.videocall_experiences : [];
  const videocall_experiences = DEFAULT_CREATOR_ABOUT.videocall_experiences.map((fallback, idx) => {
    const item = (rawExps[idx] && typeof rawExps[idx] === 'object' ? rawExps[idx] : {}) as Record<string, unknown>;
    return {
      id: cleanStr(item.id, fallback.id, 24),
      badge: cleanStr(item.badge, fallback.badge, 50),
      title: cleanStr(item.title, fallback.title, 80),
      subtitle: cleanStr(item.subtitle, fallback.subtitle, 80),
      description: cleanStr(item.description, fallback.description, 280),
      duration_hint: cleanStr(item.duration_hint, fallback.duration_hint, 40),
    };
  });

  return {
    headline_tag: cleanStr(src.headline_tag, DEFAULT_CREATOR_ABOUT.headline_tag, 80),
    carioca_title: cleanStr(src.carioca_title, DEFAULT_CREATOR_ABOUT.carioca_title, 100),
    carioca_bio: cleanStr(src.carioca_bio, DEFAULT_CREATOR_ABOUT.carioca_bio, 700),
    carioca_traits,
    site_how_title: cleanStr(src.site_how_title, DEFAULT_CREATOR_ABOUT.site_how_title, 100),
    site_how_intro: cleanStr(src.site_how_intro, DEFAULT_CREATOR_ABOUT.site_how_intro, 700),
    site_steps,
    videocall_title: cleanStr(src.videocall_title, DEFAULT_CREATOR_ABOUT.videocall_title, 100),
    videocall_intro: cleanStr(src.videocall_intro, DEFAULT_CREATOR_ABOUT.videocall_intro, 700),
    videocall_experiences,
    signature_quote: cleanStr(src.signature_quote, DEFAULT_CREATOR_ABOUT.signature_quote, 260),
  };
}

export function resolveCreatorAboutContent(input?: Partial<CreatorAboutContent> | null): CreatorAboutContent {
  if (!input) {
    return sanitizeCreatorAboutContent(DEFAULT_CREATOR_ABOUT);
  }
  return sanitizeCreatorAboutContent(input);
}

import type { CreatorProfile, FanTestimonial, StorefrontStats } from '../types';
import { resolveVideoCallPlans } from './videoCalls';
import { resolveMimoSectionConfig } from './mimoGifts';
import { computeTestimonialStats, resolveTestimonials } from './testimonials';

export interface StorefrontFaqItem {
  question: string;
  answer: string;
}

export const STOREFRONT_FAQS: StorefrontFaqItem[] = [
  {
    question: 'Como funciona a vídeo chamada privativa 1:1 com Lorena Noir?',
    answer:
      'O atendimento é estritamente individual entre 1 internauta e Lorena Noir ao vivo frente à câmera em sala privada fechada. Você escolhe a duração desejada, realiza a confirmação exclusivamente via Pix e recebe o link privativo da sessão no seu WhatsApp ou @Telegram informado.',
  },
  {
    question: 'Quais meios de pagamento são aceitos na plataforma?',
    answer:
      'Para vídeo chamada privativa 1:1 o pagamento aceito é exclusivamente via Pix instantâneo. Já na assinatura do Clube VIP, nos 6 cartões de Mimos Especiais e nos conteúdos avulsos da galeria é possível confirmar via Pix ou cartão diretamente vinculado ao seu e-mail.',
  },
  {
    question: 'O que está incluído no Clube VIP e na Galeria 35mm?',
    answer:
      'Assinantes do Clube VIP desbloqueiam acesso ilimitado por 30 dias a todas as fotos em alta resolução e vídeos exclusivos marcados como VIP na galeria, com streaming protegido direto no site sem exposição de links externos.',
  },
  {
    question: 'Como funcionam os 6 Cartões de Mimos Especiais e mensagens combinadas?',
    answer:
      'Você pode escolher entre os 6 cartões de mimos especiais ou enviar um valor personalizado com dedicatória para Lorena Noir. O mimo registra sua compra no histórico de lealdade e prioriza atendimentos especiais combinados diretamente.',
  },
  {
    question: 'Como funciona o Nível de Lealdade e o selo Fã VIP Ouro?',
    answer:
      'Cada compra paga confirmada com seu e-mail (vídeo chamadas, assinatura VIP, mimos ou avulsos) preenche a barra de progresso no Painel da Conta. Ao atingir compras regulares, seu perfil recebe automaticamente o badge exclusivo de Fã VIP Ouro.',
  },
  {
    question: 'Os depoimentos exibidos na vitrine são de compradores reais?',
    answer:
      'Sim. O sistema verifica automaticamente no banco de vendas se o e-mail do autor possui ao menos uma transação confirmada antes de publicar um comentário e conceder a marcação de Compra Verificada.',
  },
];

export function buildStorefrontJsonLd(
  profile: CreatorProfile,
  stats: StorefrontStats,
  origin: string
): Record<string, unknown> {
  const baseUrl = (origin || '').replace(/\/+$/, '');
  const pageUrl = `${baseUrl}/`;
  const heroImageUrl = `${baseUrl}/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG`;

  const videoPlans = resolveVideoCallPlans(profile.video_call_plans).filter((p) => p.active);
  const mimoConfig = resolveMimoSectionConfig(profile.mimo_config);
  const activeMimos = mimoConfig.tiers.filter((t) => t.active);
  const publishedTestimonials: FanTestimonial[] = resolveTestimonials(profile.testimonials).filter(
    (t) => t.is_published
  );
  const ratingStats = computeTestimonialStats(publishedTestimonials);

  const pageTitle = `Vídeo Chamada Modelo Feminina Atraente ${profile.display_name}`;
  const pageDescription =
    'Vídeo chamada privativa 1:1 via Pix somente entre 1 internauta e modelo, 6 cartões de mimos especiais, Clube VIP e acervo exclusivo +18 de Lorena Noir.';

  const minVideoPrice =
    videoPlans.length > 0 ? Math.min(...videoPlans.map((p) => Number(p.price_brl || 0))) : 20;
  const maxVideoPrice =
    videoPlans.length > 0 ? Math.max(...videoPlans.map((p) => Number(p.price_brl || 0))) : 100;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: pageUrl,
        name: pageTitle,
        alternateName: `${profile.display_name} (${profile.handle})`,
        description: pageDescription,
        inLanguage: 'pt-BR',
      },
      {
        '@type': 'ProfilePage',
        '@id': `${baseUrl}/#webpage`,
        url: pageUrl,
        name: pageTitle,
        description: pageDescription,
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: { '@id': `${baseUrl}/#creator` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: heroImageUrl,
        },
        inLanguage: 'pt-BR',
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: [
            'h1',
            '#sobre-criadora',
            '#video-chamada h2',
            '#depoimentos-fas h2',
            '#perguntas-frequentes',
          ],
        },
      },
      {
        '@type': 'Person',
        '@id': `${baseUrl}/#creator`,
        name: profile.display_name,
        alternateName: profile.handle,
        description: profile.bio,
        image: heroImageUrl,
        url: pageUrl,
        knowsLanguage: 'pt-BR',
        homeLocation: {
          '@type': 'Place',
          name: profile.location || 'Rio de Janeiro, Brasil',
          address: {
            '@type': 'PostalAddress',
            addressLocality: profile.location || 'Rio de Janeiro',
            addressCountry: 'BR',
          },
        },
      },
      {
        '@type': 'Service',
        '@id': `${baseUrl}/#video-chamada-service`,
        name: `Vídeo Chamada Privativa 1:1 com ${profile.display_name}`,
        serviceType: 'Vídeo Chamada Privativa 1:1 ao Vivo (Pagamento via Pix)',
        description:
          'Atendimento estritamente individual entre 1 internauta e modelo ao vivo via Pix, com duração flexível e envio de sala privada.',
        provider: { '@id': `${baseUrl}/#creator` },
        areaServed: {
          '@type': 'Country',
          name: 'Brasil',
        },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: `${baseUrl}/#video-chamada`,
        },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: minVideoPrice.toFixed(2),
          highPrice: maxVideoPrice.toFixed(2),
          offerCount: videoPlans.length + activeMimos.length + 1,
          offers: [
            ...videoPlans.map((plan) => ({
              '@type': 'Offer',
              name: `${plan.title} (${plan.duration_minutes} min) — Vídeo Chamada 1:1`,
              description: plan.description,
              price: Number(plan.price_brl).toFixed(2),
              priceCurrency: 'BRL',
              availability: 'https://schema.org/InStock',
              url: `${baseUrl}/#video-chamada`,
            })),
            {
              '@type': 'Offer',
              name: `Clube VIP Mensal de ${profile.display_name}`,
              description: profile.vip_description,
              price: Number(profile.vip_monthly_price_brl || 49.9).toFixed(2),
              priceCurrency: 'BRL',
              availability: 'https://schema.org/InStock',
              url: `${baseUrl}/#clube-vip`,
            },
          ],
        },
      },
      {
        '@type': 'Product',
        '@id': `${baseUrl}/#acervo-vip`,
        name: `Experiência Privada 1:1 & Clube VIP · ${profile.display_name}`,
        description: `${stats.totalPhotos} fotos exclusivas, ${stats.totalVideos} vídeos privados, vídeo chamada 1:1 via Pix e mimos especiais.`,
        image: heroImageUrl,
        brand: {
          '@type': 'Brand',
          name: profile.display_name,
        },
        offers: {
          '@type': 'Offer',
          price: Number(profile.vip_monthly_price_brl || 49.9).toFixed(2),
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          url: pageUrl,
        },
        ...(ratingStats.totalCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: ratingStats.averageRating.toFixed(1),
                bestRating: '5',
                worstRating: '1',
                ratingCount: ratingStats.totalCount,
                reviewCount: ratingStats.totalCount,
              },
              review: publishedTestimonials.slice(0, 6).map((item) => ({
                '@type': 'Review',
                author: {
                  '@type': 'Person',
                  name: item.author_name,
                },
                datePublished: item.created_at.slice(0, 10),
                reviewBody: item.comment,
                reviewRating: {
                  '@type': 'Rating',
                  ratingValue: String(item.rating),
                  bestRating: '5',
                  worstRating: '1',
                },
              })),
            }
          : {}),
      },
      {
        '@type': 'FAQPage',
        '@id': `${baseUrl}/#faq`,
        mainEntity: STOREFRONT_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${baseUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: pageUrl },
          { '@type': 'ListItem', position: 2, name: 'Vídeo Chamada 1:1', item: `${baseUrl}/#video-chamada` },
          { '@type': 'ListItem', position: 3, name: '6 Mimos Especiais', item: `${baseUrl}/#enviar-mimo` },
          { '@type': 'ListItem', position: 4, name: 'Galeria & Acervo', item: `${baseUrl}/#vitrine-grid` },
          { '@type': 'ListItem', position: 5, name: 'Depoimentos dos Fãs', item: `${baseUrl}/#depoimentos-fas` },
          { '@type': 'ListItem', position: 6, name: 'Clube VIP', item: `${baseUrl}/#clube-vip` },
        ],
      },
    ],
  };
}

import type { AccessTier, MediaItem, MediaType } from '../types';
import { formatDuration } from './format';

export type MediaAltContext = 'gallery' | 'filmstrip' | 'vip_teaser' | 'modal';
export type ProfileImageKind = 'avatar' | 'hero' | 'video_call' | 'mimo' | 'camera';

export type MediaAltInput = Partial<MediaItem> & {
  title?: string;
  media_type?: MediaType;
  access_tier?: AccessTier;
};

interface GenerateMediaAltOptions {
  creatorName?: string;
  context?: MediaAltContext;
}

function sanitizeText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  const clean = lastSpace > 24 ? sliced.slice(0, lastSpace) : sliced;
  return `${clean.replace(/[.,;:!?-]+$/, '')}...`;
}

/**
 * Gera texto alternativo descritivo e otimizado para SEO/acessibilidade
 * a partir dos metadados de cada item de mídia.
 */
export function generateMediaAlt(
  item: MediaAltInput | null | undefined,
  options: GenerateMediaAltOptions = {}
): string {
  if (!item) {
    const creator = sanitizeText(options.creatorName) || 'Lorena Noir';
    return `Mídia exclusiva de ${creator}`;
  }

  const creator = sanitizeText(options.creatorName) || 'Lorena Noir';
  const title = sanitizeText(item.title) || 'Ensaio exclusivo';
  const collection = sanitizeText(item.collection_name);
  const description = sanitizeText(item.description);
  const isVideo = item.media_type === 'video';
  const durationLabel = isVideo && item.duration_seconds ? formatDuration(item.duration_seconds) : '';

  const contextPrefix =
    options.context === 'filmstrip'
      ? isVideo
        ? 'Miniatura de tira 35mm do vídeo'
        : 'Miniatura de tira 35mm da foto'
      : options.context === 'vip_teaser'
      ? isVideo
        ? 'Destaque Clube VIP do vídeo'
        : 'Destaque Clube VIP da foto'
      : options.context === 'modal'
      ? isVideo
        ? 'Visualização ampliada do vídeo exclusivo'
        : 'Visualização ampliada da foto em alta resolução'
      : isVideo
      ? 'Cena de vídeo exclusivo'
      : 'Foto em alta resolução';

  const parts: string[] = [`${contextPrefix} "${title}" de ${creator}`];

  if (collection && collection.toLowerCase() !== 'geral') {
    parts.push(`coleção ${collection}`);
  }

  if (durationLabel) {
    parts.push(`duração ${durationLabel}`);
  }

  if (item.access_tier === 'vip') {
    parts.push(item.is_unlocked === false ? 'Clube VIP (prévia protegida)' : 'Clube VIP');
  } else if (item.access_tier === 'free') {
    parts.push('prévia gratuita');
  } else if (item.access_tier === 'ppv') {
    parts.push(item.is_unlocked === false ? 'conteúdo avulso protegido' : 'conteúdo avulso');
  }

  if (description) {
    parts.push(truncateAtWord(description, 78));
  }

  return parts.join(' — ');
}

/**
 * Gera atributos 'alt' contextuais para imagens editoriais e de perfil da criadora.
 */
export function generateProfileImageAlt(
  kind: ProfileImageKind,
  creatorName?: string | null,
  location?: string | null
): string {
  const creator = sanitizeText(creatorName) || 'Lorena Noir';
  const city = sanitizeText(location);
  const locationSuffix = city ? ` em ${city}` : '';

  switch (kind) {
    case 'avatar':
      return `Retrato de perfil de ${creator}${locationSuffix}`;
    case 'hero':
      return `Retrato editorial em destaque de ${creator}${locationSuffix} — portfólio e acervo privado`;
    case 'video_call':
      return `${creator} ao vivo frente à câmera para vídeo chamada privativa 1 a 1 liberada via Pix`;
    case 'mimo':
      return `Concierge de mimos e homenagens VIP para ${creator}${locationSuffix}`;
    case 'camera':
      return `Câmera 4K dedicada de estúdio para transmissão privada 1 a 1 com ${creator}`;
    default:
      return `${creator}${locationSuffix}`;
  }
}

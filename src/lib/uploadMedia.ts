export interface UploadBucketResult {
  storagePath: string;
  publicUrl: string | null;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|jfif|bmp)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|ogv)$/i;

export function inferMediaKind(file: File): 'photo' | 'video' | null {
  if (file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name)) return 'photo';
  if (file.type.startsWith('video/') || VIDEO_EXT_RE.test(file.name)) return 'video';
  return null;
}

export function isValidMediaHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function inferMediaKindFromUrl(rawUrl: string): 'photo' | 'video' | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    if (VIDEO_EXT_RE.test(pathname) || /\.(mp4|mov|webm|m4v)\b/.test(search) || pathname.includes('/video')) {
      return 'video';
    }
    if (IMAGE_EXT_RE.test(pathname) || /\.(jpe?g|png|webp|gif|avif)\b/.test(search) || pathname.includes('/image')) {
      return 'photo';
    }
    return null;
  } catch {
    return null;
  }
}

export function inferMimeTypeFromUrl(rawUrl: string, mediaType: 'photo' | 'video'): string {
  const lower = rawUrl.split('?')[0].toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.jfif')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
}

export function extractTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = decodeURIComponent(segments[segments.length - 1] || '');
    const clean = last.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (clean && clean.length >= 2) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).slice(0, 60);
    }
  } catch {
    // ignore malformed URL
  }
  return 'Nova Mídia por Link';
}

export function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.jfif')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}

export async function uploadFileToSupabaseBucket(
  targetFile: File,
  bucket: 'creator-media' | 'creator-previews',
  creatorToken: string
): Promise<UploadBucketResult> {
  const mimeType = inferMimeType(targetFile);

  // 1. Try signed upload URL (direct browser -> Supabase Storage, supports large files)
  try {
    const urlResp = await fetch('/api/creator/media/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-creator-token': creatorToken,
      },
      body: JSON.stringify({ fileName: targetFile.name, bucket }),
    });

    if (urlResp.status === 401) {
      throw new Error('Sessão de administradora expirada. Saia e faça login novamente.');
    }

    if (urlResp.ok) {
      const { signedUrl, storagePath, publicUrl } = await urlResp.json();
      const putResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: targetFile,
      });
      if (putResp.ok) {
        return { storagePath, publicUrl };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Sessão de administradora expirada')) {
      throw err;
    }
    // Ignore CORS / direct PUT network errors and fall back to server binary relay
  }

  // 2. Fallback binary stream through Express server (always CORS-safe)
  const binResp = await fetch('/api/creator/media/upload-binary', {
    method: 'POST',
    headers: {
      'x-creator-token': creatorToken,
      'x-file-name': encodeURIComponent(targetFile.name),
      'x-mime-type': mimeType,
      'x-bucket': bucket,
      'Content-Type': 'application/octet-stream',
    },
    body: targetFile,
  });

  let binData: { error?: string; storagePath?: string; publicUrl?: string | null } = {};
  try {
    binData = await binResp.json();
  } catch {
    // non-JSON proxy error (e.g., payload too large)
  }

  if (!binResp.ok || !binData.storagePath) {
    if (binResp.status === 413) {
      throw new Error('O arquivo excede o limite de envio direto pelo servidor. Tente reduzir o tamanho ou compactar.');
    }
    throw new Error(binData.error || `Falha ao enviar arquivo para o Storage (HTTP ${binResp.status}).`);
  }

  return {
    storagePath: binData.storagePath,
    publicUrl: binData.publicUrl ?? null,
  };
}

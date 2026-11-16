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

import React, { useState, useRef } from 'react';
import { Upload, Film, Image as ImageIcon, CheckCircle2, AlertCircle, X, Trash2 } from 'lucide-react';
import type { AccessTier, MediaType } from '../../types';
import { inferMediaKind, inferMimeType, uploadFileToSupabaseBucket } from '../../lib/uploadMedia';

interface QueuedFile {
  id: string;
  file: File;
  previewSrc: string;
  mediaType: MediaType;
  durationSeconds: number | null;
}

interface MediaUploaderProps {
  creatorToken: string;
  supabaseReady: boolean;
  onUploaded: () => Promise<void>;
  onGoToSupabase: () => void;
}

function fileNameToTitle(name: string): string {
  const clean = name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!clean) return 'Nova Mídia';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function createBlurredPhotoTeaser(file: File): Promise<File | null> {
  try {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imgUrl;
      });
      const maxDim = 420;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(64, Math.round(img.width * scale));
      const h = Math.max(64, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.filter = 'blur(18px) brightness(0.75)';
      ctx.drawImage(img, -12, -12, w + 24, h + 24);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72)
      );
      if (!blob) return null;
      return new File([blob], `teaser-${file.name.replace(/\.[^/.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  } catch {
    return null;
  }
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  creatorToken,
  supabaseReady,
  onUploaded,
  onGoToSupabase,
}) => {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewSrc, setCoverPreviewSrc] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collectionName, setCollectionName] = useState('Ensaios Exclusivos');
  const [accessTier, setAccessTier] = useState<AccessTier>('vip');
  const [priceBrl, setPriceBrl] = useState('39.90');
  const [isPublished, setIsPublished] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const primaryQueued = queuedFiles[0] || null;
  const isBatch = queuedFiles.length > 1;

  const handleSelectFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    setStatusMsg(null);

    const added: QueuedFile[] = [];
    const rejected: string[] = [];

    for (const selected of Array.from(fileList)) {
      const kind = inferMediaKind(selected);
      if (!kind) {
        rejected.push(selected.name);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const objUrl = URL.createObjectURL(selected);
      const entry: QueuedFile = {
        id,
        file: selected,
        previewSrc: objUrl,
        mediaType: kind,
        durationSeconds: null,
      };
      added.push(entry);

      if (kind === 'video') {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
          if (Number.isFinite(vid.duration)) {
            const dur = Math.round(vid.duration);
            setQueuedFiles((prev) =>
              prev.map((q) => (q.id === id ? { ...q, durationSeconds: dur } : q))
            );
          }
        };
        vid.src = objUrl;
      }
    }

    if (rejected.length > 0) {
      setStatusMsg({
        type: 'err',
        text: `Arquivo(s) ignorado(s) por formato inválido: ${rejected.join(', ')}. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.`,
      });
    }

    if (added.length === 0) return;

    setQueuedFiles((prev) => {
      const next = [...prev, ...added];
      if (next.length === 1 && !title.trim()) {
        setTitle(fileNameToTitle(next[0].file.name));
      }
      return next;
    });
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => {
      const target = prev.find((q) => q.id === id);
      if (target) URL.revokeObjectURL(target.previewSrc);
      const next = prev.filter((q) => q.id !== id);
      if (next.length === 0) {
        setTitle('');
      }
      return next;
    });
  };

  const handleSelectCover = (selected: File | null) => {
    if (!selected || inferMediaKind(selected) !== 'photo') return;
    if (coverPreviewSrc) URL.revokeObjectURL(coverPreviewSrc);
    setCoverFile(selected);
    setCoverPreviewSrc(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!supabaseReady) {
      setStatusMsg({ type: 'err', text: 'Conecte o Supabase e crie as tabelas antes de enviar mídias.' });
      return;
    }
    if (queuedFiles.length === 0) {
      setStatusMsg({ type: 'err', text: 'Selecione pelo menos uma foto ou vídeo para enviar.' });
      return;
    }
    if (!isBatch && !title.trim()) {
      setStatusMsg({ type: 'err', text: 'Informe um título para o conteúdo.' });
      return;
    }

    setUploading(true);
    let savedCount = 0;

    try {
      let sharedCoverUrl: string | null = null;
      if (coverFile) {
        setProgressLabel('Enviando capa de prévia...');
        const cov = await uploadFileToSupabaseBucket(coverFile, 'creator-previews', creatorToken);
        sharedCoverUrl = cov.publicUrl;
      }

      for (let i = 0; i < queuedFiles.length; i++) {
        const q = queuedFiles[i];
        const prefix = queuedFiles.length > 1 ? `(${i + 1}/${queuedFiles.length}) ` : '';
        const itemTitle = isBatch
          ? title.trim()
            ? `${title.trim()} #${i + 1}`
            : fileNameToTitle(q.file.name)
          : title.trim();

        let itemPreviewUrl = sharedCoverUrl;

        // For paid photos without custom cover, create a small blurred teaser so the storefront shows her real blurred photo
        if (!itemPreviewUrl && q.mediaType === 'photo' && accessTier !== 'free') {
          setProgressLabel(`${prefix}Gerando prévia borrada segura...`);
          const blurredFile = await createBlurredPhotoTeaser(q.file);
          if (blurredFile) {
            try {
              const teaserUpload = await uploadFileToSupabaseBucket(
                blurredFile,
                'creator-previews',
                creatorToken
              );
              itemPreviewUrl = teaserUpload.publicUrl;
            } catch {
              // non-fatal; continue uploading main photo
            }
          }
        }

        setProgressLabel(
          `${prefix}Enviando ${q.mediaType === 'video' ? 'vídeo' : 'foto'} para o Supabase...`
        );
        const uploaded = await uploadFileToSupabaseBucket(q.file, 'creator-media', creatorToken);

        setProgressLabel(`${prefix}Salvando no acervo do site...`);
        const saveResp = await fetch('/api/creator/media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-creator-token': creatorToken,
          },
          body: JSON.stringify({
            title: itemTitle,
            description: description.trim(),
            mediaType: q.mediaType,
            accessTier,
            priceBrl: accessTier === 'ppv' ? Number(priceBrl || 0) : 0,
            collectionName: collectionName.trim() || 'Geral',
            storagePath: uploaded.storagePath,
            previewUrl: itemPreviewUrl,
            durationSeconds: q.durationSeconds,
            fileSizeBytes: q.file.size,
            mimeType: inferMimeType(q.file),
            isPublished,
          }),
        });

        const saveData = await saveResp.json();
        if (!saveResp.ok) {
          throw new Error(saveData.error || `Erro ao salvar "${itemTitle}" no banco.`);
        }
        savedCount++;
      }

      for (const q of queuedFiles) {
        URL.revokeObjectURL(q.previewSrc);
      }
      if (coverPreviewSrc) URL.revokeObjectURL(coverPreviewSrc);

      setQueuedFiles([]);
      setCoverFile(null);
      setCoverPreviewSrc(null);
      setTitle('');
      setDescription('');

      await onUploaded();
      setStatusMsg({
        type: 'ok',
        text:
          savedCount > 1
            ? `${savedCount} arquivos enviados e salvos no site com sucesso!`
            : `"${title.trim() || 'Conteúdo'}" enviado e salvo no site com sucesso!`,
      });
    } catch (err) {
      if (savedCount > 0) {
        await onUploaded();
      }
      setStatusMsg({
        type: 'err',
        text:
          (savedCount > 0 ? `${savedCount} item(ns) salvo(s), mas houve erro no próximo: ` : '') +
          (err instanceof Error ? err.message : 'Erro ao enviar mídia.'),
      });
    } finally {
      setUploading(false);
      setProgressLabel('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#453F3B] pb-5">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">
          Enviar Fotos e Vídeos
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Selecione uma ou várias fotos/vídeos, defina o acesso e clique em <span className="text-zinc-200 font-medium">Enviar e Salvar no Site</span>.
        </p>
      </div>

      {!supabaseReady && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-xs text-amber-200">
          <span>Supabase não está conectado ou as tabelas ainda não foram criadas.</span>
          <button
            type="button"
            onClick={onGoToSupabase}
            className="rounded-md bg-[#D4AF37] px-3.5 py-2 font-semibold text-zinc-950 hover:bg-[#E5C158] shrink-0 cursor-pointer"
          >
            Configurar Supabase
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Dropzone & Preview */}
        <div className="lg:col-span-6 space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleSelectFiles(e.dataTransfer.files);
            }}
            onClick={() => queuedFiles.length === 0 && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed p-6 transition-colors min-h-[320px] ${
              queuedFiles.length > 0
                ? 'border-[#453F3B] bg-[#23201E]'
                : 'border-[#453F3B] bg-[#23201E] hover:border-[#D4AF37] cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                handleSelectFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {queuedFiles.length === 1 && primaryQueued ? (
              <div className="w-full space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black border border-[#453F3B]">
                  {primaryQueued.mediaType === 'video' ? (
                    <video
                      src={primaryQueued.previewSrc}
                      controls
                      playsInline
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <img
                      src={primaryQueued.previewSrc}
                      alt="Prévia"
                      className="h-full w-full object-contain"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQueuedFile(primaryQueued.id);
                    }}
                    aria-label="Remover arquivo"
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-md bg-black/80 text-zinc-200 hover:text-white border border-[#453F3B] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="truncate max-w-[220px] text-zinc-200">{primaryQueued.file.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">
                      {(primaryQueued.file.size / (1024 * 1024)).toFixed(1)} MB
                      {primaryQueued.durationSeconds ? ` · ${primaryQueued.durationSeconds}s` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="text-[#E5C158] hover:underline cursor-pointer"
                    >
                      + Adicionar mais
                    </button>
                  </div>
                </div>
              </div>
            ) : queuedFiles.length > 1 ? (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-200">
                    {queuedFiles.length} arquivos selecionados para envio
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1 text-xs text-[#E5C158] hover:border-[#D4AF37] cursor-pointer"
                  >
                    + Adicionar fotos/vídeos
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {queuedFiles.map((q) => (
                    <div
                      key={q.id}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#453F3B] bg-black group"
                    >
                      {q.mediaType === 'video' ? (
                        <video
                          src={q.previewSrc}
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img src={q.previewSrc} alt={q.file.name} className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQueuedFile(q.id);
                        }}
                        aria-label="Remover item"
                        className="absolute right-1.5 top-1.5 rounded bg-black/80 p-1 text-zinc-300 hover:text-rose-400 border border-[#453F3B] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#453F3B] bg-[#1C1918] text-[#D4AF37]">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-100">
                    Arraste suas fotos ou vídeos aqui, ou clique para selecionar
                  </p>
                  <p className="text-xs text-zinc-400">
                    Você pode escolher vários arquivos de uma vez (JPG, PNG, WEBP, MP4, MOV, WEBM)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Optional public preview cover */}
          <div className="rounded-xl border border-[#453F3B] bg-[#23201E] p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Capa de Prévia / Teaser (opcional)</p>
                <p className="text-xs text-zinc-400">
                  Para fotos VIP/Avulsas sem capa própria, geramos automaticamente uma prévia borrada segura.
                </p>
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="rounded-md border border-[#453F3B] bg-[#1C1918] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 shrink-0 cursor-pointer"
              >
                {coverFile ? 'Trocar Capa' : 'Enviar Capa'}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleSelectCover(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </div>
            {coverPreviewSrc && (
              <div className="flex items-center gap-3 pt-1">
                <img src={coverPreviewSrc} alt="Capa" className="h-14 w-20 rounded-md object-cover border border-[#453F3B]" />
                <span className="text-xs text-zinc-300 truncate">{coverFile?.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (coverPreviewSrc) URL.revokeObjectURL(coverPreviewSrc);
                    setCoverFile(null);
                    setCoverPreviewSrc(null);
                  }}
                  className="ml-auto text-xs text-zinc-400 hover:text-zinc-100 underline cursor-pointer"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata & Pricing */}
        <div className="lg:col-span-6 rounded-xl border border-[#453F3B] bg-[#23201E] p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {primaryQueued?.mediaType === 'video' ? (
              <Film className="h-4 w-4 text-[#D4AF37]" />
            ) : (
              <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
            )}
            <span>
              {isBatch
                ? `Envio em lote: ${queuedFiles.length} arquivos`
                : `Tipo detectado: ${primaryQueued?.mediaType === 'video' ? 'Vídeo Privado' : 'Ensaio / Foto'}`}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {isBatch ? 'Título Base (opcional no envio em lote)' : 'Título da Mídia'}
            </label>
            <input
              type="text"
              required={!isBatch}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBatch ? 'Ex: Ensaio Silk Night (ou usa o nome de cada foto)' : 'Ex: Ensaio Silk Night — Bastidores'}
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Descrição / Legenda</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes deste ensaio ou vídeo para seus assinantes..."
              className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Coleção / Álbum</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Ex: Bastidores, Verão, Silk"
                className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Modelo de Acesso</label>
              <select
                value={accessTier}
                onChange={(e) => setAccessTier(e.target.value as AccessTier)}
                className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="vip">Incluso no Clube VIP</option>
                <option value="ppv">Venda Avulsa (PPV)</option>
                <option value="free">Prévia Gratuita (+18)</option>
              </select>
            </div>
          </div>

          {accessTier === 'ppv' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Preço para Desbloqueio Avulso (R$)
              </label>
              <input
                type="number"
                step="0.50"
                min="5"
                required
                value={priceBrl}
                onChange={(e) => setPriceBrl(e.target.value)}
                className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          )}

          <label className="flex items-center gap-3 text-xs text-zinc-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-[#D4AF37]"
            />
            <span>Publicar imediatamente na vitrine pública após envio</span>
          </label>

          {statusMsg && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border p-3.5 text-xs ${
                statusMsg.type === 'ok'
                  ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                  : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
              }`}
            >
              {statusMsg.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !supabaseReady}
            className="w-full rounded-lg bg-[#E5C158] px-5 py-3 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {uploading
              ? progressLabel || 'Enviando para o Supabase...'
              : isBatch
              ? `Enviar e Salvar ${queuedFiles.length} Arquivos no Site`
              : 'Enviar e Salvar no Acervo'}
          </button>
        </div>
      </form>
    </div>
  );
};

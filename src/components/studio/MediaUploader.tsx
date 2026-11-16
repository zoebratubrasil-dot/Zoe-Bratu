import React, { useState, useRef } from 'react';
import { Upload, Film, Image as ImageIcon, CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { AccessTier, MediaType } from '../../types';

interface MediaUploaderProps {
  creatorPin: string;
  supabaseReady: boolean;
  onUploaded: () => Promise<void>;
  onGoToSupabase: () => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  creatorPin,
  supabaseReady,
  onUploaded,
  onGoToSupabase,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

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

  const handleSelectFile = (selected: File | null) => {
    if (!selected) return;
    setStatusMsg(null);
    const isVideo = selected.type.startsWith('video/');
    const isPhoto = selected.type.startsWith('image/');
    if (!isVideo && !isPhoto) {
      setStatusMsg({ type: 'err', text: 'Selecione apenas arquivos de foto (JPG, PNG, WEBP) ou vídeo (MP4, MOV, WEBM).' });
      return;
    }

    setFile(selected);
    setMediaType(isVideo ? 'video' : 'photo');
    if (!title) {
      const cleanTitle = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    }

    const objUrl = URL.createObjectURL(selected);
    setPreviewSrc(objUrl);

    if (isVideo) {
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        if (Number.isFinite(vid.duration)) {
          setDurationSeconds(Math.round(vid.duration));
        }
      };
      vid.src = objUrl;
    } else {
      setDurationSeconds(null);
    }
  };

  const handleSelectCover = (selected: File | null) => {
    if (!selected || !selected.type.startsWith('image/')) return;
    setCoverFile(selected);
    setCoverPreviewSrc(URL.createObjectURL(selected));
  };

  const uploadToSupabaseBucket = async (targetFile: File, bucket: 'creator-media' | 'creator-previews') => {
    // 1. Try signed upload URL (fast direct browser -> Supabase Storage)
    const urlResp = await fetch('/api/creator/media/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-creator-pin': creatorPin,
      },
      body: JSON.stringify({ fileName: targetFile.name, bucket }),
    });

    if (urlResp.ok) {
      const { signedUrl, storagePath, publicUrl } = await urlResp.json();
      const putResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': targetFile.type || 'application/octet-stream',
        },
        body: targetFile,
      });
      if (putResp.ok) {
        return { storagePath, publicUrl };
      }
    }

    // 2. Fallback binary stream through Express server
    const binResp = await fetch('/api/creator/media/upload-binary', {
      method: 'POST',
      headers: {
        'x-creator-pin': creatorPin,
        'x-file-name': targetFile.name,
        'x-mime-type': targetFile.type || 'application/octet-stream',
        'x-bucket': bucket,
        'Content-Type': 'application/octet-stream',
      },
      body: targetFile,
    });
    const binData = await binResp.json();
    if (!binResp.ok) {
      throw new Error(binData.error || 'Falha ao enviar arquivo para o Storage.');
    }
    return { storagePath: binData.storagePath, publicUrl: binData.publicUrl };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!supabaseReady) {
      setStatusMsg({ type: 'err', text: 'Conecte o Supabase e crie as tabelas antes de enviar mídias.' });
      return;
    }
    if (!file) {
      setStatusMsg({ type: 'err', text: 'Selecione uma foto ou vídeo para enviar.' });
      return;
    }
    if (!title.trim()) {
      setStatusMsg({ type: 'err', text: 'Informe um título para o conteúdo.' });
      return;
    }

    setUploading(true);
    try {
      let previewUrl: string | null = null;
      if (coverFile) {
        setProgressLabel('Enviando capa de prévia...');
        const cov = await uploadToSupabaseBucket(coverFile, 'creator-previews');
        previewUrl = cov.publicUrl;
      }

      setProgressLabel(`Enviando ${mediaType === 'video' ? 'vídeo' : 'foto'} para o Storage privado...`);
      const uploaded = await uploadToSupabaseBucket(file, 'creator-media');

      setProgressLabel('Registrando no banco Postgres...');
      const saveResp = await fetch('/api/creator/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-pin': creatorPin,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          mediaType,
          accessTier,
          priceBrl: accessTier === 'ppv' ? Number(priceBrl || 0) : 0,
          collectionName: collectionName.trim() || 'Geral',
          storagePath: uploaded.storagePath,
          previewUrl,
          durationSeconds,
          fileSizeBytes: file.size,
          mimeType: file.type,
          isPublished,
        }),
      });

      const saveData = await saveResp.json();
      if (!saveResp.ok) {
        throw new Error(saveData.error || 'Erro ao salvar registro no banco.');
      }

      setStatusMsg({ type: 'ok', text: `"${title}" enviado e publicado no seu acervo com sucesso!` });
      setFile(null);
      setPreviewSrc(null);
      setCoverFile(null);
      setCoverPreviewSrc(null);
      setTitle('');
      setDescription('');
      setDurationSeconds(null);
      await onUploaded();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao enviar mídia.',
      });
    } finally {
      setUploading(false);
      setProgressLabel('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-800 pb-5">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">
          Enviar Fotos e Vídeos
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Faça upload direto para o bucket privado <span className="font-mono text-zinc-300">creator-media</span> no Supabase e defina o modelo de venda.
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
              handleSelectFile(e.dataTransfer.files?.[0] || null);
            }}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed p-6 transition-colors min-h-[320px] ${
              file
                ? 'border-zinc-700 bg-[#121215]'
                : 'border-zinc-700 bg-[#121215] hover:border-[#D4AF37] cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
            />

            {previewSrc ? (
              <div className="w-full space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black border border-zinc-800">
                  {mediaType === 'video' ? (
                    <video src={previewSrc} controls playsInline className="h-full w-full object-contain" />
                  ) : (
                    <img src={previewSrc} alt="Prévia" className="h-full w-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewSrc(null);
                      setDurationSeconds(null);
                    }}
                    aria-label="Remover arquivo"
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-md bg-black/80 text-zinc-200 hover:text-white border border-zinc-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="truncate max-w-[240px] text-zinc-200">{file?.name}</span>
                  <span className="font-mono tabular-nums">
                    {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ''}
                    {durationSeconds ? ` · ${durationSeconds}s` : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[#D4AF37]">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-100">
                    Arraste sua foto ou vídeo aqui, ou clique para selecionar
                  </p>
                  <p className="text-xs text-zinc-400">
                    Suporta JPG, PNG, WEBP, MP4, MOV e WEBM (até 500 MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Optional public preview cover */}
          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-200">Capa de Prévia / Teaser (opcional)</p>
                <p className="text-xs text-zinc-400">
                  Imagem borrada ou teaser exibida antes do desbloqueio VIP/Avulso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 cursor-pointer"
              >
                {coverFile ? 'Trocar Capa' : 'Enviar Capa'}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSelectCover(e.target.files?.[0] || null)}
              />
            </div>
            {coverPreviewSrc && (
              <div className="flex items-center gap-3 pt-1">
                <img src={coverPreviewSrc} alt="Capa" className="h-14 w-20 rounded-md object-cover border border-zinc-700" />
                <span className="text-xs text-zinc-300 truncate">{coverFile?.name}</span>
                <button
                  type="button"
                  onClick={() => {
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
        <div className="lg:col-span-6 rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {mediaType === 'video' ? (
              <Film className="h-4 w-4 text-[#D4AF37]" />
            ) : (
              <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
            )}
            <span>Tipo detectado: {mediaType === 'video' ? 'Vídeo Privado' : 'Ensaio / Foto'}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Título da Mídia</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ensaio Silk Night — Bastidores"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Descrição / Legenda</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os detalhes deste ensaio ou vídeo para seus assinantes..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Modelo de Acesso</label>
              <select
                value={accessTier}
                onChange={(e) => setAccessTier(e.target.value as AccessTier)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
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
            className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {uploading ? progressLabel || 'Enviando para o Supabase...' : 'Enviar e Salvar no Acervo'}
          </button>
        </div>
      </form>
    </div>
  );
};

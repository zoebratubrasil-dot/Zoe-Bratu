import React, { useMemo, useState } from 'react';
import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Plus,
  Search,
  LayoutGrid,
  List,
  Play,
  Upload,
  X,
  Link2,
} from 'lucide-react';
import type { AccessTier, MediaItem, MediaType } from '../../types';
import { formatBrl, formatBytes, formatDateShort, formatDuration } from '../../lib/format';
import {
  inferMediaKind,
  inferMediaKindFromUrl,
  inferMimeType,
  inferMimeTypeFromUrl,
  isValidMediaHttpUrl,
  uploadFileToSupabaseBucket,
} from '../../lib/uploadMedia';
import { ProtectedImage, ProtectedVideo } from '../ProtectedMedia';

interface MediaManagerProps {
  creatorToken: string;
  mediaItems: MediaItem[];
  onRefresh: () => Promise<void>;
  onGoToUpload: () => void;
}

export const MediaManager: React.FC<MediaManagerProps> = ({
  creatorToken,
  mediaItems,
  onRefresh,
  onGoToUpload,
}) => {
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCollection, setEditCollection] = useState('');
  const [editTier, setEditTier] = useState<AccessTier>('vip');
  const [editPrice, setEditPrice] = useState('0');
  const [editPublished, setEditPublished] = useState(true);

  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
  const [newMediaPreviewUrl, setNewMediaPreviewUrl] = useState<string | null>(null);
  const [newMediaDuration, setNewMediaDuration] = useState<number | null>(null);
  const [newMediaLinkUrl, setNewMediaLinkUrl] = useState('');
  const [newMediaLinkType, setNewMediaLinkType] = useState<'auto' | MediaType>('auto');

  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreviewUrl, setNewCoverPreviewUrl] = useState<string | null>(null);
  const [newCoverLinkUrl, setNewCoverLinkUrl] = useState('');
  const [removeCover, setRemoveCover] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');
  const [filterTier, setFilterTier] = useState<'all' | 'vip' | 'ppv' | 'free'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditCollection(item.collection_name || 'Geral');
    setEditTier(item.access_tier);
    setEditPrice(String(item.price_brl || 0));
    setEditPublished(item.is_published);
    setNewMediaFile(null);
    setNewMediaPreviewUrl(null);
    setNewMediaDuration(null);
    setNewMediaLinkUrl('');
    setNewMediaLinkType('auto');
    setNewCoverFile(null);
    setNewCoverPreviewUrl(null);
    setNewCoverLinkUrl('');
    setRemoveCover(false);
    setSaveError(null);
  };

  const handleSelectReplacementMedia = (selected: File | null) => {
    if (!selected) return;
    const kind = inferMediaKind(selected);
    if (!kind) {
      setSaveError('Selecione uma foto ou vídeo válido.');
      return;
    }
    setSaveError(null);
    setNewMediaFile(selected);
    setNewMediaLinkUrl('');
    const objUrl = URL.createObjectURL(selected);
    setNewMediaPreviewUrl(objUrl);

    if (kind === 'video') {
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        if (Number.isFinite(vid.duration)) {
          setNewMediaDuration(Math.round(vid.duration));
        }
      };
      vid.src = objUrl;
    } else {
      setNewMediaDuration(null);
    }
  };

  const handleSelectReplacementCover = (selected: File | null) => {
    if (!selected || inferMediaKind(selected) !== 'photo') return;
    setNewCoverFile(selected);
    setNewCoverLinkUrl('');
    setNewCoverPreviewUrl(URL.createObjectURL(selected));
    setRemoveCover(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaveError(null);

    const trimmedMediaLink = newMediaLinkUrl.trim();
    const trimmedCoverLink = newCoverLinkUrl.trim();

    if (trimmedMediaLink && !isValidMediaHttpUrl(trimmedMediaLink)) {
      setSaveError('O link substituto da mídia precisa começar com http:// ou https://.');
      return;
    }
    if (trimmedCoverLink && !isValidMediaHttpUrl(trimmedCoverLink)) {
      setSaveError('O link da capa de prévia precisa começar com http:// ou https://.');
      return;
    }

    setSaving(true);
    try {
      const patchBody: Record<string, unknown> = {
        title: editTitle,
        description: editDesc,
        collection_name: editCollection,
        access_tier: editTier,
        price_brl: editTier === 'ppv' ? Number(editPrice || 0) : 0,
        is_published: editPublished,
      };

      if (newMediaFile) {
        const uploaded = await uploadFileToSupabaseBucket(newMediaFile, 'creator-media', creatorToken);
        const kind = inferMediaKind(newMediaFile) || 'photo';
        patchBody.storage_path = uploaded.storagePath;
        patchBody.media_type = kind;
        patchBody.file_size_bytes = newMediaFile.size;
        patchBody.mime_type = inferMimeType(newMediaFile);
        patchBody.duration_seconds = kind === 'video' ? newMediaDuration : null;
      } else if (trimmedMediaLink) {
        const resolvedKind: MediaType =
          newMediaLinkType === 'auto'
            ? inferMediaKindFromUrl(trimmedMediaLink) || editing.media_type
            : newMediaLinkType;
        patchBody.storage_path = trimmedMediaLink;
        patchBody.media_type = resolvedKind;
        patchBody.file_size_bytes = null;
        patchBody.mime_type = inferMimeTypeFromUrl(trimmedMediaLink, resolvedKind);
      }

      if (newCoverFile) {
        const cov = await uploadFileToSupabaseBucket(newCoverFile, 'creator-previews', creatorToken);
        patchBody.preview_url = cov.publicUrl;
      } else if (trimmedCoverLink) {
        patchBody.preview_url = trimmedCoverLink;
      } else if (removeCover) {
        patchBody.preview_url = null;
      }

      const resp = await fetch(`/api/creator/media/${editing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify(patchBody),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao salvar alterações.');
      }
      setEditing(null);
      await onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao atualizar mídia.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: MediaItem) => {
    await fetch(`/api/creator/media/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-creator-token': creatorToken,
      },
      body: JSON.stringify({ is_published: !item.is_published }),
    });
    await onRefresh();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/creator/media/${id}`, {
      method: 'DELETE',
      headers: { 'x-creator-token': creatorToken },
    });
    setConfirmDeleteId(null);
    await onRefresh();
  };

  const filtered = useMemo(() => {
    return mediaItems.filter((m) => {
      if (filterType !== 'all' && m.media_type !== filterType) return false;
      if (filterTier !== 'all' && m.access_tier !== filterTier) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${m.title} ${m.description} ${m.collection_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mediaItems, filterType, filterTier, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/20 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#524B45]">
            Acervo Digital
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Editar Fotos & Vídeos ({mediaItems.length})
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Visualize, edite títulos, coleções, preços, troque arquivos/capas ou oculte mídias da vitrine.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToUpload}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615] px-4 py-2.5 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Enviar Nova Foto/Vídeo
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-sm bg-[#EFEBE5] border border-[#181615]/20">
            {(['all', 'photo', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                  filterType === t
                    ? 'bg-[#181615] text-[#FAF8F5] font-semibold'
                    : 'text-[#524B45] hover:text-[#181615]'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'photo' ? 'Fotos' : 'Vídeos'}
              </button>
            ))}
          </div>

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as 'all' | 'vip' | 'ppv' | 'free')}
            aria-label="Filtrar por nível de acesso"
            className="rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
          >
            <option value="all">Todos os acessos</option>
            <option value="vip">Clube VIP</option>
            <option value="ppv">Avulso (PPV)</option>
            <option value="free">Prévia Gratuita</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A726B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título ou coleção..."
              className="w-full sm:w-56 rounded-sm border border-[#181615]/25 bg-white pl-9 pr-3 py-2 text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-sm bg-[#EFEBE5] border border-[#181615]/20">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Visualizar em grade"
              className={`p-1.5 rounded-sm cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#181615] text-[#FAF8F5]' : 'text-[#524B45] hover:text-[#181615]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Visualizar em lista"
              className={`p-1.5 rounded-sm cursor-pointer ${
                viewMode === 'table' ? 'bg-[#181615] text-[#FAF8F5]' : 'text-[#524B45] hover:text-[#181615]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-12 text-center space-y-2">
          <p className="font-display text-xl font-bold uppercase text-[#181615]">Nenhuma mídia encontrada</p>
          <p className="text-xs text-[#524B45]">
            {mediaItems.length === 0
              ? 'Clique em "Enviar Nova Foto/Vídeo" para adicionar seu primeiro conteúdo.'
              : 'Ajuste os filtros ou a busca para visualizar outras mídias.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const thumb = item.preview_url || (item.media_type === 'photo' ? item.media_url : null);
            return (
              <div
                key={item.id}
                className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div
                    onClick={() => setPreviewItem(item)}
                    onContextMenu={(e) => e.preventDefault()}
                    className="relative aspect-[4/3] bg-black overflow-hidden cursor-pointer group media-shield border-b border-[#181615]/15"
                  >
                    {item.media_type === 'video' && item.media_url && (!item.preview_url || item.preview_url.includes('/api/media/fallback/')) ? (
                      <ProtectedVideo
                        src={item.media_url}
                        title={item.title}
                        controls={false}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : thumb ? (
                      <ProtectedImage
                        src={thumb}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        {item.media_type === 'video' ? (
                          <Film className="h-8 w-8 text-[#E5C158]" />
                        ) : (
                          <ImageIcon className="h-8 w-8" />
                        )}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 z-20 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615]/95 border border-[#FAF8F5]/20 px-3 py-1.5 text-xs font-medium text-[#FAF8F5]">
                        {item.media_type === 'video' ? (
                          <>
                            <Play className="h-3.5 w-3.5 text-[#E5C158]" /> Assistir
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 text-[#E5C158]" /> Visualizar
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 bg-white">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#524B45]">
                      <span className="truncate font-medium">
                        {item.media_type === 'video' ? 'Vídeo' : 'Foto'}
                        {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ''} ·{' '}
                        {item.collection_name}
                      </span>
                      <span className="font-mono font-semibold text-[#8A5A00] shrink-0">
                        {item.access_tier === 'free'
                          ? 'Prévia'
                          : item.access_tier === 'vip'
                          ? 'VIP'
                          : formatBrl(item.price_brl)}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[#181615] truncate">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-[#524B45] line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-[#181615]/15 bg-[#F3EFEA] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium hover:text-[#181615] cursor-pointer"
                  >
                    {item.is_published ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-emerald-700" />
                        <span className="text-emerald-800 font-semibold">Publicado</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-[#7A726B]" />
                        <span className="text-[#524B45]">Rascunho</span>
                      </>
                    )}
                  </button>

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="inline-flex items-center gap-1 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-2.5 py-1.5 text-xs font-semibold text-[#181615] hover:border-[#181615] hover:bg-[#E7E1D9] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-sm bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-sm border border-[#181615]/30 bg-white px-2 py-1 text-xs text-[#181615] cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label="Excluir mídia"
                        className="rounded-sm border border-[#181615]/25 bg-white p-1.5 text-[#524B45] hover:border-rose-700 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#181615]/20 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#181615]/20 bg-[#F3EFEA] text-[11px] uppercase tracking-wider text-[#524B45]">
              <tr>
                <th className="px-4 py-3 font-semibold">Mídia</th>
                <th className="px-4 py-3 font-semibold">Coleção</th>
                <th className="px-4 py-3 font-semibold">Acesso / Preço</th>
                <th className="px-4 py-3 font-semibold text-right">Tamanho</th>
                <th className="px-4 py-3 font-semibold text-right">Desbloqueios</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181615]/10">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="h-11 w-14 overflow-hidden rounded-sm border border-[#181615]/20 bg-black shrink-0 flex items-center justify-center cursor-pointer"
                      >
                        {item.media_type === 'photo' && (item.media_url || item.preview_url) ? (
                          <ProtectedImage
                            src={item.media_url || item.preview_url || ''}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : item.preview_url ? (
                          <ProtectedImage
                            src={item.preview_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : item.media_type === 'video' ? (
                          <Film className="h-4 w-4 text-[#E5C158]" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-zinc-400" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#181615] truncate max-w-[220px]">{item.title}</p>
                        <p className="text-[#524B45]">
                          {item.media_type === 'video' ? 'Vídeo' : 'Foto'} · {formatDateShort(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[#524B45]">{item.collection_name}</td>

                  <td className="px-4 py-3 font-mono tabular-nums font-semibold">
                    {item.access_tier === 'free' ? (
                      <span className="text-[#524B45]">Prévia Gratuita</span>
                    ) : item.access_tier === 'vip' ? (
                      <span className="text-[#8A5A00]">Clube VIP</span>
                    ) : (
                      <span className="text-emerald-800">{formatBrl(item.price_brl)} (Avulso)</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-[#524B45] tabular-nums">
                    {formatBytes(item.file_size_bytes)}
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-semibold text-[#181615] tabular-nums">
                    {item.unlocks_count}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleTogglePublished(item)}
                      className="inline-flex items-center gap-1.5 text-[#524B45] hover:text-[#181615] cursor-pointer"
                    >
                      {item.is_published ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-700" />
                          <span className="text-emerald-800 font-semibold">Publicado</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-[#7A726B]" />
                          <span className="text-[#524B45]">Rascunho</span>
                        </>
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label="Editar mídia"
                        className="rounded-sm border border-[#181615]/25 bg-[#EFEBE5] p-1.5 text-[#181615] hover:border-[#181615] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-sm bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-sm border border-[#181615]/25 bg-white px-2 py-1 text-xs text-[#181615] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label="Excluir mídia"
                          className="rounded-sm border border-[#181615]/25 bg-white p-1.5 text-[#524B45] hover:border-rose-700 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-sm border-2 border-[#181615] bg-[#FAF8F5] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#181615]/20 bg-[#F3EFEA]">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold uppercase tracking-tight text-[#181615] truncate">
                  {previewItem.title}
                </p>
                <p className="text-xs text-[#524B45]">
                  {previewItem.collection_name} · {previewItem.media_type === 'video' ? 'Vídeo' : 'Foto'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewItem;
                    setPreviewItem(null);
                    openEdit(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615] px-3 py-1.5 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar Item
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-sm border border-[#181615]/30 bg-white p-1.5 text-[#181615] hover:bg-[#EFEBE5] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              onContextMenu={(e) => e.preventDefault()}
              className="bg-black flex items-center justify-center max-h-[75vh] media-shield"
            >
              {previewItem.media_type === 'video' && previewItem.media_url ? (
                <ProtectedVideo
                  src={previewItem.media_url}
                  title={previewItem.title}
                  controls
                  autoPlay
                  containerClassName="relative w-full h-[65vh] bg-black"
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : previewItem.media_url || previewItem.preview_url ? (
                <ProtectedImage
                  src={previewItem.media_url || previewItem.preview_url || ''}
                  alt={previewItem.title}
                  containerClassName="relative w-full h-[65vh] flex items-center justify-center bg-black"
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : (
                <p className="p-12 text-xs text-zinc-400">Arquivo indisponível para pré-visualização.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-sm border-2 border-[#181615] bg-[#FAF8F5] p-6 space-y-4 shadow-2xl my-auto text-[#181615]"
          >
            <div className="flex items-center justify-between border-b border-[#181615]/20 pb-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#181615]">
                Editar {editing.media_type === 'video' ? 'Vídeo' : 'Foto'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-sm border border-[#181615]/25 bg-white p-1.5 text-[#524B45] hover:text-[#181615] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">Título</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#181615] mb-1">Descrição / Legenda</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">Coleção</label>
                <input
                  type="text"
                  value={editCollection}
                  onChange={(e) => setEditCollection(e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">Acesso</label>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value as AccessTier)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                >
                  <option value="vip">Clube VIP</option>
                  <option value="ppv">Avulso (PPV)</option>
                  <option value="free">Prévia Gratuita</option>
                </select>
              </div>
            </div>

            {editTier === 'ppv' && (
              <div>
                <label className="block text-xs font-semibold text-[#181615] mb-1">Preço Avulso (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  min="5"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 font-mono text-sm text-[#181615] focus:border-[#181615] focus:outline-none"
                />
              </div>
            )}

            {/* Replace primary photo/video (Arquivo ou Link URL) */}
            <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#181615]">Substituir Mídia (Arquivo ou Link)</p>
                  <p className="text-[11px] text-[#524B45]">
                    {newMediaFile
                      ? newMediaFile.name
                      : newMediaLinkUrl.trim()
                      ? 'Novo link URL informado abaixo'
                      : 'Mantendo a mídia atual'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-sm border border-[#181615]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#181615] hover:border-[#181615] cursor-pointer shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  Trocar Arquivo
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => handleSelectReplacementMedia(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {!newMediaFile && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-8 relative">
                    <Link2 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7A726B]" />
                    <input
                      type="url"
                      value={newMediaLinkUrl}
                      onChange={(e) => setNewMediaLinkUrl(e.target.value)}
                      placeholder="Ou cole o novo link (https://...)"
                      className="w-full rounded-sm border border-[#181615]/25 bg-white pl-8 pr-3 py-1.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={newMediaLinkType}
                      onChange={(e) => setNewMediaLinkType(e.target.value as 'auto' | MediaType)}
                      aria-label="Tipo do novo link"
                      className="w-full rounded-sm border border-[#181615]/25 bg-white px-2.5 py-1.5 text-xs text-[#181615] focus:border-[#181615] focus:outline-none"
                    >
                      <option value="auto">Tipo: Auto</option>
                      <option value="photo">Foto</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </div>
                </div>
              )}

              {newMediaPreviewUrl && newMediaFile && (
                <p className="text-[11px] font-semibold text-emerald-800">
                  Novo arquivo pronto para envio ({(newMediaFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Replace or remove cover preview (Arquivo ou Link URL) */}
            <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {(newCoverPreviewUrl ||
                    (newCoverLinkUrl.trim() && isValidMediaHttpUrl(newCoverLinkUrl.trim())) ||
                    (!removeCover && editing.preview_url)) && (
                    <div className="h-10 w-14 rounded-sm overflow-hidden border border-[#181615]/25 shrink-0">
                      <ProtectedImage
                        src={
                          newCoverPreviewUrl ||
                          (newCoverLinkUrl.trim() && isValidMediaHttpUrl(newCoverLinkUrl.trim())
                            ? newCoverLinkUrl.trim()
                            : editing.preview_url || '')
                        }
                        alt="Capa"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#181615]">Capa de Prévia / Teaser</p>
                    <p className="text-[11px] text-[#524B45] truncate">
                      {newCoverFile
                        ? newCoverFile.name
                        : newCoverLinkUrl.trim()
                        ? 'Novo link de capa informado'
                        : removeCover
                        ? 'Capa será removida'
                        : editing.preview_url
                        ? 'Capa personalizada ativa'
                        : 'Sem capa personalizada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="inline-flex items-center gap-1.5 rounded-sm border border-[#181615]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#181615] hover:border-[#181615] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    Capa
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleSelectReplacementCover(e.target.files?.[0] || null)}
                    />
                  </label>
                  {(editing.preview_url || newCoverFile || newCoverLinkUrl.trim()) && !removeCover && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewCoverFile(null);
                        setNewCoverPreviewUrl(null);
                        setNewCoverLinkUrl('');
                        setRemoveCover(true);
                      }}
                      className="text-[11px] font-medium text-[#524B45] hover:text-rose-700 underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {!newCoverFile && (
                <input
                  type="url"
                  value={newCoverLinkUrl}
                  onChange={(e) => {
                    setNewCoverLinkUrl(e.target.value);
                    if (e.target.value.trim()) setRemoveCover(false);
                  }}
                  placeholder="Ou cole o link da capa de prévia (https://...)"
                  className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-1.5 font-mono text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
                />
              )}
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium text-[#181615] cursor-pointer">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="h-4 w-4 accent-[#181615]"
              />
              <span>Publicado na vitrine pública</span>
            </label>

            {saveError && (
              <p className="rounded-sm border border-rose-700/35 bg-rose-50 p-3 text-xs text-rose-900">
                {saveError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#181615]/15">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-4 py-2 text-xs font-semibold text-[#181615] hover:bg-[#E7E1D9] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-sm bg-[#181615] px-4 py-2 text-xs font-semibold text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

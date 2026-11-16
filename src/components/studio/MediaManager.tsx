import React, { useState } from 'react';
import { Pencil, Trash2, Eye, EyeOff, Film, Image as ImageIcon, Plus } from 'lucide-react';
import type { AccessTier, MediaItem } from '../../types';
import { formatBrl, formatBytes, formatDateShort } from '../../lib/format';

interface MediaManagerProps {
  creatorPin: string;
  mediaItems: MediaItem[];
  onRefresh: () => Promise<void>;
  onGoToUpload: () => void;
}

export const MediaManager: React.FC<MediaManagerProps> = ({
  creatorPin,
  mediaItems,
  onRefresh,
  onGoToUpload,
}) => {
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCollection, setEditCollection] = useState('');
  const [editTier, setEditTier] = useState<AccessTier>('vip');
  const [editPrice, setEditPrice] = useState('0');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditCollection(item.collection_name || 'Geral');
    setEditTier(item.access_tier);
    setEditPrice(String(item.price_brl || 0));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/creator/media/${editing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-pin': creatorPin,
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
          collection_name: editCollection,
          access_tier: editTier,
          price_brl: editTier === 'ppv' ? Number(editPrice || 0) : 0,
        }),
      });
      if (resp.ok) {
        setEditing(null);
        await onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: MediaItem) => {
    await fetch(`/api/creator/media/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-creator-pin': creatorPin,
      },
      body: JSON.stringify({ is_published: !item.is_published }),
    });
    await onRefresh();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/creator/media/${id}`, {
      method: 'DELETE',
      headers: { 'x-creator-pin': creatorPin },
    });
    setConfirmDeleteId(null);
    await onRefresh();
  };

  const filtered = mediaItems.filter((m) => filterType === 'all' || m.media_type === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            Gerenciar Conteúdo ({mediaItems.length})
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Edite preços avulsos, alterne visibilidade ou remova fotos e vídeos do seu Storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121215] border border-zinc-800">
            {(['all', 'photo', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  filterType === t ? 'bg-[#D4AF37] text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'photo' ? 'Fotos' : 'Vídeos'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova Mídia
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-[#121215] p-12 text-center space-y-3">
          <p className="font-display text-lg text-zinc-200">Nenhuma mídia cadastrada</p>
          <p className="text-xs text-zinc-400">
            Clique em "Nova Mídia" para enviar sua primeira foto ou vídeo para o Supabase.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Mídia</th>
                <th className="px-4 py-3 font-medium">Coleção</th>
                <th className="px-4 py-3 font-medium">Acesso / Preço</th>
                <th className="px-4 py-3 font-medium text-right">Tamanho</th>
                <th className="px-4 py-3 font-medium text-right">Desbloqueios</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-14 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 shrink-0 flex items-center justify-center">
                        {item.media_type === 'photo' && (item.media_url || item.preview_url) ? (
                          <img
                            src={item.media_url || item.preview_url || ''}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : item.preview_url ? (
                          <img
                            src={item.preview_url}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : item.media_type === 'video' ? (
                          <Film className="h-4 w-4 text-[#D4AF37]" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100 truncate max-w-[220px]">{item.title}</p>
                        <p className="text-zinc-500">
                          {item.media_type === 'video' ? 'Vídeo' : 'Foto'} · {formatDateShort(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-zinc-300">{item.collection_name}</td>

                  <td className="px-4 py-3 font-mono tabular-nums">
                    {item.access_tier === 'free' ? (
                      <span className="text-zinc-300">Prévia Gratuita</span>
                    ) : item.access_tier === 'vip' ? (
                      <span className="text-[#E5C158]">Clube VIP</span>
                    ) : (
                      <span className="text-emerald-300">{formatBrl(item.price_brl)} (Avulso)</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-zinc-400 tabular-nums">
                    {formatBytes(item.file_size_bytes)}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-zinc-200 tabular-nums">
                    {item.unlocks_count}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleTogglePublished(item)}
                      className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {item.is_published ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Publicado</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="text-zinc-500">Rascunho</span>
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
                        className="rounded-md border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-300 hover:border-zinc-500 hover:text-white cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500 cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label="Excluir mídia"
                          className="rounded-md border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-400 hover:border-rose-500 hover:text-rose-300 cursor-pointer"
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

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-xl font-semibold text-zinc-50">Editar Mídia</h3>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Título</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Descrição</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Coleção</label>
                <input
                  type="text"
                  value={editCollection}
                  onChange={(e) => setEditCollection(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Acesso</label>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value as AccessTier)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="vip">Clube VIP</option>
                  <option value="ppv">Avulso (PPV)</option>
                  <option value="free">Prévia Gratuita</option>
                </select>
              </div>
            </div>

            {editTier === 'ppv' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Preço Avulso (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  min="5"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] cursor-pointer"
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

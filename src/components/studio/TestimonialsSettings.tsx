import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  MessageSquareQuote,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import type { CreatorProfile, FanTestimonial, TestimonialCategory } from '../../types';
import {
  DEFAULT_FAN_TESTIMONIALS,
  TESTIMONIAL_CATEGORY_LABELS,
  computeTestimonialStats,
  sanitizeTestimonials,
} from '../../lib/testimonials';
import { formatDateShort } from '../../lib/format';

interface TestimonialsSettingsProps {
  creatorToken: string;
  profile: CreatorProfile;
  onUpdated: () => Promise<void>;
}

export const TestimonialsSettings: React.FC<TestimonialsSettingsProps> = ({
  creatorToken,
  profile,
  onUpdated,
}) => {
  const [items, setItems] = useState<FanTestimonial[]>(() =>
    sanitizeTestimonials(profile.testimonials || DEFAULT_FAN_TESTIMONIALS)
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newAuthorName, setNewAuthorName] = useState('');
  const [newLocation, setNewLocation] = useState('São Paulo, SP');
  const [newCategory, setNewCategory] = useState<TestimonialCategory>('video_call');
  const [newRating, setNewRating] = useState(5);
  const [newLoyaltyLabel, setNewLoyaltyLabel] = useState('Fã VIP Ouro');
  const [newVerified, setNewVerified] = useState(true);
  const [newFeatured, setNewFeatured] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    setItems(sanitizeTestimonials(profile.testimonials || DEFAULT_FAN_TESTIMONIALS));
  }, [profile.testimonials]);

  const stats = useMemo(() => computeTestimonialStats(items), [items]);

  const persistTestimonials = async (nextList: FanTestimonial[], customSuccessMsg?: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const resp = await fetch('/api/creator/testimonials', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ testimonials: nextList }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setFeedback({ type: 'err', text: data.error || 'Erro ao salvar depoimentos.' });
        return;
      }
      if (Array.isArray(data.testimonials)) {
        setItems(data.testimonials);
      }
      setFeedback({
        type: 'ok',
        text: customSuccessMsg || 'Depoimentos dos fãs atualizados e publicados na vitrine!',
      });
      await onUpdated();
    } catch {
      setFeedback({ type: 'err', text: 'Erro de conexão ao salvar depoimentos.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateField = <K extends keyof FanTestimonial>(
    id: string,
    field: K,
    value: FanTestimonial[K]
  ) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorName.trim() || newComment.trim().length < 15) {
      setFeedback({
        type: 'err',
        text: 'Informe o nome do fã e um comentário com pelo menos 15 caracteres.',
      });
      return;
    }

    const created: FanTestimonial = {
      id: `testi-${Date.now().toString(36)}`,
      author_name: newAuthorName.trim().slice(0, 60),
      author_location: newLocation.trim().slice(0, 50) || 'Brasil',
      category: newCategory,
      rating: newRating,
      comment: newComment.trim().slice(0, 600),
      verified_purchase: newVerified,
      loyalty_label: newLoyaltyLabel.trim() || null,
      is_published: true,
      featured: newFeatured,
      created_at: new Date().toISOString(),
    };

    const nextList = [created, ...items];
    setItems(nextList);
    setNewAuthorName('');
    setNewComment('');
    await persistTestimonials(nextList, 'Novo depoimento adicionado e salvo na vitrine pública.');
  };

  const handleDelete = async (id: string) => {
    const nextList = items.filter((item) => item.id !== id);
    setItems(nextList);
    await persistTestimonials(nextList, 'Depoimento removido da vitrine.');
  };

  const handleRestoreDefaults = () => {
    setItems(DEFAULT_FAN_TESTIMONIALS.map((d) => ({ ...d })));
    setFeedback({
      type: 'ok',
      text: 'Depoimentos modelo restaurados no formulário. Clique em "Salvar Alterações" para aplicar.',
    });
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/15 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A5412]">
            Prova Social · Vitrine Pública
          </p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Depoimentos dos Fãs
          </h2>
          <p className="text-xs text-[#524B45] mt-1">
            Modere comentários enviados por compradores reais no site público, destaque avaliações favoritas ou adicione depoimentos verificados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#181615]/25 bg-[#F3EFEA] px-3.5 py-2 text-xs font-semibold text-[#181615] hover:border-[#181615] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Modelos
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => persistTestimonials(items)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5 text-[#E5C158]" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#524B45]">Publicados na Vitrine</p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums mt-1">
            {stats.totalCount}{' '}
            <span className="text-xs font-normal text-[#524B45]">/ {items.length} cadastrados</span>
          </p>
        </div>
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#524B45]">Nota Média Exibida</p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums mt-1">
            {stats.averageRating.toFixed(1)} / 5.0
          </p>
        </div>
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#524B45]">Compras Verificadas</p>
          <p className="font-mono text-2xl font-bold text-[#7A5412] tabular-nums mt-1">
            {stats.verifiedCount} verificados
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-sm border p-3 text-xs ${
            feedback.type === 'ok'
              ? 'border-emerald-700/35 bg-emerald-50 text-emerald-900'
              : 'border-rose-700/35 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.type === 'ok' && <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Add Testimonial Form */}
      <form
        onSubmit={handleAddNew}
        className="rounded-sm border border-[#181615]/25 bg-[#F3EFEA] p-5 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-[#181615]/15 pb-3">
          <Plus className="h-4 w-4 text-[#7A5412]" />
          <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[#181615]">
            Adicionar Depoimento Manualmente
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#181615] mb-1">Nome do Fã *</label>
            <input
              type="text"
              maxLength={60}
              value={newAuthorName}
              onChange={(e) => setNewAuthorName(e.target.value)}
              placeholder="Ex: Bruno Henrique"
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181615] mb-1">Cidade / UF</label>
            <input
              type="text"
              maxLength={50}
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Ex: Porto Alegre, RS"
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181615] mb-1">Categoria</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as TestimonialCategory)}
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
            >
              {Object.entries(TESTIMONIAL_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181615] mb-1">Nível de Lealdade</label>
            <select
              value={newLoyaltyLabel}
              onChange={(e) => setNewLoyaltyLabel(e.target.value)}
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
            >
              <option value="Fã VIP Ouro">Fã VIP Ouro</option>
              <option value="Fã Prata">Fã Prata</option>
              <option value="Fã Bronze">Fã Bronze</option>
              <option value="Assinante VIP">Assinante VIP</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#181615] mb-1">Nota (1–5)</label>
            <select
              value={newRating}
              onChange={(e) => setNewRating(Number(e.target.value))}
              className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} Estrelas
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#181615] mb-1">
            Comentário do Fã (15 a 600 caracteres) *
          </label>
          <textarea
            rows={2}
            maxLength={600}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escreva o relato verificado recebido via WhatsApp ou comprador..."
            className="w-full rounded-sm border border-[#181615]/25 bg-white px-3 py-2 text-xs text-[#181615]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#181615]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newVerified}
                onChange={(e) => setNewVerified(e.target.checked)}
                className="rounded border-[#181615]/30"
              />
              <span>Exibir selo Compra Verificada</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newFeatured}
                onChange={(e) => setNewFeatured(e.target.checked)}
                className="rounded border-[#181615]/30"
              />
              <span>Destacar cartão em escuro</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#181615] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[#E5C158]" />
            Adicionar à Vitrine
          </button>
        </div>
      </form>

      {/* Existing Testimonials Editor List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#524B45]">
          <MessageSquareQuote className="h-4 w-4 text-[#7A5412]" />
          <span>Lista de Depoimentos ({items.length})</span>
        </div>

        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-sm border p-4 sm:p-5 space-y-3 ${
              item.is_published
                ? 'border-[#181615]/25 bg-white'
                : 'border-[#181615]/15 bg-[#EFEBE5] opacity-75'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#181615]/10 pb-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-mono text-[11px] text-[#524B45]">
                  {formatDateShort(item.created_at)}
                </span>
                {item.author_email && (
                  <span className="font-mono text-[11px] text-[#7A5412]">{item.author_email}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateField(item.id, 'verified_purchase', !item.verified_purchase)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    item.verified_purchase
                      ? 'border-emerald-700/40 bg-emerald-50 text-emerald-900'
                      : 'border-[#181615]/20 bg-[#F3EFEA] text-[#524B45]'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {item.verified_purchase ? 'Verificado' : 'Não Verif.'}
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateField(item.id, 'featured', !item.featured)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    item.featured
                      ? 'border-[#181615] bg-[#181615] text-[#E5C158]'
                      : 'border-[#181615]/20 bg-[#F3EFEA] text-[#524B45]'
                  }`}
                >
                  <Star className={`h-3 w-3 ${item.featured ? 'fill-[#E5C158]' : ''}`} />
                  {item.featured ? 'Destaque' : 'Comum'}
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateField(item.id, 'is_published', !item.is_published)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    item.is_published
                      ? 'border-[#181615]/30 bg-[#F3EFEA] text-[#181615]'
                      : 'border-amber-700/40 bg-amber-50 text-amber-900'
                  }`}
                >
                  {item.is_published ? (
                    <>
                      <Eye className="h-3 w-3" />
                      Publicado
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Oculto
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Excluir depoimento de ${item.author_name}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-rose-700/30 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                maxLength={60}
                value={item.author_name}
                onChange={(e) => handleUpdateField(item.id, 'author_name', e.target.value)}
                aria-label="Nome do autor"
                className="rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#181615]"
              />
              <input
                type="text"
                maxLength={50}
                value={item.author_location}
                onChange={(e) => handleUpdateField(item.id, 'author_location', e.target.value)}
                aria-label="Localização do autor"
                className="rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#181615]"
              />
              <select
                value={item.category}
                onChange={(e) =>
                  handleUpdateField(item.id, 'category', e.target.value as TestimonialCategory)
                }
                aria-label="Categoria do depoimento"
                className="rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#181615]"
              >
                {Object.entries(TESTIMONIAL_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                maxLength={32}
                value={item.loyalty_label || ''}
                onChange={(e) => handleUpdateField(item.id, 'loyalty_label', e.target.value || null)}
                placeholder="Selo de Lealdade"
                aria-label="Selo de lealdade"
                className="rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#181615]"
              />
              <select
                value={item.rating}
                onChange={(e) => handleUpdateField(item.id, 'rating', Number(e.target.value))}
                aria-label="Nota em estrelas"
                className="rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#181615]"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} Estrelas
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              maxLength={600}
              value={item.comment}
              onChange={(e) => handleUpdateField(item.id, 'comment', e.target.value)}
              className="w-full rounded-sm border border-[#181615]/20 bg-[#FAF8F5] px-3 py-2 text-xs text-[#181615]"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

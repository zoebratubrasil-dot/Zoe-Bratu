import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageSquareQuote, ShieldCheck, Star, Plus, X, Send, CheckCircle2 } from 'lucide-react';
import type { CreatorProfile, FanAccount, FanTestimonial, TestimonialCategory } from '../types';
import {
  TESTIMONIAL_CATEGORY_LABELS,
  computeTestimonialStats,
  resolveTestimonials,
} from '../lib/testimonials';
import { formatDateShort } from '../lib/format';

interface FanTestimonialsSectionProps {
  profile: CreatorProfile;
  fan: FanAccount | null;
  onTestimonialAdded: () => Promise<void> | void;
}

type CategoryFilter = 'all' | 'video_call' | 'site_media' | 'instagram' | 'tip';

export const FanTestimonialsSection: React.FC<FanTestimonialsSectionProps> = ({
  profile,
  fan,
  onTestimonialAdded,
}) => {
  const testimonials = useMemo(
    () => resolveTestimonials(profile.testimonials).filter((item) => item.is_published),
    [profile.testimonials]
  );

  const stats = useMemo(() => computeTestimonialStats(testimonials), [testimonials]);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);

  const [authorEmail, setAuthorEmail] = useState(fan?.email || '');
  const [authorName, setAuthorName] = useState(fan?.display_name || '');
  const [authorLocation, setAuthorLocation] = useState('');
  const [category, setCategory] = useState<TestimonialCategory>('video_call');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (fan?.email) {
      setAuthorEmail((prev) => prev || fan.email);
    }
    if (fan?.display_name) {
      setAuthorName((prev) => prev || fan.display_name || '');
    }
  }, [fan?.email, fan?.display_name]);

  const visibleTestimonials = useMemo(() => {
    const filtered = testimonials.filter((item) => {
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'site_media') {
        return item.category === 'vip_subscription' || item.category === 'ppv';
      }
      return item.category === categoryFilter;
    });
    return [...filtered].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [testimonials, categoryFilter]);

  const filterButtons: Array<{ id: CategoryFilter; label: string; count: number }> = (
    [
      { id: 'all', label: 'Todos', count: testimonials.length },
      {
        id: 'video_call',
        label: 'Vídeo Chamada 1:1',
        count: testimonials.filter((t) => t.category === 'video_call').length,
      },
      {
        id: 'site_media',
        label: 'Fotos & Vídeos no Site',
        count: testimonials.filter((t) => t.category === 'vip_subscription' || t.category === 'ppv').length,
      },
      {
        id: 'instagram',
        label: 'Mensagens no Instagram',
        count: testimonials.filter((t) => t.category === 'instagram').length,
      },
      {
        id: 'tip',
        label: 'Mimos VIP',
        count: testimonials.filter((t) => t.category === 'tip').length,
      },
    ] as Array<{ id: CategoryFilter; label: string; count: number }>
  ).filter((btn) => btn.id === 'all' || btn.count > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const resp = await fetch('/api/storefront/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authorEmail.trim(),
          authorName: authorName.trim(),
          authorLocation: authorLocation.trim() || 'Brasil',
          category,
          rating,
          comment: comment.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSubmitError(data.error || 'Não foi possível validar seu depoimento.');
        return;
      }
      setComment('');
      setSubmitSuccess(
        'Depoimento verificado publicado com sucesso na vitrine! Obrigado por compartilhar sua experiência.'
      );
      await onTestimonialAdded();
    } catch {
      setSubmitError('Erro de conexão ao enviar depoimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (score: number, lightText = false) => (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${score} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= score
              ? 'fill-[#E5C158] text-[#E5C158]'
              : lightText
              ? 'text-[#6A635D]'
              : 'text-[#C4BEB7]'
          }`}
        />
      ))}
    </div>
  );

  return (
    <section
      id="depoimentos-fas"
      className="bg-[#E4E0DC] text-[#1C1918] border-b border-[#2B2725]/25 p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8"
    >
      {/* Editorial Section Header + Action Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#2B2725]/20 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A5412]">
            <MessageSquareQuote className="h-3.5 w-3.5 text-[#7A5412]" />
            <span>Avaliações Verificadas de Homens Atendidos · +18</span>
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918]">
            Depoimentos dos Fãs
          </h2>
          <p className="text-sm text-[#4A4440] leading-relaxed">
            Relatos reais de homens que vivenciaram a atuação da {profile.display_name} nas vídeo chamadas 1:1, aprovaram seu material fotográfico e vídeos no site e receberam mensagens no Instagram exatamente como combinado.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setComposerOpen((prev) => !prev);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm border border-[#1C1918] bg-[#1C1918] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {composerOpen ? (
            <>
              <X className="h-3.5 w-3.5 text-[#E5C158]" />
              <span>Fechar Formulário</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 text-[#E5C158]" />
              <span>Escrever Depoimento Verificado</span>
            </>
          )}
        </button>
      </div>

      {/* Social Proof Metrics Strip (Hairline 1px grid, zero-pill numeric clarity) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#2B2725]/25 bg-[#EAE6E2] divide-y sm:divide-y-0 sm:divide-x divide-[#2B2725]/20">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#4A4440] font-semibold">
              Nota Média dos Fãs
            </p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1918] tabular-nums mt-1">
              {stats.averageRating.toFixed(1)}
              <span className="text-sm font-normal text-[#6A635D]"> / 5.0</span>
            </p>
          </div>
          {renderStars(Math.round(stats.averageRating))}
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#4A4440] font-semibold">
              Comentários Verificados
            </p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1918] tabular-nums mt-1">
              {stats.verifiedCount}
            </p>
          </div>
          <ShieldCheck className="h-6 w-6 text-[#7A5412] shrink-0" />
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#4A4440] font-semibold">
              Satisfação Comprovada
            </p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#7A5412] tabular-nums mt-1">
              {stats.satisfactionPercent}%
            </p>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#4A4440] text-right">
            Pix & Clube VIP
          </span>
        </div>
      </div>

      {/* Collapsible Verified Buyer Submission Form */}
      <AnimatePresence initial={false}>
        {composerOpen && (
          <motion.form
            key="testimonial-composer"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={handleSubmit}
            className="rounded-sm border border-[#1C1918] bg-[#2B2725] text-[#F4F1ED] p-5 sm:p-7 space-y-5"
          >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#453F3B] pb-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E5C158]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validação Automática por Compra Confirmada</span>
              </p>
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#F4F1ED] mt-1">
                Compartilhe sua Experiência com {profile.display_name}
              </h3>
            </div>
            <span className="font-mono text-[11px] text-[#C7C1BA] tabular-nums">
              {comment.length}/600
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3] mb-1.5">
                E-mail da Compra *
              </label>
              <input
                type="email"
                required
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full min-h-[42px] rounded-sm border border-[#453F3B] bg-[#181615] px-3 py-2 text-xs text-[#F4F1ED] placeholder:text-[#7A726B] focus:border-[#E5C158] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3] mb-1.5">
                Nome / Apelido Público *
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ex: Rafael M."
                className="w-full min-h-[42px] rounded-sm border border-[#453F3B] bg-[#181615] px-3 py-2 text-xs text-[#F4F1ED] placeholder:text-[#7A726B] focus:border-[#E5C158] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3] mb-1.5">
                Cidade / Estado
              </label>
              <input
                type="text"
                maxLength={50}
                value={authorLocation}
                onChange={(e) => setAuthorLocation(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                className="w-full min-h-[42px] rounded-sm border border-[#453F3B] bg-[#181615] px-3 py-2 text-xs text-[#F4F1ED] placeholder:text-[#7A726B] focus:border-[#E5C158] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3] mb-1.5">
                Experiência Adquirida
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TestimonialCategory)}
                className="w-full min-h-[42px] rounded-sm border border-[#453F3B] bg-[#181615] px-3 py-2 text-xs text-[#F4F1ED] focus:border-[#E5C158] focus:outline-none"
              >
                <option value="video_call">Vídeo Chamada 1:1</option>
                <option value="instagram">Mensagens no Instagram</option>
                <option value="vip_subscription">Clube VIP · Fotos & Vídeos</option>
                <option value="ppv">Fotos & Vídeos Avulsos</option>
                <option value="tip">Mimo & Atendimento VIP</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3]">
                Sua Avaliação:
              </span>
              <div className="inline-flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    aria-label={`Dar ${star} estrelas`}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= rating ? 'fill-[#E5C158] text-[#E5C158]' : 'text-[#6A635D]'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-[#E5C158] tabular-nums">{rating}.0 / 5.0</span>
            </div>
            <p className="text-[11px] text-[#C7C1BA]">
              Seu e-mail nunca é exibido na vitrine — serve apenas para autenticar sua compra e calcular seu Nível de Lealdade.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#DED9D3] mb-1.5">
              Seu Depoimento Verificado (15 a 600 caracteres) *
            </label>
            <textarea
              required
              minLength={15}
              maxLength={600}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Conte como foi sua vídeo chamada com ${profile.display_name}, o que achou das fotos e vídeos do site ou das mensagens no Instagram como combinado...`}
              className="w-full rounded-sm border border-[#453F3B] bg-[#181615] px-3.5 py-2.5 text-sm text-[#F4F1ED] placeholder:text-[#7A726B] focus:border-[#E5C158] focus:outline-none"
            />
          </div>

          {submitError && (
            <p className="rounded-sm border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200 leading-relaxed">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <div className="flex items-start gap-2.5 rounded-sm border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs text-emerald-200 leading-relaxed">
              <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm bg-[#E5C158] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Validando Compra...' : 'Publicar Depoimento Verificado'}</span>
            </button>
          </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Category Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {filterButtons.map((btn) => {
          const isActive = categoryFilter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => setCategoryFilter(btn.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-sm border text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#1C1918] bg-[#1C1918] text-[#F4F1ED]'
                  : 'border-[#2B2725]/25 bg-[#EAE6E2] text-[#4A4440] hover:border-[#1C1918] hover:text-[#1C1918]'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          );
        })}
      </div>

      {/* Testimonials Editorial Grid (1 col mobile / 2 col tablet / 3 col desktop) */}
      {visibleTestimonials.length === 0 ? (
        <div className="border border-[#2B2725]/25 bg-[#EAE6E2] p-8 text-center text-xs text-[#4A4440]">
          Nenhum depoimento publicado nesta categoria ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {visibleTestimonials.map((item: FanTestimonial, idx: number) => {
            const isFeatured = Boolean(item.featured);
            return (
              <motion.article
                key={`${categoryFilter}-${item.id}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{
                  duration: 0.42,
                  delay: Math.min(idx, 5) * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`flex flex-col justify-between rounded-sm border p-5 sm:p-6 transition-[transform,colors] duration-200 hover:-translate-y-0.5 ${
                  isFeatured
                    ? 'border-[#1C1918] bg-[#2B2725] text-[#F4F1ED]'
                    : 'border-[#2B2725]/25 bg-[#EAE6E2] text-[#1C1918] hover:border-[#1C1918]/60'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Metadata Row: Unboxed inline text with · separators (Zero-Pill Rule) */}
                  <div
                    className={`flex items-center justify-between gap-2 pb-3 border-b ${
                      isFeatured ? 'border-[#453F3B]' : 'border-[#2B2725]/15'
                    }`}
                  >
                    {renderStars(item.rating, isFeatured)}

                    {item.verified_purchase && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${
                          isFeatured ? 'text-[#E5C158]' : 'text-[#7A5412]'
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>Compra Verificada</span>
                      </span>
                    )}
                  </div>

                  {/* Quote Body */}
                  <blockquote
                    className={`text-sm leading-relaxed ${
                      isFeatured ? 'text-[#F4F1ED]' : 'text-[#2B2725]'
                    }`}
                  >
                    “{item.comment}”
                  </blockquote>
                </div>

                {/* Bottom Attribution & Category Metadata Line */}
                <div
                  className={`mt-5 pt-3.5 border-t space-y-1.5 ${
                    isFeatured ? 'border-[#453F3B]' : 'border-[#2B2725]/15'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`font-display text-lg font-bold uppercase tracking-tight truncate ${
                        isFeatured ? 'text-[#F4F1ED]' : 'text-[#1C1918]'
                      }`}
                    >
                      {item.author_name}
                    </p>
                    <span
                      className={`text-[11px] font-mono shrink-0 ${
                        isFeatured ? 'text-[#C7C1BA]' : 'text-[#524B45]'
                      }`}
                    >
                      {item.author_location}
                    </span>
                  </div>

                  <p
                    className={`text-[11px] font-mono tracking-wide flex flex-wrap items-center gap-x-1.5 ${
                      isFeatured ? 'text-[#C7C1BA]' : 'text-[#524B45]'
                    }`}
                  >
                    <span className={isFeatured ? 'text-[#E5C158] font-semibold' : 'text-[#7A5412] font-semibold'}>
                      {TESTIMONIAL_CATEGORY_LABELS[item.category]}
                    </span>
                    {item.loyalty_label && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.loyalty_label}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDateShort(item.created_at)}</span>
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
};

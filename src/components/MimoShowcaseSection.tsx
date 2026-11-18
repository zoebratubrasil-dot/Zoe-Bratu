import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Gift, Heart, Sparkles, Crown, Wine, ArrowRight, Flame } from 'lucide-react';
import type { CreatorProfile, MimoGiftTier } from '../types';
import { resolveMimoSectionConfig } from '../lib/mimoGifts';
import { formatBrl } from '../lib/format';
import { ProtectedImage } from './ProtectedMedia';

interface MimoShowcaseSectionProps {
  profile: CreatorProfile;
  avatarImgFailed: boolean;
  onOpenTipModal: (presetAmount?: number) => void;
}

const renderTierIcon = (icon: MimoGiftTier['icon'], featured?: boolean) => {
  const cls = `h-4 w-4 ${featured ? 'text-[#1C1918]' : 'text-[#E5C158]'}`;
  switch (icon) {
    case 'wine':
      return <Wine className={cls} />;
    case 'heart':
      return <Heart className={`${cls} fill-current`} />;
    case 'sparkles':
      return <Sparkles className={cls} />;
    case 'crown':
      return <Crown className={cls} />;
  }
};

export const MimoShowcaseSection: React.FC<MimoShowcaseSectionProps> = ({
  profile,
  avatarImgFailed,
  onOpenTipModal,
}) => {
  const mimoConfig = useMemo(() => resolveMimoSectionConfig(profile.mimo_config), [profile.mimo_config]);
  const visibleTiers = useMemo(() => mimoConfig.tiers.filter((t) => t.active), [mimoConfig.tiers]);

  return (
    <section
      id="enviar-mimo"
      className="relative overflow-hidden border-b border-[#453F3B] bg-[#1C1918] text-[#F4F1ED] px-4 py-9 sm:px-6 sm:py-12 lg:px-10"
    >
      {/* Subtle radial velvet-amber studio lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-10 h-72 w-72 rounded-full bg-[#E5C158]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-rose-700/15 blur-3xl"
      />

      <div className="relative z-10 space-y-8">
        {/* Top Editorial Gift Concierge Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center border-b border-[#453F3B] pb-7">
          <div className="lg:col-span-8 flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Illuminated Portrait Ring */}
            <div className="relative shrink-0 h-20 w-20 sm:h-24 sm:w-24">
              <motion.div
                aria-hidden="true"
                animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.04, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-1 rounded-sm border border-[#E5C158]/70"
              />
              <div
                onContextMenu={(e) => e.preventDefault()}
                className="relative h-full w-full overflow-hidden rounded-sm border border-[#E5C158] bg-[#2B2725] media-shield"
              >
                {profile.avatar_url && !avatarImgFailed ? (
                  <ProtectedImage
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    containerClassName="h-full w-full"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-[#E5C158]">
                    {profile.display_name.slice(0, 1)}
                  </div>
                )}
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-sm border border-[#1C1918] bg-[#E5C158] text-[#1C1918] shadow-lg">
                <Gift className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono uppercase tracking-[0.16em] text-[#E5C158]">
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  {mimoConfig.section_kicker}
                </span>
                <span aria-hidden="true" className="text-[#6F665E]">·</span>
                <span className="text-[#DED9D3]">{mimoConfig.section_tag}</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-[#F4F1ED] leading-[0.96]">
                {mimoConfig.section_title}
              </h2>
              <p className="text-sm text-[#DED9D3] max-w-2xl leading-relaxed whitespace-pre-line break-words">
                {mimoConfig.section_description}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenTipModal()}
              className="mimo-shimmer-btn group w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2.5 rounded-sm px-6 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FAF8F5] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              <Gift className="h-4 w-4 text-[#E5C158] transition-transform duration-200 group-hover:rotate-[-10deg] group-hover:scale-110" />
              <span>{mimoConfig.cta_label}</span>
              <ArrowRight className="h-4 w-4 text-[#E5C158] transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#C7C1BA] text-center lg:text-right">
              Pix instantâneo · Dedicatória privada
            </p>
          </div>
        </div>

        {/* 6 Editable Luxury Gift Cards */}
        {visibleTiers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {visibleTiers.map((tier, idx) => {
              const isFeatured = Boolean(tier.featured);
              return (
                <motion.article
                  key={tier.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => onOpenTipModal(tier.amount_brl)}
                  className={`mimo-card-sheen group relative flex flex-col justify-between rounded-sm border p-5 cursor-pointer transition-colors ${
                    isFeatured
                      ? 'border-[#E5C158] bg-gradient-to-b from-[#332924] via-[#2B2725] to-[#1E1A18] shadow-[0_12px_32px_-12px_rgba(229,193,88,0.35)]'
                      : 'border-[#453F3B] bg-[#23201E] hover:border-[#E5C158]/70'
                  }`}
                >
                  {isFeatured && (
                    <>
                      <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 h-2.5 w-2.5 border-t border-l border-[#E5C158]" />
                      <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 border-t border-r border-[#E5C158]" />
                    </>
                  )}

                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border ${
                          isFeatured
                            ? 'border-[#E5C158] bg-[#E5C158] text-[#1C1918]'
                            : 'border-[#453F3B] bg-[#1C1918]'
                        }`}
                      >
                        {renderTierIcon(tier.icon, isFeatured)}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 border ${
                          isFeatured
                            ? 'border-[#E5C158]/60 bg-[#E5C158]/15 text-[#E5C158] font-semibold'
                            : 'border-[#453F3B] bg-[#1C1918] text-[#C7C1BA]'
                        }`}
                      >
                        {tier.badge}
                      </span>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#C7C1BA]">
                        Mimo 0{idx + 1}
                      </p>
                      <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#F4F1ED] mt-0.5">
                        {tier.title}
                      </h3>
                      <p className="text-xs text-[#E5C158] font-medium mt-0.5">{tier.subtitle}</p>
                    </div>

                    <p className="font-mono text-3xl font-bold text-[#E5C158] tabular-nums">
                      {formatBrl(tier.amount_brl)}
                    </p>

                    <p className="text-xs text-[#DED9D3] leading-relaxed border-t border-[#453F3B]/80 pt-3 whitespace-pre-line break-words">
                      {tier.perk}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#453F3B] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] group-hover:text-[#E5C158] transition-colors">
                    <span>{mimoConfig.card_cta_label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#E5C158] transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-sm border border-[#453F3B] bg-[#23201E] p-6 text-center text-xs text-[#C7C1BA]">
            Nenhuma opção de mimo disponível no momento. Você ainda pode enviar um valor personalizado clicando no botão acima.
          </div>
        )}
      </div>
    </section>
  );
};

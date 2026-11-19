import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Play, Eye, Search, UserCheck, UserPlus, Image as ImageIcon, Film, Heart, Gift, Video, Clock, ArrowRight, Aperture, MessageCircle, Award } from 'lucide-react';
import type { CreatorProfile, FanAccount, MediaItem, StorefrontStats, VideoCallPlan } from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';
import { resolveVideoCallPlans } from '../lib/videoCalls';
import { buildWhatsappReceiptUrl } from '../lib/whatsapp';
import { computeFanLoyalty } from '../lib/loyalty';
import { generateMediaAlt, generateProfileImageAlt } from '../lib/mediaAlt';
import { ProtectedImage, ProtectedVideo } from './ProtectedMedia';
import { AboutCreatorPanel } from './AboutCreatorPanel';
import { MimoShowcaseSection } from './MimoShowcaseSection';
import { FanTestimonialsSection } from './FanTestimonialsSection';
import { FaqAeoSection } from './FaqAeoSection';
import { LoyaltyBadge } from './LoyaltyBadge';
import videoCallCameraHero from '../assets/images/video_call_camera_hero_1794853603138.jpg';

const CREATOR_LIVE_CALL_PHOTO = '/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';
const FALLBACK_PHOTO_COVER = '/api/media/fallback/photo';
const FALLBACK_VIDEO_COVER = '/api/media/fallback/video';

const CinemaCameraMark: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg
    viewBox="0 0 36 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <rect x="2" y="5" width="21" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    <path d="M23 9.5L33 5.5V19.5L23 15.5V9.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    <circle cx="9.5" cy="2.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="16.5" cy="2.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12.5" cy="12.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

interface StorefrontProps {
  loading: boolean;
  profile: CreatorProfile;
  mediaItems: MediaItem[];
  fan: FanAccount | null;
  stats: StorefrontStats;
  onSelectMedia: (item: MediaItem) => void;
  onSelectVideoCallPlan: (plan: VideoCallPlan) => void;
  onOpenVipModal: () => void;
  onOpenTipModal: (presetAmount?: number) => void;
  onOpenFanLogin: (tab?: 'register' | 'login') => void;
  onOpenFanAccount: () => void;
  onLogoutFan: () => void;
  onTestimonialsUpdated?: () => Promise<void> | void;
  favoriteIds?: string[];
  onToggleFavorite?: (mediaId: string) => void;
}

type TypeFilter = 'all' | 'photo' | 'video' | 'vip' | 'ppv' | 'free' | 'favorites';

export const Storefront: React.FC<StorefrontProps> = ({
  loading,
  profile,
  mediaItems,
  fan,
  stats,
  onSelectMedia,
  onSelectVideoCallPlan,
  onOpenVipModal,
  onOpenTipModal,
  onOpenFanLogin,
  onOpenFanAccount,
  onLogoutFan,
  onTestimonialsUpdated,
  favoriteIds = [],
  onToggleFavorite,
}) => {
  const videoCallPlans = useMemo(
    () => resolveVideoCallPlans(profile.video_call_plans).filter((p) => p.active),
    [profile.video_call_plans]
  );
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [profile.hero_url]);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [profile.avatar_url]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const item of mediaItems) {
      if (item.collection_name) set.add(item.collection_name);
    }
    return ['all', ...Array.from(set)];
  }, [mediaItems]);

  const filteredMedia = useMemo(() => {
    return mediaItems.filter((item) => {
      if (filter === 'photo' && item.media_type !== 'photo') return false;
      if (filter === 'video' && item.media_type !== 'video') return false;
      if (filter === 'vip' && item.access_tier !== 'vip') return false;
      if (filter === 'ppv' && item.access_tier !== 'ppv') return false;
      if (filter === 'free' && item.access_tier !== 'free') return false;
      if (filter === 'favorites' && !favoriteSet.has(item.id)) return false;
      if (collectionFilter !== 'all' && item.collection_name !== collectionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.title} ${item.description} ${item.collection_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mediaItems, filter, favoriteSet, collectionFilter, searchQuery]);

  const activeFavoritesCount = useMemo(
    () => mediaItems.filter((item) => favoriteSet.has(item.id)).length,
    [mediaItems, favoriteSet]
  );

  const filterOptions: Array<{ id: TypeFilter; label: string }> = [
    { id: 'all', label: 'Tudo' },
    { id: 'photo', label: 'Fotos' },
    { id: 'video', label: 'Vídeos' },
    { id: 'vip', label: 'Clube VIP' },
    { id: 'ppv', label: 'Avulsos' },
    { id: 'free', label: 'Prévias' },
    { id: 'favorites', label: `Favoritos (${activeFavoritesCount})` },
  ];

  return (
    <main className="mx-auto max-w-[1440px] border-x border-[#2B2725]/20 bg-[#E4E0DC]">
      {/* Compact Mobile & Small-Tablet Section & Internauta Cadastro Jump Bar */}
      <nav
        aria-label="Navegação rápida das páginas públicas e cadastro"
        className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#2B2725]/25 bg-[#DDD8D2] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1C1918]"
      >
        {[
          { id: 'sobre-criadora', label: 'Sobre' },
          { id: 'video-chamada', label: 'Vídeo Chamada' },
          { id: 'enviar-mimo', label: '6 Mimos' },
          { id: 'vitrine-grid', label: 'Galeria 35mm' },
          { id: 'depoimentos-fas', label: 'Depoimentos' },
          { id: 'clube-vip', label: 'Clube VIP' },
        ].map((navLink) => (
          <button
            key={navLink.id}
            type="button"
            onClick={() => document.getElementById(navLink.id)?.scrollIntoView({ behavior: 'smooth' })}
            className="min-h-[36px] px-3 py-1.5 rounded-sm border border-[#2B2725]/25 bg-[#EAE6E2] hover:border-[#1C1918] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {navLink.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => (fan ? onOpenFanAccount() : onOpenFanLogin('register'))}
          className="min-h-[36px] px-3 py-1.5 rounded-sm border border-[#1C1918] bg-[#1C1918] text-[#E5C158] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {fan ? 'Minha Conta' : 'Cadastro / Entrar'}
        </button>
      </nav>

      {/* BLOCK 1: Editorial Lookbook Hero Masthead */}
      <section className="bg-[#E4E0DC] text-[#1C1918] border-b border-[#2B2725]/25">
        {/* Top Masthead Index Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-[#2B2725]/20 px-4 sm:px-6 py-2.5 sm:py-3 lg:px-10 text-[11px] sm:text-xs uppercase tracking-[0.1em] sm:tracking-[0.12em] text-[#4A4440]">
          <span className="font-display italic text-sm normal-case tracking-normal text-[#1C1918] font-semibold">
            Acervo Privado · Criadora Solo Verificada +18
          </span>
          <span className="font-mono text-[10px] sm:text-[11px]">
            {profile.handle} · {profile.location}
          </span>
        </div>

        {/* Masthead Split Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between p-5 sm:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#2B2725]/20">
            <div className="space-y-5 sm:space-y-6">
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div className="h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-sm border border-[#2B2725]/35 bg-[#2B2725] shrink-0">
                  {profile.avatar_url && !avatarImgFailed ? (
                    <ProtectedImage
                      src={profile.avatar_url}
                      alt={generateProfileImageAlt('avatar', profile.display_name, profile.location)}
                      loading="lazy"
                      onError={() => setAvatarImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-[#E5C158]">
                      {profile.display_name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-[#4A4440]">
                  <p className="font-semibold uppercase tracking-[0.1em] text-[#1C1918]">
                    Portfolio & Clube Privado
                  </p>
                  <p className="truncate mt-0.5">{profile.handle} · Acesso +18</p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold uppercase tracking-[-0.02em] text-[#1C1918] leading-[0.94]">
                  {profile.display_name}
                </h1>
                <p className="text-sm sm:text-base text-[#3D3835] leading-relaxed max-w-xl">
                  {profile.bio}
                </p>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-[#2B2725]/20 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={onOpenVipModal}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center rounded-sm bg-[#1C1918] px-5 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Assinar Clube VIP · {formatBrl(profile.vip_monthly_price_brl)}/mês
              </button>
              <button
                type="button"
                onClick={() => onOpenTipModal()}
                className="mimo-shimmer-btn group w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] transition-transform duration-200 hover:-translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Gift className="h-3.5 w-3.5 text-[#E5C158] transition-transform duration-200 group-hover:rotate-[-12deg] group-hover:scale-110" />
                <span>Enviar Mimo · Surpreenda</span>
              </button>
              <button
                type="button"
                onClick={() => (fan ? onOpenFanAccount() : onOpenFanLogin('register'))}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm border border-[#2B2725]/35 bg-[#EAE6E2] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {fan ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5 text-[#7A5412]" />
                    <span>Minha Conta · {fan.loyalty?.tier_label || 'Assinante'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5 text-[#7A5412]" />
                    <span>Criar Cadastro / Entrar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Editorial Hero Portrait Block */}
          <div
            onContextMenu={(e) => e.preventDefault()}
            className="lg:col-span-5 relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto min-h-[300px] sm:min-h-[360px] lg:min-h-[460px] overflow-hidden bg-[#2B2725] media-shield"
          >
            {profile.hero_url && !heroImgFailed ? (
              <ProtectedImage
                src={profile.hero_url}
                alt={generateProfileImageAlt('hero', profile.display_name, profile.location)}
                loading="lazy"
                onError={() => setHeroImgFailed(true)}
                containerClassName="h-full w-full lg:absolute lg:inset-0"
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#23201E] p-10 text-center">
                <ImageIcon className="h-10 w-10 text-[#9B948D] mb-3" />
                <p className="font-display text-2xl font-bold uppercase text-[#F4F1ED]">
                  {profile.display_name}
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#1C1918]/85 via-[#1C1918]/20 to-transparent" />
            <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[#E5C158] font-medium">
                  Acervo Privado Exclusivo
                </p>
                <p className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-[#F4F1ED]">
                  Fotos em alta resolução & vídeos privados
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Espresso Charcoal Stats Ribbon */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-b border-[#453F3B] bg-[#2B2725] text-[#F4F1ED] [&>*:nth-child(odd)]:border-r lg:[&>*:nth-child(odd)]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0 lg:divide-x divide-[#453F3B]">
        <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Fotos Exclusivas</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.totalPhotos}</p>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Vídeos Privados</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.totalVideos}</p>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Coleções Publicadas</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.collectionsCount}</p>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Assinatura Mensal VIP</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(profile.vip_monthly_price_brl)}
          </p>
        </div>
      </section>

      {/* BLOCK 2: 2-Column Editorial Split ("SOBRE A CRIADORA" Charcoal Left / "VIDEO CALL RATE CARD" Light Stone Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#2B2725]/25">
        <AboutCreatorPanel
          profile={profile}
          avatarImgFailed={avatarImgFailed}
          videoCallPlans={videoCallPlans}
          onSelectVideoCallPlan={onSelectVideoCallPlan}
          onOpenVipModal={onOpenVipModal}
          onOpenTipModal={onOpenTipModal}
        />

        {/* Right Light Stone Panel: Featured Vídeo Chamada ao Vivo (4 Editable Plans) */}
        <div
          id="video-chamada"
          className="lg:col-span-7 bg-[#E4E0DC] text-[#1C1918] p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#2B2725]/20 pb-4">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A5412]">
                <CinemaCameraMark className="h-4 w-5 text-[#7A5412]" />
                <span>Somente 1 Internauta + Modelo · Pagamento via Pix</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918] mt-1">
                Vídeo Chamada Privativa 1:1
              </h2>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#7A5412] font-semibold self-start sm:self-auto">
              Reserva Imediata · Pix
            </span>
          </div>

          <p className="text-sm text-[#3D3835] leading-relaxed">
            <strong>Atendimento estritamente individual:</strong> apenas <strong>1 internauta + {profile.display_name}</strong> ao vivo frente à câmera em sala privada fechada (sem chamadas em grupo). Escolha sua duração e libere exclusivamente perante pagamento via <strong>Pix</strong>.
          </p>

          {/* Creative Live 1-on-1 Video Call Showcase Strip */}
          {(() => {
            const featuredPlan = videoCallPlans[2] || videoCallPlans[0] || null;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
                {/* Main Frame: Uploaded Creator Photo Live on Camera for Buyer */}
                <button
                  type="button"
                  onClick={() => featuredPlan && onSelectVideoCallPlan(featuredPlan)}
                  disabled={!featuredPlan}
                  className="group relative sm:col-span-5 aspect-[4/5] sm:aspect-auto sm:min-h-[280px] overflow-hidden rounded-sm border border-[#2B2725] bg-[#1C1918] text-left cursor-pointer disabled:cursor-default"
                >
                  <ProtectedImage
                    src={CREATOR_LIVE_CALL_PHOTO}
                    alt={generateProfileImageAlt('video_call', profile.display_name, profile.location)}
                    loading="lazy"
                    containerClassName="absolute inset-0 h-full w-full"
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                    fallback={
                      <div className="flex h-full w-full flex-col items-center justify-center bg-[#23201E] text-[#E5C158] p-4">
                        <CinemaCameraMark className="h-10 w-12 mb-2" />
                        <span className="text-xs uppercase tracking-widest">Ao Vivo 1 a 1</span>
                      </div>
                    }
                  />
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#1C1918]/95 via-[#1C1918]/15 to-[#1C1918]/60" />

                  {/* Optical Viewfinder Corner Reticles */}
                  <span aria-hidden="true" className="pointer-events-none absolute top-3 left-3 z-20 h-3.5 w-3.5 border-t-2 border-l-2 border-[#E5C158]" />
                  <span aria-hidden="true" className="pointer-events-none absolute top-3 right-3 z-20 h-3.5 w-3.5 border-t-2 border-r-2 border-[#E5C158]" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 z-20 h-3.5 w-3.5 border-b-2 border-l-2 border-[#E5C158]" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 z-20 h-3.5 w-3.5 border-b-2 border-r-2 border-[#E5C158]" />

                  {/* Top Live Room Status Strip */}
                  <div className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.1em]">
                    <span className="inline-flex items-center gap-1 text-[#E5C158] font-semibold">
                      <Video className="h-3 w-3" />
                      1 INTERNAUTA + MODELO
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#F4F1ED]/90">
                      <Lock className="h-3 w-3 text-[#E5C158]" />
                      VIA PIX
                    </span>
                  </div>

                  {/* Bottom Live Call Overlay */}
                  <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F1ED] leading-none">
                        Só Você + {profile.display_name}
                      </p>
                      <p className="text-[11px] text-[#DED9D3] mt-1">
                        Privativa 1:1 liberada no Pix
                      </p>
                    </div>
                    <CinemaCameraMark className="h-6 w-8 shrink-0 text-[#E5C158]" />
                  </div>
                </button>

                {/* Right Card: Cinema Camera + Buyer Exclusive Room Access */}
                <button
                  type="button"
                  onClick={() => featuredPlan && onSelectVideoCallPlan(featuredPlan)}
                  disabled={!featuredPlan}
                  className="group sm:col-span-7 flex flex-col justify-between overflow-hidden rounded-sm border border-[#2B2725] bg-[#2B2725] text-[#F4F1ED] text-left cursor-pointer disabled:cursor-default"
                >
                  <div className="relative h-32 sm:h-36 w-full overflow-hidden border-b border-[#453F3B] bg-[#1C1918]">
                    <ProtectedImage
                      src={videoCallCameraHero}
                      alt={generateProfileImageAlt('camera', profile.display_name, profile.location)}
                      loading="lazy"
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#2B2725] via-[#1C1918]/30 to-transparent" />
                    <div className="pointer-events-none absolute top-3 left-4 right-4 z-20 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[#E5C158]">
                      <span className="inline-flex items-center gap-1">
                        <Aperture className="h-3 w-3" />
                        CÂMERA DEDICADA 4K
                      </span>
                      <span className="text-[#F4F1ED]/80">PIX OBRIGATÓRIO</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <p className="font-display text-xl font-bold uppercase tracking-tight text-[#E5C158] leading-tight">
                        Somente 1 Internauta + Modelo · Liberada no Pix
                      </p>
                      <div className="space-y-1.5 text-xs text-[#DED9D3]">
                        <p className="flex items-center gap-2">
                          <Video className="h-3.5 w-3.5 text-[#E5C158] shrink-0" />
                          <span>Chamada individual 1 a 1: apenas você e {profile.display_name}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-[#E5C158] shrink-0" />
                          <span>Ativação exclusiva mediante pagamento instantâneo via Pix</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-[#E5C158] shrink-0" />
                          <span>Link particular enviado direto no seu WhatsApp ou @Telegram</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#453F3B] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#E5C158]">
                      <span>Reservar chamada 1:1 via Pix</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              </div>
            );
          })()}

          {videoCallPlans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videoCallPlans.map((plan, index) => {
                const isHighlight = index === 2 || (videoCallPlans.length < 3 && index === 0);
                return (
                  <article
                    key={plan.id}
                    onClick={() => onSelectVideoCallPlan(plan)}
                    className={`group relative flex flex-col justify-between rounded-sm border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                      isHighlight
                        ? 'border-[#1C1918] bg-[#2B2725] text-[#F4F1ED]'
                        : 'border-[#2B2725]/25 bg-[#EAE6E2] text-[#1C1918] hover:border-[#1C1918]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div
                        className={`flex items-center justify-between gap-2 text-xs ${
                          isHighlight ? 'text-[#C7C1BA]' : 'text-[#4A4440]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                          <Clock
                            className={`h-3.5 w-3.5 ${isHighlight ? 'text-[#E5C158]' : 'text-[#7A5412]'}`}
                          />
                          {plan.duration_minutes} minutos
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold ${
                            isHighlight ? 'text-[#E5C158]' : 'text-[#4A4440]'
                          }`}
                        >
                          <CinemaCameraMark
                            className={`h-3.5 w-5 ${isHighlight ? 'text-[#E5C158]' : 'text-[#7A5412]'}`}
                          />
                          {isHighlight ? 'Mais escolhido' : 'Na câmera'}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
                          {plan.title}
                        </h3>
                        <p
                          className={`font-mono text-2xl font-semibold tabular-nums shrink-0 ${
                            isHighlight ? 'text-[#E5C158]' : 'text-[#1C1918]'
                          }`}
                        >
                          {formatBrl(plan.price_brl)}
                        </p>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          isHighlight ? 'text-[#DED9D3]' : 'text-[#4A4440]'
                        }`}
                      >
                        {plan.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVideoCallPlan(plan);
                      }}
                      className={`mt-5 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        isHighlight
                          ? 'bg-[#E5C158] text-[#1C1918] hover:bg-[#f0cf6b]'
                          : 'bg-[#1C1918] text-[#F4F1ED] hover:bg-[#383432]'
                      }`}
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Reservar 1:1 via Pix</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border border-[#2B2725]/25 bg-[#EAE6E2] p-6 text-xs text-[#4A4440]">
              Agenda de vídeo chamadas privativas 1:1 temporariamente indisponível. Volte em breve ou envie um mimo para falar com {profile.display_name}.
            </div>
          )}
        </div>
      </section>

      {/* BLOCK 2.5: Luxury Gift / Enviar Mimo Interactive Showcase */}
      <MimoShowcaseSection
        profile={profile}
        avatarImgFailed={avatarImgFailed}
        onOpenTipModal={onOpenTipModal}
      />

      {/* BLOCK 3: Gallery Showcase ("ROLO DE CONTATO & PELÍCULA 35MM") */}
      <section id="vitrine-grid" className="bg-[#EAE6E2] text-[#1C1918] p-4 sm:p-8 lg:p-12 border-b border-[#2B2725]/25 space-y-6 sm:space-y-7">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#2B2725]/20 pb-5">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A5412]">
              <Film className="h-3.5 w-3.5 text-[#7A5412]" />
              <span>Rolo de Contato & Película 35mm · +18</span>
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918]">
              Galeria & Acervo de Conteúdo
            </h2>
            <p className="text-sm text-[#4A4440]">
              Explore cada quadro no carretel de fotos e filmes — prévias liberadas, avulsos e acervo exclusivo do Clube VIP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#4A4440] tabular-nums">
              <span>{mediaItems.filter((m) => m.access_tier === 'vip').length} VIP</span>
              <span aria-hidden="true">·</span>
              <span>{mediaItems.filter((m) => m.access_tier === 'free').length} Prévias</span>
              <span aria-hidden="true">·</span>
              <span>{mediaItems.filter((m) => m.access_tier === 'ppv').length} Avulsos</span>
            </div>

            {fan ? (() => {
              const fanLoyalty = fan.loyalty || computeFanLoyalty([]);
              return (
                <div className="w-full sm:w-auto flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#2B2725]/35 bg-[#1C1918] text-[#F4F1ED] px-3.5 sm:px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserCheck className="h-4 w-4 text-[#E5C158] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#F4F1ED] max-w-[140px] sm:max-w-[160px] truncate">
                          {fan.display_name || fan.email}
                        </span>
                        <LoyaltyBadge loyalty={fanLoyalty} size="xs" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-20 sm:w-24 overflow-hidden rounded-sm bg-[#342F2C]">
                          <div
                            className="h-full bg-gradient-to-r from-[#8A611C] via-[#E5C158] to-[#FFF0B3]"
                            style={{ width: `${fanLoyalty.progress_percent}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-[#E5C158] tabular-nums">
                          {fanLoyalty.is_gold_vip
                            ? '100% · VIP Ouro'
                            : `${fanLoyalty.purchases_count}/${fanLoyalty.gold_target_purchases} compras`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 pl-1 border-l border-[#3A3431]">
                    <button
                      type="button"
                      onClick={onOpenFanAccount}
                      className="inline-flex items-center gap-1.5 min-h-[34px] rounded-sm bg-[#E5C158] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
                    >
                      <Award className="h-3 w-3" />
                      <span>Painel da Conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogoutFan}
                      className="text-[#C7C1BA] hover:text-[#F4F1ED] underline cursor-pointer py-1"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenFanLogin('register')}
                  className="flex-1 sm:flex-none min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-sm bg-[#1C1918] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 text-[#E5C158]" />
                  <span>Criar Cadastro</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFanLogin('login')}
                  className="flex-1 sm:flex-none min-h-[42px] rounded-sm border border-[#2B2725]/35 bg-[#E4E0DC] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Já Tenho Conta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-1 p-1 rounded-sm bg-[#DDD8D2] border border-[#2B2725]/20 overflow-x-auto no-scrollbar max-w-full sm:flex-wrap sm:w-fit">
            {filterOptions.map((opt) => {
              const isActive = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`relative min-h-[38px] px-3 sm:px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive ? 'text-[#F4F1ED]' : 'text-[#4A4440] hover:text-[#1C1918]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="storefront-filter-pill"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-sm bg-[#1C1918]"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            {collections.length > 1 && (
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                aria-label="Filtrar por coleção"
                className="w-full sm:w-auto min-h-[40px] rounded-sm border border-[#2B2725]/30 bg-[#E4E0DC] px-3 py-2 text-xs font-medium text-[#1C1918] focus:border-[#1C1918] focus:outline-none"
              >
                {collections.map((col) => (
                  <option key={col} value={col}>
                    {col === 'all' ? 'Todas as coleções' : `Coleção: ${col}`}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4440]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar título ou coleção..."
                className="w-full min-h-[40px] rounded-sm border border-[#2B2725]/30 bg-[#E4E0DC] pl-9 pr-3 py-2 text-sm sm:text-xs text-[#1C1918] placeholder:text-[#6A635D] focus:border-[#1C1918] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Continuous Horizontal 35mm Cinema & Contact Sheet Filmstrip */}
        {!loading && filteredMedia.length > 0 && (
          <div className="rounded-sm border-2 border-[#181615] bg-[#181615] text-[#FAF8F5] overflow-hidden">
            {/* Film Reel Rebate Edge + Perforations Top */}
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-1.5 bg-[#12100F] text-[10px] font-mono uppercase tracking-[0.12em] sm:tracking-[0.14em] text-[#C7C1BA] border-b border-[#2B2725]">
              <span className="text-[#E5C158] font-semibold truncate">
                ROLO PRINCIPAL · PRÉVIAS & VIP
              </span>
              <span className="hidden sm:inline">
                PELÍCULA 35MM · PORTRA 400 · FILME 24FPS
              </span>
              <span className="tabular-nums shrink-0">
                {filteredMedia.length} QUADROS
              </span>
            </div>
            <div className="h-[18px] w-full film-perforations-light border-b border-[#2E2926]" aria-hidden="true" />

            {/* Continuous Scrolling Celluloid Frames */}
            <div className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory px-3 sm:px-4 py-3.5 bg-[#181615]">
              {filteredMedia.slice(0, 12).map((item, idx) => {
                const frameCode = `${String(idx + 1).padStart(2, '0')}A`;
                const unlocked = Boolean(item.is_unlocked);
                const isFav = favoriteSet.has(item.id);
                const thumbSrc = unlocked
                  ? item.media_type === 'photo'
                    ? item.media_url || item.preview_url || FALLBACK_PHOTO_COVER
                    : item.preview_url || FALLBACK_VIDEO_COVER
                  : item.preview_url || (item.media_type === 'video' ? FALLBACK_VIDEO_COVER : FALLBACK_PHOTO_COVER);

                const tierRebate =
                  item.access_tier === 'free'
                    ? 'PRÉVIA LIBERADA'
                    : item.access_tier === 'vip'
                    ? 'CLUBE VIP'
                    : formatBrl(item.price_brl);

                return (
                  <div
                    key={`strip-${item.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectMedia(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectMedia(item);
                      }
                    }}
                    className="group snap-start w-[188px] sm:w-[225px] shrink-0 text-left flex flex-col bg-[#110F0E] border border-[#342F2C] hover:border-[#E5C158] transition-colors rounded-sm overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-center justify-between px-2.5 py-1 bg-[#141211] text-[10px] font-mono uppercase tracking-wider border-b border-[#2B2725]">
                      <span className="text-[#9B948D] tabular-nums">{frameCode}</span>
                      <span
                        className={
                          item.access_tier === 'free'
                            ? 'text-emerald-300 font-semibold'
                            : item.access_tier === 'vip'
                            ? 'text-[#E5C158] font-semibold'
                            : 'text-[#F4F1ED] font-semibold'
                        }
                      >
                        {tierRebate}
                      </span>
                    </div>

                    <div
                      onContextMenu={(e) => e.preventDefault()}
                      className="relative aspect-[16/10] w-full overflow-hidden bg-black media-shield"
                    >
                      {unlocked && item.media_type === 'video' && item.media_url && (!item.preview_url || item.preview_url.includes('/api/media/fallback/')) ? (
                        <ProtectedVideo
                          src={item.media_url}
                          title={item.title}
                          controls={false}
                          muted
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <ProtectedImage
                          src={thumbSrc}
                          alt={generateMediaAlt(item, { creatorName: profile.display_name, context: 'filmstrip' })}
                          loading="lazy"
                          blurred={!unlocked}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      )}
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(item.id);
                          }}
                          aria-label={isFav ? `Remover "${item.title}" dos favoritos` : `Salvar "${item.title}" nos favoritos`}
                          aria-pressed={isFav}
                          className={`absolute top-1.5 right-1.5 z-30 flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-sm border transition-colors cursor-pointer ${
                            isFav
                              ? 'border-rose-400/80 bg-[#181615]/90 text-rose-400'
                              : 'border-white/25 bg-[#181615]/75 text-[#FAF8F5]/80 hover:border-[#E5C158] hover:text-[#E5C158]'
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      <div className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono uppercase text-[#FAF8F5]">
                        <span className="inline-flex items-center gap-1">
                          {item.media_type === 'video' ? (
                            <Film className="h-3 w-3 text-[#E5C158]" />
                          ) : (
                            <ImageIcon className="h-3 w-3 text-[#E5C158]" />
                          )}
                          {item.media_type === 'video'
                            ? item.duration_seconds
                              ? formatDuration(item.duration_seconds)
                              : 'FILME'
                            : 'FOTO 35MM'}
                        </span>
                        {!unlocked ? (
                          <Lock className="h-3 w-3 text-[#E5C158]" />
                        ) : item.media_type === 'video' ? (
                          <Play className="h-3 w-3 text-[#E5C158]" />
                        ) : (
                          <Eye className="h-3 w-3 text-emerald-300" />
                        )}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-[#141211] border-t border-[#2B2725]">
                      <span className="text-[11px] font-semibold text-[#FAF8F5] truncate">
                        {item.title}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-[#9B948D] group-hover:text-[#E5C158] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Film Reel Sprocket Holes Bottom */}
            <div className="h-[18px] w-full film-perforations-light border-t border-[#2E2926]" aria-hidden="true" />
          </div>
        )}

        {/* Elaborate Film Frame & Contact Sheet Grid (VIP, Prévia & Avulso) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="rounded-sm border-2 border-[#181615] bg-[#181615] overflow-hidden animate-pulse">
                <div className="h-[18px] film-perforations-light" />
                <div className="aspect-[4/3] bg-[#2B2725]" />
                <div className="h-[18px] film-perforations-light" />
                <div className="p-5 bg-[#FAF8F5] space-y-2">
                  <div className="h-3 w-1/3 bg-[#D0CBC5]" />
                  <div className="h-5 w-2/3 bg-[#C8C2BC]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="rounded-sm border border-[#2B2725]/25 bg-[#E4E0DC] p-8 sm:p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm border border-[#2B2725]/30 bg-[#2B2725] text-[#E5C158]">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-2xl font-bold uppercase text-[#1C1918]">
                {mediaItems.length === 0
                  ? 'Acervo em atualização'
                  : filter === 'favorites'
                  ? 'Nenhum favorito salvo ainda'
                  : 'Nenhum item corresponde a esse filtro'}
              </h3>
              <p className="text-sm text-[#4A4440]">
                {mediaItems.length === 0
                  ? 'Novos ensaios e vídeos estão sendo preparados para a vitrine. Crie seu cadastro para acompanhar as atualizações.'
                  : filter === 'favorites'
                  ? 'Toque no ícone de coração em qualquer foto ou vídeo para salvar e visualizar mais tarde.'
                  : 'Limpe os filtros ou tente outro termo de busca.'}
              </p>
            </div>
            {mediaItems.length === 0 ? (
              <button
                type="button"
                onClick={() => (fan ? onOpenFanAccount() : onOpenFanLogin('register'))}
                className="inline-flex items-center gap-2 rounded-sm bg-[#1C1918] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors cursor-pointer"
              >
                {fan ? 'Abrir Minha Conta' : 'Criar Cadastro Grátis'}
              </button>
            ) : filter === 'favorites' ? (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="inline-flex items-center gap-2 rounded-sm bg-[#1C1918] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors cursor-pointer"
              >
                Explorar Toda a Galeria
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
            {filteredMedia.map((item, idx) => {
              const unlocked = Boolean(item.is_unlocked);
              const isVideo = item.media_type === 'video';
              const isVip = item.access_tier === 'vip';
              const isPreview = item.access_tier === 'free';
              const isFav = favoriteSet.has(item.id);
              const frameLabel = `${String(idx + 1).padStart(2, '0')}A`;

              const coverSrc = unlocked
                ? item.media_type === 'photo'
                  ? item.media_url || item.preview_url || FALLBACK_PHOTO_COVER
                  : item.preview_url || FALLBACK_VIDEO_COVER
                : item.preview_url || (isVideo ? FALLBACK_VIDEO_COVER : FALLBACK_PHOTO_COVER);

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectMedia(item)}
                  className={`group cursor-pointer overflow-hidden rounded-sm border-2 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between ${
                    isVip
                      ? 'border-[#181615] bg-[#1C1918] text-[#FAF8F5]'
                      : 'border-[#181615] bg-[#FAF8F5] text-[#181615]'
                  }`}
                >
                  {/* Top Celluloid Film Strip Header + Sprocket Holes */}
                  <div>
                    <div className="bg-[#181615] text-[#DED9D3]">
                      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          {isVideo ? (
                            <Film className="h-3 w-3 text-[#E5C158]" />
                          ) : (
                            <Aperture className="h-3 w-3 text-[#E5C158]" />
                          )}
                          <span className="text-[#FAF8F5] font-semibold">
                            {isVideo ? `ROLO FILME · ${frameLabel}` : `35MM FOTO · ${frameLabel}`}
                          </span>
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            isVip
                              ? 'text-[#E5C158]'
                              : isPreview
                              ? 'text-emerald-300'
                              : 'text-[#FAF8F5]'
                          }`}
                        >
                          {isPreview
                            ? 'PRÉVIA GRATUITA'
                            : isVip
                            ? 'CLUBE VIP'
                            : `${formatBrl(item.price_brl)} AVULSO`}
                        </span>
                      </div>

                      {/* Top Sprocket Perforations */}
                      <div className="h-[18px] w-full film-perforations-light" aria-hidden="true" />
                    </div>

                    {/* Film Negative Viewport (with extra cinema side-rails for videos!) */}
                    <div className="flex items-stretch bg-[#181615]">
                      {isVideo && (
                        <div className="w-[14px] shrink-0 film-perforations-vertical border-r border-[#2E2926]" aria-hidden="true" />
                      )}

                      <div
                        onContextMenu={(e) => e.preventDefault()}
                        className="relative flex-1 aspect-[4/3] overflow-hidden bg-black media-shield border-y border-[#2E2926]"
                      >
                        {unlocked && isVideo && item.media_url && (!item.preview_url || item.preview_url.includes('/api/media/fallback/')) ? (
                          <ProtectedVideo
                            src={item.media_url}
                            title={item.title}
                            controls={false}
                            muted
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <ProtectedImage
                            src={coverSrc}
                            alt={generateMediaAlt(item, { creatorName: profile.display_name, context: 'gallery' })}
                            loading="lazy"
                            blurred={!unlocked}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        )}

                        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/20 to-black/25" />

                        {/* Optical Viewfinder Corner Reticles */}
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute top-2.5 left-2.5 z-20 h-3 w-3 border-t-2 border-l-2 ${
                            isVip ? 'border-[#E5C158]/80' : 'border-white/55'
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute top-2.5 right-2.5 z-20 h-3 w-3 border-t-2 border-r-2 ${
                            isVip ? 'border-[#E5C158]/80' : 'border-white/55'
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute bottom-2.5 left-2.5 z-20 h-3 w-3 border-b-2 border-l-2 ${
                            isVip ? 'border-[#E5C158]/80' : 'border-white/55'
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute bottom-2.5 right-2.5 z-20 h-3 w-3 border-b-2 border-r-2 ${
                            isVip ? 'border-[#E5C158]/80' : 'border-white/55'
                          }`}
                        />

                        {/* Top Frame Stock Stamp inside Negative */}
                        <div className="pointer-events-none absolute top-3 left-4 right-14 z-20 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-200/90">
                          <span>{isVideo ? '24FPS · CINE' : 'ISO 400 · RAW'}</span>
                          {item.duration_seconds ? (
                            <span className="tabular-nums text-[#E5C158] font-semibold">
                              {formatDuration(item.duration_seconds)}
                            </span>
                          ) : (
                            <span className="tabular-nums">EXP {frameLabel}</span>
                          )}
                        </div>

                        {/* Interactive Heart Favorite Button */}
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(item.id);
                            }}
                            aria-label={isFav ? `Remover "${item.title}" dos favoritos` : `Favoritar "${item.title}" para ver depois`}
                            aria-pressed={isFav}
                            title={isFav ? 'Salvo nos favoritos (clique para remover)' : 'Salvar nos favoritos para ver depois'}
                            className={`absolute top-2.5 right-2.5 z-30 flex h-9 w-9 items-center justify-center rounded-sm border transition-all cursor-pointer ${
                              isFav
                                ? 'border-rose-400/90 bg-[#181615]/90 text-rose-400 shadow-sm'
                                : 'border-white/30 bg-[#181615]/75 text-[#FAF8F5]/85 hover:border-[#E5C158] hover:text-[#E5C158]'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        )}

                        {/* Center Lock / Play / Preview Affordance */}
                        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                          {!unlocked ? (
                            <div className="flex flex-col items-center gap-2 text-center px-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-[#E5C158]/70 bg-black/80 text-[#E5C158] backdrop-blur-sm">
                                <Lock className="h-5 w-5" />
                              </div>
                              <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.12em] text-zinc-100">
                                {isVip
                                  ? 'Exclusivo Clube VIP'
                                  : `Desbloquear · ${formatBrl(item.price_brl)}`}
                              </span>
                            </div>
                          ) : isVideo ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-[#E5C158]/70 bg-black/75 text-[#FAF8F5] backdrop-blur-sm group-hover:bg-[#E5C158] group-hover:text-[#181615] group-hover:border-[#E5C158] transition-colors">
                              <Play className="h-5 w-5 ml-0.5" />
                            </div>
                          ) : (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex h-10 w-10 items-center justify-center rounded-sm border border-white/60 bg-black/75 text-[#FAF8F5] backdrop-blur-sm">
                              <Eye className="h-4 w-4 text-[#E5C158]" />
                            </div>
                          )}
                        </div>
                      </div>

                      {isVideo && (
                        <div className="w-[14px] shrink-0 film-perforations-vertical border-l border-[#2E2926]" aria-hidden="true" />
                      )}
                    </div>

                    {/* Bottom Sprocket Perforations + Film Edge Rebate */}
                    <div className="bg-[#181615] text-[#9B948D]">
                      <div className="h-[18px] w-full film-perforations-light" aria-hidden="true" />
                      <div className="flex items-center justify-between px-3 py-1 text-[10px] font-mono uppercase tracking-[0.1em] border-t border-[#2E2926]">
                        <span>{item.collection_name}</span>
                        <span className="tabular-nums">
                          {unlocked ? (isPreview ? 'ABERTO · PRÉVIA' : 'DESBLOQUEADO') : 'PROTEGIDO · PIX'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Info Footer (Contrast-Matched to VIP Charcoal vs Prévia/Avulso Ivory Sheet) */}
                  <div
                    className={`p-4 sm:p-5 space-y-2.5 border-t ${
                      isVip
                        ? 'border-[#383330] bg-[#1C1918]'
                        : 'border-[#181615]/15 bg-[#FAF8F5]'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-2 text-xs ${
                        isVip ? 'text-[#C7C1BA]' : 'text-[#524B45]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                            isVip ? 'text-[#E5C158]' : 'text-[#181615]'
                          }`}
                        >
                          {isVideo ? (
                            <Film className={`h-3.5 w-3.5 ${isVip ? 'text-[#E5C158]' : 'text-[#7A5412]'}`} />
                          ) : (
                            <ImageIcon className={`h-3.5 w-3.5 ${isVip ? 'text-[#E5C158]' : 'text-[#7A5412]'}`} />
                          )}
                          {isVideo ? 'Filme' : 'Foto'}
                        </span>
                        {item.duration_seconds ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums shrink-0">{formatDuration(item.duration_seconds)}</span>
                          </>
                        ) : null}
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.collection_name}</span>
                      </div>

                      {isFav && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 shrink-0">
                          <Heart className="h-3 w-3 fill-current" />
                          Salvo
                        </span>
                      )}
                    </div>

                    <h3
                      className={`font-display text-2xl font-bold uppercase tracking-tight truncate ${
                        isVip ? 'text-[#FAF8F5]' : 'text-[#181615]'
                      }`}
                    >
                      {item.title}
                    </h3>

                    <div
                      className={`flex items-center justify-between gap-2 pt-2 border-t text-xs ${
                        isVip ? 'border-[#383330] text-[#9B948D]' : 'border-[#181615]/10 text-[#524B45]'
                      }`}
                    >
                      <span className="tabular-nums">
                        Publicado em {formatDateShort(item.created_at)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider ${
                          isVip ? 'text-[#E5C158]' : 'text-[#181615]'
                        }`}
                      >
                        <span>
                          {!unlocked
                            ? 'Desbloquear'
                            : isVideo
                            ? 'Assistir'
                            : 'Abrir'}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOCK 3.5: Verified Fan Testimonials Social Proof */}
      <FanTestimonialsSection
        profile={profile}
        fan={fan}
        onTestimonialAdded={onTestimonialsUpdated || (() => {})}
      />

      {/* BLOCK 4: Clube VIP Closing Espresso Charcoal Film Reel Section */}
      <section
        id="clube-vip"
        className="bg-[#2B2725] text-[#F4F1ED]"
      >
        <div className="h-[18px] w-full film-perforations-dark border-b border-[#453F3B]" aria-hidden="true" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center p-5 sm:p-8 lg:p-12">
          <div className="lg:col-span-7 space-y-5">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E5C158]">
              <Film className="h-3.5 w-3.5 text-[#E5C158]" />
              <span>Rolo Exclusivo VIP · Acesso Ilimitado · 30 Dias</span>
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F1ED]">
              Clube VIP de {profile.display_name}
            </h2>
            <p className="text-sm text-[#DED9D3] leading-relaxed max-w-2xl">
              {profile.vip_description}
            </p>

            {/* VIP 3-Frame Filmstrip Teaser (uses only real uploaded VIP items from Supabase) */}
            {(() => {
              const vipSamples = mediaItems.filter((m) => m.access_tier === 'vip').slice(0, 3);
              if (vipSamples.length === 0) return null;
              return (
                <div className="rounded-sm border border-[#453F3B] bg-[#181615] overflow-hidden max-w-xl">
                  <div className="h-[14px] w-full film-perforations-dark border-b border-[#342F2C]" aria-hidden="true" />
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-[#141211]">
                    {vipSamples.map((vipItem, i) => {
                      const unlocked = Boolean(vipItem.is_unlocked);
                      const isVipFav = favoriteSet.has(vipItem.id);
                      const vipSrc = unlocked
                        ? vipItem.media_type === 'photo'
                          ? vipItem.media_url || vipItem.preview_url || FALLBACK_PHOTO_COVER
                          : vipItem.preview_url || FALLBACK_VIDEO_COVER
                        : vipItem.preview_url ||
                          (vipItem.media_type === 'video' ? FALLBACK_VIDEO_COVER : FALLBACK_PHOTO_COVER);
                      return (
                        <div
                          key={`vip-strip-${vipItem.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectMedia(vipItem)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectMedia(vipItem);
                            }
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                          className="group relative aspect-[4/3] overflow-hidden border border-[#383330] hover:border-[#E5C158] bg-black media-shield cursor-pointer text-left"
                        >
                          <ProtectedImage
                            src={vipSrc}
                            alt={generateMediaAlt(vipItem, { creatorName: profile.display_name, context: 'vip_teaser' })}
                            loading="lazy"
                            blurred={!unlocked}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(vipItem.id);
                              }}
                              aria-label={isVipFav ? `Remover "${vipItem.title}" dos favoritos` : `Favoritar "${vipItem.title}"`}
                              aria-pressed={isVipFav}
                              className={`absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-sm border transition-colors cursor-pointer ${
                                isVipFav
                                  ? 'border-rose-400/90 bg-[#181615]/90 text-rose-400'
                                  : 'border-white/25 bg-[#181615]/75 text-white/80 hover:text-[#E5C158]'
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${isVipFav ? 'fill-current' : ''}`} />
                            </button>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-black/45" />
                          <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-mono uppercase text-[#E5C158]">
                            <span>VIP 0{i + 1}</span>
                            {unlocked ? <Play className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-[14px] w-full film-perforations-dark border-t border-[#342F2C]" aria-hidden="true" />
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#453F3B] text-xs text-[#DED9D3]">
              <div>
                <p className="font-semibold uppercase tracking-wider text-[#F4F1ED] mb-1">Acervo Completo</p>
                <p className="text-[#C7C1BA]">Todas as fotos e vídeos VIP desbloqueados na hora.</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-[#F4F1ED] mb-1">Streaming Privado</p>
                <p className="text-[#C7C1BA]">Exibição protegida direto do servidor sem expor links nem permitir cópia.</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-[#F4F1ED] mb-1">Pagamento Seguro</p>
                <p className="text-[#C7C1BA]">Via Pix instantâneo ou cartão vinculado ao seu e-mail.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 overflow-hidden rounded-sm border-2 border-[#141211] bg-[#1C1918]">
            <div className="h-[16px] w-full film-perforations-dark border-b border-[#342F2C]" aria-hidden="true" />
            <div className="flex flex-col justify-between p-6 lg:p-8 space-y-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#C7C1BA]">
                  ROLO VIP MENSAL · ACESSO TOTAL
                </p>
                <p className="font-mono text-3xl font-semibold text-[#E5C158] tabular-nums mt-1">
                  {formatBrl(profile.vip_monthly_price_brl)}
                  <span className="text-sm font-sans font-normal text-[#C7C1BA]"> / mês</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenVipModal}
                className="w-full min-h-[44px] rounded-sm bg-[#E5C158] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
              >
                {fan?.is_vip ? 'Renovar Acesso VIP' : 'Assinar Clube VIP Agora'}
              </button>
              {(() => {
                const waVipUrl = buildWhatsappReceiptUrl(profile.whatsapp_number, {
                  creatorName: profile.display_name,
                  itemLabel: 'Assinatura Clube VIP (30 dias)',
                  amountBrl: profile.vip_monthly_price_brl,
                  paymentMethod: 'pix',
                  isReceipt: true,
                });
                return waVipUrl ? (
                  <a
                    href={waVipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-500/60 bg-emerald-950/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                    Enviar Comprovante no WhatsApp
                  </a>
                ) : null;
              })()}
              <p className="text-xs text-[#9B948D] text-center">
                Exclusivo para maiores de 18 anos. Acesso sincronizado pelo seu e-mail.
              </p>
            </div>
            <div className="h-[16px] w-full film-perforations-dark border-t border-[#342F2C]" aria-hidden="true" />
          </div>
        </div>
        <div className="h-[18px] w-full film-perforations-dark border-t border-[#453F3B]" aria-hidden="true" />
      </section>

      {/* BLOCK 5: Visible On-Page AEO / Perguntas Frequentes */}
      <FaqAeoSection creatorName={profile.display_name} />
    </main>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Play, Search, UserCheck, Upload, Database, Image as ImageIcon, Film, Heart, Video, Clock, ArrowRight } from 'lucide-react';
import type { CreatorProfile, FanAccount, MediaItem, StorefrontStats, VideoCallPlan } from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';
import { resolveVideoCallPlans } from '../lib/videoCalls';
import { ProtectedImage, ProtectedVideo } from './ProtectedMedia';

const FALLBACK_PHOTO_COVER = '/api/media/fallback/photo';
const FALLBACK_VIDEO_COVER = '/api/media/fallback/video';

interface StorefrontProps {
  supabaseConnected: boolean;
  schemaMissing?: boolean;
  loading: boolean;
  profile: CreatorProfile;
  mediaItems: MediaItem[];
  fan: FanAccount | null;
  stats: StorefrontStats;
  onSelectMedia: (item: MediaItem) => void;
  onSelectVideoCallPlan: (plan: VideoCallPlan) => void;
  onOpenVipModal: () => void;
  onOpenTipModal: () => void;
  onOpenFanLogin: () => void;
  onLogoutFan: () => void;
  onNavigateToStudio: (tab?: 'overview' | 'upload' | 'supabase' | 'video_calls') => void;
}

type TypeFilter = 'all' | 'photo' | 'video' | 'vip' | 'ppv' | 'free';

export const Storefront: React.FC<StorefrontProps> = ({
  supabaseConnected,
  schemaMissing,
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
  onLogoutFan,
  onNavigateToStudio,
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
      if (collectionFilter !== 'all' && item.collection_name !== collectionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.title} ${item.description} ${item.collection_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mediaItems, filter, collectionFilter, searchQuery]);

  const filterOptions: Array<{ id: TypeFilter; label: string }> = [
    { id: 'all', label: 'Tudo' },
    { id: 'photo', label: 'Fotos' },
    { id: 'video', label: 'Vídeos' },
    { id: 'vip', label: 'Clube VIP' },
    { id: 'ppv', label: 'Avulsos' },
    { id: 'free', label: 'Prévias' },
  ];

  return (
    <main className="mx-auto max-w-[1440px] border-x border-[#2B2725]/20 bg-[#E4E0DC]">
      {/* Subtle Supabase Connection Setup Prompt when not yet connected */}
      {(!supabaseConnected || schemaMissing) && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2B2725]/25 bg-[#2B2725] text-[#F4F1ED] px-6 py-4 lg:px-10">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {!supabaseConnected
                ? 'Conecte seu projeto Supabase para ativar uploads, vitrine e banco de vendas'
                : 'Projeto conectado — finalize a criação das tabelas no Supabase'}
            </p>
            <p className="text-xs text-[#C7C1BA]">
              Você pode criar um projeto novo no Supabase automaticamente ou conectar um existente em segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToStudio('supabase')}
            className="inline-flex items-center gap-2 rounded-sm bg-[#E5C158] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="h-4 w-4" />
            Conectar Supabase
          </button>
        </section>
      )}

      {/* BLOCK 1: Editorial Lookbook Hero Masthead */}
      <section className="bg-[#E4E0DC] text-[#1C1918] border-b border-[#2B2725]/25">
        {/* Top Masthead Index Line */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2B2725]/20 px-6 py-3 lg:px-10 text-xs uppercase tracking-[0.12em] text-[#4A4440]">
          <span className="font-display italic text-sm normal-case tracking-normal text-[#1C1918] font-semibold">
            Acervo Privado · Criadora Solo Verificada +18
          </span>
          <span className="font-mono text-[11px]">
            {profile.handle} · {profile.location}
          </span>
        </div>

        {/* Masthead Split Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#2B2725]/20">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-sm border border-[#2B2725]/35 bg-[#2B2725] shrink-0">
                  {profile.avatar_url && !avatarImgFailed ? (
                    <ProtectedImage
                      src={profile.avatar_url}
                      alt={profile.display_name}
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

              <div className="space-y-4">
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold uppercase tracking-[-0.02em] text-[#1C1918] leading-[0.94]">
                  {profile.display_name}
                </h1>
                <p className="text-base text-[#3D3835] leading-relaxed max-w-xl">
                  {profile.bio}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#2B2725]/20 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenVipModal}
                className="rounded-sm bg-[#1C1918] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Assinar Clube VIP · {formatBrl(profile.vip_monthly_price_brl)}/mês
              </button>
              <button
                type="button"
                onClick={onOpenTipModal}
                className="inline-flex items-center gap-2 rounded-sm border border-[#2B2725]/35 bg-[#EAE6E2] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Heart className="h-3.5 w-3.5 text-[#8A6218]" />
                Enviar Mimo
              </button>
              <button
                type="button"
                onClick={() => onNavigateToStudio('overview')}
                className="text-xs font-semibold uppercase tracking-wider text-[#4A4440] hover:text-[#1C1918] underline underline-offset-4 px-2 py-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Administração do Site
              </button>
            </div>
          </div>

          {/* Right Editorial Hero Portrait Block */}
          <div
            onContextMenu={(e) => e.preventDefault()}
            className="lg:col-span-5 relative min-h-[360px] lg:min-h-[460px] overflow-hidden bg-[#2B2725] media-shield"
          >
            {profile.hero_url && !heroImgFailed ? (
              <ProtectedImage
                src={profile.hero_url}
                alt={`Retrato editorial de ${profile.display_name}`}
                onError={() => setHeroImgFailed(true)}
                containerClassName="h-full w-full lg:absolute lg:inset-0"
                className="h-full w-full object-cover"
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
            <div className="absolute bottom-6 left-6 right-6 z-20 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#E5C158] font-medium">
                  Acervo Privado Exclusivo
                </p>
                <p className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F1ED]">
                  Fotos em alta resolução & vídeos privados
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Espresso Charcoal Stats Ribbon */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#453F3B] border-b border-[#453F3B] bg-[#2B2725] text-[#F4F1ED]">
        <div className="px-6 py-5 lg:px-10">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Fotos Exclusivas</p>
          <p className="font-mono text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.totalPhotos}</p>
        </div>
        <div className="px-6 py-5 lg:px-10">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Vídeos Privados</p>
          <p className="font-mono text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.totalVideos}</p>
        </div>
        <div className="px-6 py-5 lg:px-10">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Coleções Publicadas</p>
          <p className="font-mono text-2xl font-semibold text-[#F4F1ED] tabular-nums">{stats.collectionsCount}</p>
        </div>
        <div className="px-6 py-5 lg:px-10">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA] mb-1">Assinatura Mensal VIP</p>
          <p className="font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(profile.vip_monthly_price_brl)}
          </p>
        </div>
      </section>

      {/* BLOCK 2: 2-Column Editorial Split ("WHO AM I" Charcoal Left / "VIDEO CALL RATE CARD" Light Stone Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#2B2725]/25">
        {/* Left Charcoal Editorial Bio & Profile Column */}
        <div className="lg:col-span-5 bg-[#2B2725] text-[#F4F1ED] p-6 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-[#453F3B] flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-baseline justify-between gap-4 border-b border-[#453F3B] pb-3">
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F1ED]">
                Sobre a Criadora
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#E5C158]">
                +18 Privado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div
                onContextMenu={(e) => e.preventDefault()}
                className="sm:col-span-5 aspect-[3/4] overflow-hidden border border-[#453F3B] bg-[#1C1918] media-shield"
              >
                {profile.avatar_url && !avatarImgFailed ? (
                  <ProtectedImage
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-[#E5C158]">
                    {profile.display_name.slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="sm:col-span-7 space-y-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[#E5C158] font-semibold">
                  {profile.handle} · {profile.location}
                </p>
                <p className="text-sm text-[#DED9D3] leading-relaxed">
                  {profile.vip_description}
                </p>
                <div className="pt-2 space-y-1.5 text-xs text-[#C7C1BA] border-t border-[#453F3B]">
                  <p>· Fotos & ensaios sem censura no VIP</p>
                  <p>· Streaming protegido sem exposição de link</p>
                  <p>· Atendimento particular por Vídeo Chamada</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#453F3B]">
            <button
              type="button"
              onClick={onOpenVipModal}
              className="rounded-sm bg-[#E5C158] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
            >
              Assinar VIP ({formatBrl(profile.vip_monthly_price_brl)})
            </button>
            <button
              type="button"
              onClick={onOpenTipModal}
              className="rounded-sm border border-[#5A524D] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:border-[#E5C158] transition-colors cursor-pointer"
            >
              Enviar Mimo
            </button>
          </div>
        </div>

        {/* Right Light Stone Panel: Featured Vídeo Chamada ao Vivo (4 Editable Plans) */}
        <div
          id="video-chamada"
          className="lg:col-span-7 bg-[#E4E0DC] text-[#1C1918] p-6 sm:p-8 lg:p-10 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#2B2725]/20 pb-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A5412]">
                <Video className="h-3.5 w-3.5" />
                <span>Destaque · Atendimento Ao Vivo 1 a 1</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918] mt-1">
                Vídeo Chamada Privada
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToStudio('video_calls')}
              className="text-xs font-semibold uppercase tracking-wider text-[#4A4440] hover:text-[#1C1918] underline underline-offset-4 cursor-pointer self-start sm:self-auto"
            >
              Editar valores no Admin
            </button>
          </div>

          <p className="text-sm text-[#3D3835] leading-relaxed">
            Escolha a duração desejada abaixo e garanta sua sessão particular via Pix instantâneo ou cartão. Após a confirmação, você informa seu WhatsApp ou @Telegram para receber o link privado da chamada.
          </p>

          {videoCallPlans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videoCallPlans.map((plan, index) => {
                const isHighlight = index === 2 || (videoCallPlans.length < 3 && index === 0);
                return (
                  <article
                    key={plan.id}
                    onClick={() => onSelectVideoCallPlan(plan)}
                    className={`group flex flex-col justify-between rounded-sm border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
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
                          className={`text-[11px] uppercase tracking-wider font-semibold ${
                            isHighlight ? 'text-[#E5C158]' : 'text-[#4A4440]'
                          }`}
                        >
                          {isHighlight ? 'Mais escolhido' : 'Ao vivo'}
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
                      className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        isHighlight
                          ? 'bg-[#E5C158] text-[#1C1918] hover:bg-[#f0cf6b]'
                          : 'bg-[#1C1918] text-[#F4F1ED] hover:bg-[#383432]'
                      }`}
                    >
                      <span>Comprar Vídeo Chamada</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border border-[#2B2725]/25 bg-[#EAE6E2] p-6 text-xs text-[#4A4440]">
              Nenhum plano de Vídeo Chamada ativo no momento. Ative ou edite os planos no Administrador.
            </div>
          )}
        </div>
      </section>

      {/* BLOCK 3: Gallery Showcase Grid ("MY WORK INCLUDES" Light Editorial Block) */}
      <section id="vitrine-grid" className="bg-[#EAE6E2] text-[#1C1918] p-6 sm:p-8 lg:p-12 border-b border-[#2B2725]/25 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#2B2725]/20 pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A5412]">
              Portfolio Selecionado · +18
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#1C1918] mt-1">
              Galeria & Acervo de Conteúdo
            </h2>
            <p className="text-sm text-[#4A4440] mt-1">
              Selecione uma foto ou vídeo para visualizar ou desbloquear acesso instantâneo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {fan ? (
              <div className="flex items-center gap-3 rounded-sm border border-[#2B2725]/30 bg-[#E4E0DC] px-3.5 py-2 text-xs">
                <UserCheck className="h-4 w-4 text-[#7A5412] shrink-0" />
                <span className="text-[#1C1918] font-medium max-w-[180px] truncate">{fan.email}</span>
                <span className="text-[#4A4440]">·</span>
                <span className={fan.is_vip ? 'text-[#7A5412] font-semibold' : 'text-[#4A4440]'}>
                  {fan.is_vip ? 'VIP Ativo' : 'Conta Padrão'}
                </span>
                <button
                  type="button"
                  onClick={onLogoutFan}
                  className="text-[#4A4440] hover:text-[#1C1918] underline cursor-pointer ml-1"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenFanLogin}
                className="rounded-sm border border-[#2B2725]/35 bg-[#E4E0DC] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Já sou assinante / Minhas compras
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-sm bg-[#DDD8D2] border border-[#2B2725]/20 w-fit">
            {filterOptions.map((opt) => {
              const isActive = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

          <div className="flex flex-wrap items-center gap-3">
            {collections.length > 1 && (
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                aria-label="Filtrar por coleção"
                className="rounded-sm border border-[#2B2725]/30 bg-[#E4E0DC] px-3 py-2 text-xs font-medium text-[#1C1918] focus:border-[#1C1918] focus:outline-none"
              >
                {collections.map((col) => (
                  <option key={col} value={col}>
                    {col === 'all' ? 'Todas as coleções' : `Coleção: ${col}`}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4440]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar título ou coleção..."
                className="w-56 rounded-sm border border-[#2B2725]/30 bg-[#E4E0DC] pl-9 pr-3 py-2 text-xs text-[#1C1918] placeholder:text-[#6A635D] focus:border-[#1C1918] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="rounded-sm border border-[#2B2725]/20 bg-[#E4E0DC] overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-[#D0CBC5]" />
                <div className="p-5 space-y-2">
                  <div className="h-3 w-1/3 bg-[#C8C2BC]" />
                  <div className="h-5 w-2/3 bg-[#C8C2BC]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="rounded-sm border border-[#2B2725]/25 bg-[#E4E0DC] p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm border border-[#2B2725]/30 bg-[#2B2725] text-[#E5C158]">
              <Upload className="h-5 w-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-2xl font-bold uppercase text-[#1C1918]">
                {mediaItems.length === 0
                  ? 'Nenhuma mídia publicada ainda'
                  : 'Nenhum item corresponde a esse filtro'}
              </h3>
              <p className="text-sm text-[#4A4440]">
                {mediaItems.length === 0
                  ? 'Acesse o Estúdio da Criadora para enviar suas primeiras fotos e vídeos diretamente para o seu Supabase.'
                  : 'Limpe os filtros ou tente outro termo de busca.'}
              </p>
            </div>
            {mediaItems.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigateToStudio(supabaseConnected ? 'upload' : 'supabase')}
                className="inline-flex items-center gap-2 rounded-sm bg-[#1C1918] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] hover:bg-[#383432] transition-colors cursor-pointer"
              >
                {supabaseConnected ? 'Enviar Primeira Foto ou Vídeo' : 'Conectar Supabase e Começar'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMedia.map((item) => {
              const unlocked = Boolean(item.is_unlocked);
              const coverSrc = unlocked
                ? item.media_type === 'photo'
                  ? item.media_url || item.preview_url || FALLBACK_PHOTO_COVER
                  : item.preview_url || FALLBACK_VIDEO_COVER
                : item.preview_url || (item.media_type === 'video' ? FALLBACK_VIDEO_COVER : FALLBACK_PHOTO_COVER);

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectMedia(item)}
                  className="group cursor-pointer overflow-hidden rounded-sm border border-[#2B2725]/25 bg-[#E4E0DC] hover:border-[#1C1918] transition-colors"
                >
                  <div
                    onContextMenu={(e) => e.preventDefault()}
                    className="relative aspect-[4/3] w-full overflow-hidden bg-[#1C1918] media-shield"
                  >
                    {unlocked && item.media_type === 'video' && item.media_url && (!item.preview_url || item.preview_url.includes('/api/media/fallback/')) ? (
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
                        alt={item.title}
                        blurred={!unlocked}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}

                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    {/* Center Play / Lock Affordance */}
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                      {!unlocked ? (
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-zinc-400/60 bg-black/75 text-[#E5C158] backdrop-blur-sm">
                            <Lock className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
                            {item.access_tier === 'vip'
                              ? 'Exclusivo Clube VIP'
                              : `Desbloquear · ${formatBrl(item.price_brl)}`}
                          </span>
                        </div>
                      ) : item.media_type === 'video' ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-zinc-400/50 bg-black/65 text-zinc-50 backdrop-blur-sm group-hover:bg-[#E5C158] group-hover:text-[#1C1918] group-hover:border-[#E5C158] transition-colors">
                          <Play className="h-5 w-5 ml-0.5" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-5 space-y-2 border-t border-[#2B2725]/15">
                    <div className="flex items-center gap-2 text-xs text-[#4A4440]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1C1918]">
                        {item.media_type === 'video' ? (
                          <Film className="h-3.5 w-3.5 text-[#7A5412]" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 text-[#7A5412]" />
                        )}
                        {item.media_type === 'video' ? 'Vídeo' : 'Foto'}
                      </span>
                      {item.duration_seconds ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatDuration(item.duration_seconds)}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.collection_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-[#7A5412] tabular-nums">
                        {item.access_tier === 'free'
                          ? 'Prévia'
                          : item.access_tier === 'vip'
                          ? 'VIP'
                          : formatBrl(item.price_brl)}
                      </span>
                    </div>

                    <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#1C1918] truncate">
                      {item.title}
                    </h3>

                    <p className="text-xs text-[#6A635D]">
                      Publicado em {formatDateShort(item.created_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOCK 4: Clube VIP Closing Espresso Charcoal Section */}
      <section
        id="clube-vip"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#2B2725] text-[#F4F1ED] p-6 sm:p-8 lg:p-12"
      >
        <div className="lg:col-span-7 space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E5C158]">
            Acesso Ilimitado · 30 Dias
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F1ED]">
            Clube VIP de {profile.display_name}
          </h2>
          <p className="text-sm text-[#DED9D3] leading-relaxed max-w-2xl">
            {profile.vip_description}
          </p>
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

        <div className="lg:col-span-5 flex flex-col justify-between rounded-sm border border-[#453F3B] bg-[#1C1918] p-6 lg:p-8 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#C7C1BA]">Valor da assinatura mensal</p>
            <p className="font-mono text-3xl font-semibold text-[#E5C158] tabular-nums mt-1">
              {formatBrl(profile.vip_monthly_price_brl)}
              <span className="text-sm font-sans font-normal text-[#C7C1BA]"> / mês</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenVipModal}
            className="w-full rounded-sm bg-[#E5C158] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
          >
            {fan?.is_vip ? 'Renovar Acesso VIP' : 'Assinar Clube VIP Agora'}
          </button>
          <p className="text-xs text-[#9B948D] text-center">
            Exclusivo para maiores de 18 anos. Acesso sincronizado pelo seu e-mail.
          </p>
        </div>
      </section>
    </main>
  );
};

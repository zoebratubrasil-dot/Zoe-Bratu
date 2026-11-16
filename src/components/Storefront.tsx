import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Play, Search, UserCheck, Upload, Database, Image as ImageIcon, Film, Heart } from 'lucide-react';
import type { CreatorProfile, FanAccount, MediaItem, StorefrontStats } from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';

const FALLBACK_PHOTO_COVER = '/src/assets/images/collection_silk_cover_1794805427019.jpg';
const FALLBACK_VIDEO_COVER = '/src/assets/images/collection_noir_video_1794805427080.jpg';

interface StorefrontProps {
  supabaseConnected: boolean;
  schemaMissing?: boolean;
  loading: boolean;
  profile: CreatorProfile;
  mediaItems: MediaItem[];
  fan: FanAccount | null;
  stats: StorefrontStats;
  onSelectMedia: (item: MediaItem) => void;
  onOpenVipModal: () => void;
  onOpenTipModal: () => void;
  onOpenFanLogin: () => void;
  onLogoutFan: () => void;
  onNavigateToStudio: (tab?: 'overview' | 'upload' | 'supabase') => void;
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
  onOpenVipModal,
  onOpenTipModal,
  onOpenFanLogin,
  onLogoutFan,
  onNavigateToStudio,
}) => {
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
    <main className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10 lg:py-12 space-y-12">
      {/* Subtle Supabase Connection Setup Prompt when not yet connected */}
      {(!supabaseConnected || schemaMissing) && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#D4AF37]/40 bg-[#121215] px-6 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-100">
              {!supabaseConnected
                ? 'Conecte seu projeto Supabase para ativar uploads, vitrine e banco de vendas'
                : 'Projeto conectado — finalize a criação das tabelas no Supabase'}
            </p>
            <p className="text-xs text-zinc-400">
              Você pode criar um projeto novo no Supabase automaticamente ou conectar um existente em segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToStudio('supabase')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="h-4 w-4" />
            Conectar Supabase
          </button>
        </section>
      )}

      {/* Split-Screen Editorial Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-[#121215] p-8 lg:p-12">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900 shrink-0">
                {profile.avatar_url && !avatarImgFailed ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 font-display text-lg text-[#D4AF37]">
                    {profile.display_name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#D4AF37] font-medium">
                  Criadora Solo Verificada · +18
                </p>
                <p className="text-sm text-zinc-400 truncate">
                  {profile.handle} · {profile.location}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-50 leading-[1.1]">
                {profile.display_name}
              </h1>
              <p className="text-base text-zinc-300 leading-relaxed max-w-xl">
                {profile.bio}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenVipModal}
              className="rounded-lg bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Assinar Clube VIP · {formatBrl(profile.vip_monthly_price_brl)}/mês
            </button>
            <button
              type="button"
              onClick={onOpenTipModal}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Heart className="h-4 w-4 text-[#D4AF37]" />
              Enviar Mimo
            </button>
            <button
              type="button"
              onClick={() => onNavigateToStudio('overview')}
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 underline underline-offset-4 px-2 py-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Administração do Site
            </button>
          </div>
        </div>

        {/* Hero Visual Container matching height */}
        <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-[480px] overflow-hidden rounded-xl border border-zinc-800/80 bg-[#121215]">
          {profile.hero_url && !heroImgFailed ? (
            <img
              src={profile.hero_url}
              alt={`Retrato editorial de ${profile.display_name}`}
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-full w-full object-cover lg:absolute lg:inset-0"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-[#15120d] to-zinc-950 p-10 text-center">
              <ImageIcon className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="font-display text-xl text-zinc-300">{profile.display_name}</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-300">Acervo Privado Exclusivo</p>
              <p className="font-display text-lg font-medium text-zinc-50">
                Fotos em alta resolução & vídeos privados
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column KPI Strip below Hero */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/80 rounded-xl border border-zinc-800/80 bg-[#121215]">
        <div className="px-6 py-5">
          <p className="text-xs text-zinc-400 mb-1">Fotos Exclusivas</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">{stats.totalPhotos}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-zinc-400 mb-1">Vídeos Privados</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">{stats.totalVideos}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-zinc-400 mb-1">Coleções Publicadas</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">{stats.collectionsCount}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-zinc-400 mb-1">Assinatura Mensal VIP</p>
          <p className="font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(profile.vip_monthly_price_brl)}
          </p>
        </div>
      </section>

      {/* Gallery Filter & Fan Session Bar */}
      <section id="vitrine-grid" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-zinc-50">
              Galeria & Acervo de Conteúdo
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Selecione uma foto ou vídeo para visualizar ou desbloquear acesso instantâneo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {fan ? (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-[#121215] px-3.5 py-2 text-xs">
                <UserCheck className="h-4 w-4 text-[#D4AF37] shrink-0" />
                <span className="text-zinc-200 max-w-[180px] truncate">{fan.email}</span>
                <span className="text-zinc-500">·</span>
                <span className={fan.is_vip ? 'text-[#E5C158] font-medium' : 'text-zinc-400'}>
                  {fan.is_vip ? 'VIP Ativo' : 'Conta Padrão'}
                </span>
                <button
                  type="button"
                  onClick={onLogoutFan}
                  className="text-zinc-400 hover:text-zinc-100 underline cursor-pointer ml-1"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenFanLogin}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Já sou assinante / Minhas compras
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#121215] border border-zinc-800/80 w-fit">
            {filterOptions.map((opt) => {
              const isActive = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`relative px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive ? 'text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="storefront-filter-pill"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-md bg-[#D4AF37]"
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
                className="rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2 text-xs text-zinc-200 focus:border-[#D4AF37] focus:outline-none"
              >
                {collections.map((col) => (
                  <option key={col} value={col}>
                    {col === 'all' ? 'Todas as coleções' : `Coleção: ${col}`}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar título ou coleção..."
                className="w-56 rounded-lg border border-zinc-800 bg-[#121215] pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="rounded-xl border border-zinc-800/80 bg-[#121215] overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-zinc-900" />
                <div className="p-5 space-y-2">
                  <div className="h-3 w-1/3 bg-zinc-800 rounded" />
                  <div className="h-5 w-2/3 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-[#121215] p-12 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[#D4AF37]">
              <Upload className="h-5 w-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-display text-xl font-medium text-zinc-100">
                {mediaItems.length === 0
                  ? 'Nenhuma mídia publicada ainda'
                  : 'Nenhum item corresponde a esse filtro'}
              </h3>
              <p className="text-sm text-zinc-400">
                {mediaItems.length === 0
                  ? 'Acesse o Estúdio da Criadora para enviar suas primeiras fotos e vídeos diretamente para o seu Supabase.'
                  : 'Limpe os filtros ou tente outro termo de busca.'}
              </p>
            </div>
            {mediaItems.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigateToStudio(supabaseConnected ? 'upload' : 'supabase')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors cursor-pointer"
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
                  className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-800/80 bg-[#121215] hover:border-zinc-600 transition-colors"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
                    {unlocked && item.media_type === 'video' && item.media_url && !item.preview_url ? (
                      <video
                        src={item.media_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <img
                        src={coverSrc}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
                          !unlocked ? 'blur-md scale-105 opacity-70' : ''
                        }`}
                      />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    {/* Center Play / Lock Affordance */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {!unlocked ? (
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-500/60 bg-black/70 text-[#E5C158] backdrop-blur-sm">
                            <Lock className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-medium text-zinc-100">
                            {item.access_tier === 'vip'
                              ? 'Exclusivo Clube VIP'
                              : `Desbloquear · ${formatBrl(item.price_brl)}`}
                          </span>
                        </div>
                      ) : item.media_type === 'video' ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-400/50 bg-black/60 text-zinc-50 backdrop-blur-sm group-hover:bg-[#D4AF37] group-hover:text-zinc-950 group-hover:border-[#D4AF37] transition-colors">
                          <Play className="h-5 w-5 ml-0.5" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        {item.media_type === 'video' ? (
                          <Film className="h-3.5 w-3.5 text-[#D4AF37]" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 text-[#D4AF37]" />
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
                      <span className="font-mono text-[#E5C158] tabular-nums">
                        {item.access_tier === 'free'
                          ? 'Prévia'
                          : item.access_tier === 'vip'
                          ? 'VIP'
                          : formatBrl(item.price_brl)}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-medium text-zinc-100 truncate">
                      {item.title}
                    </h3>

                    <p className="text-xs text-zinc-500">
                      Publicado em {formatDateShort(item.created_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Clube VIP Section */}
      <section
        id="clube-vip"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-xl border border-zinc-800/80 bg-[#121215] p-8 lg:p-12"
      >
        <div className="lg:col-span-7 space-y-4">
          <p className="text-xs font-medium text-[#D4AF37]">Acesso Ilimitado · 30 Dias</p>
          <h2 className="font-display text-3xl font-semibold text-zinc-50">
            Clube VIP de {profile.display_name}
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl">
            {profile.vip_description}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-300">
            <div>
              <p className="font-semibold text-zinc-100 mb-1">Acervo Completo</p>
              <p className="text-zinc-400">Todas as fotos e vídeos VIP desbloqueados na hora.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-100 mb-1">Streaming Privado</p>
              <p className="text-zinc-400">URLs assinadas direto do servidor com alta velocidade.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-100 mb-1">Pagamento Seguro</p>
              <p className="text-zinc-400">Via Pix instantâneo ou cartão vinculado ao seu e-mail.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#09090B] p-6 lg:p-8 space-y-5">
          <div>
            <p className="text-xs text-zinc-400">Valor da assinatura mensal</p>
            <p className="font-mono text-3xl font-semibold text-[#E5C158] tabular-nums mt-1">
              {formatBrl(profile.vip_monthly_price_brl)}
              <span className="text-sm font-sans font-normal text-zinc-400"> / mês</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenVipModal}
            className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors cursor-pointer"
          >
            {fan?.is_vip ? 'Renovar Acesso VIP' : 'Assinar Clube VIP Agora'}
          </button>
          <p className="text-xs text-zinc-500 text-center">
            Exclusivo para maiores de 18 anos. Acesso sincronizado pelo seu e-mail.
          </p>
        </div>
      </section>
    </main>
  );
};

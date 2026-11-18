/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Navbar, type AppView } from './components/Navbar';
import { Storefront } from './components/Storefront';
import { CreatorStudio, type StudioTab } from './components/CreatorStudio';
import { MediaModal } from './components/MediaModal';
import type { CreatorProfile, FanAccount, MediaItem, StorefrontStats, SupabaseStatus, VideoCallPlan } from './types';
import { DEFAULT_VIDEO_CALL_PLANS } from './lib/videoCalls';
import { DEFAULT_CREATOR_ABOUT } from './lib/creatorAbout';
import { DEFAULT_MIMO_SECTION } from './lib/mimoGifts';
import { buildWhatsappReceiptUrl } from './lib/whatsapp';
import { useLocalFavorites } from './lib/favorites';

const INITIAL_PROFILE: CreatorProfile = {
  id: 'default-solo-creator',
  slug: 'solo',
  display_name: 'Valentina Noir',
  handle: '@valentinanoir',
  bio: 'Ensaios autorais, bastidores íntimos e vídeos exclusivos em 4K. Conteúdo estritamente para maiores de 18 anos.',
  location: 'Rio de Janeiro, Brasil',
  avatar_url: '/api/profile/asset/avatar',
  hero_url: '/api/profile/asset/hero',
  vip_monthly_price_brl: 49.9,
  vip_description:
    'Acesso ilimitado a todos os ensaios e vídeos marcados como VIP, atualizações semanais e prioridade em pedidos.',
  pix_key: '',
  whatsapp_number: '',
  video_call_plans: DEFAULT_VIDEO_CALL_PLANS,
  about_section: DEFAULT_CREATOR_ABOUT,
  mimo_config: DEFAULT_MIMO_SECTION,
  age_verified_18: true,
  updated_at: new Date().toISOString(),
};

const INITIAL_STATS: StorefrontStats = {
  totalPhotos: 0,
  totalVideos: 0,
  collectionsCount: 0,
  vipPriceBrl: 49.9,
  activeVipCount: 0,
};

function resolveInitialView(): AppView {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.toLowerCase();
  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    params.has('admin') ||
    window.location.hash === '#admin' ||
    params.get('studio_auth') === 'google' ||
    params.has('code') ||
    params.has('token_hash') ||
    params.has('error_description') ||
    window.location.hash.includes('access_token=') ||
    window.location.hash.includes('error_description=')
  ) {
    return 'studio';
  }
  return 'storefront';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(resolveInitialView);
  const [studioTab] = useState<StudioTab>('overview');

  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [profile, setProfile] = useState<CreatorProfile>(INITIAL_PROFILE);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<StorefrontStats>(INITIAL_STATS);
  const [fanEmail, setFanEmail] = useState<string>(() => localStorage.getItem('mp_fan_email') || '');
  const [fan, setFan] = useState<FanAccount | null>(null);
  const [loadingStorefront, setLoadingStorefront] = useState(true);
  const { favoriteIds, isFavorite, toggleFavorite } = useLocalFavorites();

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'media' | 'vip' | 'tip' | 'fan_login' | 'fan_account' | 'video_call';
    fanAuthTab?: 'register' | 'login';
    mediaItem: MediaItem | null;
    videoCallPlan: VideoCallPlan | null;
    tipPresetAmount?: number;
  }>({
    isOpen: false,
    mode: 'media',
    fanAuthTab: 'register',
    mediaItem: null,
    videoCallPlan: null,
    tipPresetAmount: undefined,
  });

  // Keep view synchronized with browser Back/Forward navigation between / and /admin
  useEffect(() => {
    const handlePopState = () => {
      setActiveView(resolveInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const refreshSupabaseStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/supabase/status');
      if (resp.ok) {
        const data = await resp.json();
        setSupabaseStatus(data);
      }
    } catch {
      // keep previous status
    }
  }, []);

  const refreshStorefront = useCallback(async (emailOverride?: string) => {
    const targetEmail = emailOverride !== undefined ? emailOverride : fanEmail;
    setLoadingStorefront(true);
    try {
      const qs = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : '';
      const resp = await fetch(`/api/storefront${qs}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.profile) setProfile(data.profile);
        setMediaItems(data.mediaItems || []);
        if (data.stats) setStats(data.stats);
        setFan(data.fan || null);

        // Keep open modal media item synced after purchase
        setModalState((prev) => {
          if (!prev.isOpen || prev.mode !== 'media' || !prev.mediaItem) return prev;
          const updated = (data.mediaItems || []).find((m: MediaItem) => m.id === prev.mediaItem?.id);
          return updated ? { ...prev, mediaItem: updated } : prev;
        });
      }
    } finally {
      setLoadingStorefront(false);
    }
  }, [fanEmail]);

  useEffect(() => {
    refreshSupabaseStatus();
    refreshStorefront();
  }, [refreshSupabaseStatus, refreshStorefront]);

  const handleJumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenPublicStorefront = () => {
    if (window.location.pathname.toLowerCase().startsWith('/admin') || window.location.search.includes('admin') || window.location.hash === '#admin') {
      window.history.pushState({}, '', '/');
    }
    setActiveView('storefront');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenFanAuth = (tab: 'register' | 'login' = 'register') => {
    setModalState({
      isOpen: true,
      mode: 'fan_login',
      fanAuthTab: tab,
      mediaItem: null,
      videoCallPlan: null,
    });
  };

  const handleFanAuthenticated = async (email: string) => {
    localStorage.setItem('mp_fan_email', email);
    setFanEmail(email);
    await refreshStorefront(email);
  };

  const handleLogoutFan = () => {
    localStorage.removeItem('mp_fan_email');
    setFanEmail('');
    setFan(null);
    refreshStorefront('');
  };

  if (activeView === 'studio') {
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen flex flex-col bg-[#D2CCC4] text-[#181615]">
          <CreatorStudio
            initialTab={studioTab}
            supabaseStatus={supabaseStatus}
            profile={profile}
            onRefreshStatus={refreshSupabaseStatus}
            onRefreshStorefront={() => refreshStorefront()}
            onOpenStorefront={handleOpenPublicStorefront}
          />
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#D8D4CF] text-[#1C1918]">
        <Navbar
          brandName={profile.display_name}
          fan={fan}
          onJumpToSection={handleJumpToSection}
          onOpenVipModal={() =>
            setModalState({ isOpen: true, mode: 'vip', mediaItem: null, videoCallPlan: null })
          }
          onOpenFanAuth={(tab) => handleOpenFanAuth(tab)}
          onOpenFanAccount={() =>
            setModalState({
              isOpen: true,
              mode: fan ? 'fan_account' : 'fan_login',
              fanAuthTab: 'login',
              mediaItem: null,
              videoCallPlan: null,
            })
          }
        />

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key="storefront-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Storefront
                loading={loadingStorefront}
                profile={profile}
                mediaItems={mediaItems}
                fan={fan}
                stats={stats}
                onSelectMedia={(item) =>
                  setModalState({ isOpen: true, mode: 'media', mediaItem: item, videoCallPlan: null })
                }
                onSelectVideoCallPlan={(plan) =>
                  setModalState({ isOpen: true, mode: 'video_call', mediaItem: null, videoCallPlan: plan })
                }
                onOpenVipModal={() =>
                  setModalState({ isOpen: true, mode: 'vip', mediaItem: null, videoCallPlan: null })
                }
                onOpenTipModal={(presetAmount) =>
                  setModalState({
                    isOpen: true,
                    mode: 'tip',
                    mediaItem: null,
                    videoCallPlan: null,
                    tipPresetAmount: presetAmount,
                  })
                }
                onOpenFanLogin={(tab) => handleOpenFanAuth(tab)}
                onOpenFanAccount={() =>
                  setModalState({
                    isOpen: true,
                    mode: fan ? 'fan_account' : 'fan_login',
                    fanAuthTab: 'login',
                    mediaItem: null,
                    videoCallPlan: null,
                  })
                }
                onLogoutFan={handleLogoutFan}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="border-t border-[#453F3B] bg-[#23201E] py-6 sm:py-8 px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-[#C7C1BA]">
            <p>
              © {new Date().getFullYear()} {profile.display_name} · Conteúdo exclusivo para maiores de 18 anos (+18).
            </p>
            <nav
              aria-label="Links públicos e acesso do internauta"
              className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-5"
            >
              <button
                type="button"
                onClick={() => handleJumpToSection('sobre-criadora')}
                className="hover:text-[#F4F1ED] transition-colors cursor-pointer py-1"
              >
                Sobre
              </button>
              <button
                type="button"
                onClick={() => handleJumpToSection('video-chamada')}
                className="hover:text-[#F4F1ED] transition-colors cursor-pointer py-1"
              >
                Vídeo Chamada 1:1
              </button>
              <button
                type="button"
                onClick={() => handleJumpToSection('enviar-mimo')}
                className="hover:text-[#F4F1ED] transition-colors cursor-pointer py-1"
              >
                Enviar Mimo
              </button>
              <button
                type="button"
                onClick={() => handleJumpToSection('vitrine-grid')}
                className="hover:text-[#F4F1ED] transition-colors cursor-pointer py-1"
              >
                Galeria
              </button>
              <button
                type="button"
                onClick={() => handleJumpToSection('clube-vip')}
                className="hover:text-[#F4F1ED] transition-colors cursor-pointer py-1"
              >
                Clube VIP
              </button>
              <button
                type="button"
                onClick={() =>
                  fan
                    ? setModalState({ isOpen: true, mode: 'fan_account', mediaItem: null, videoCallPlan: null })
                    : handleOpenFanAuth('register')
                }
                className="text-[#E5C158] hover:text-[#f0cf6b] transition-colors font-medium cursor-pointer py-1"
              >
                {fan ? 'Minha Conta' : 'Cadastro / Entrar'}
              </button>
              {(() => {
                const footerWaUrl = buildWhatsappReceiptUrl(profile.whatsapp_number, {
                  creatorName: profile.display_name,
                  isReceipt: true,
                });
                return footerWaUrl ? (
                  <a
                    href={footerWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 hover:text-emerald-200 transition-colors font-medium py-1"
                  >
                    Enviar Comprovante (WhatsApp)
                  </a>
                ) : null;
              })()}
            </nav>
          </div>
        </footer>

        <MediaModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          fanAuthInitialTab={modalState.fanAuthTab}
          mediaItem={modalState.mediaItem}
          videoCallPlan={modalState.videoCallPlan}
          tipPresetAmount={modalState.tipPresetAmount}
          profile={profile}
          fan={fan}
          supabaseConnected={Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady)}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onFanAuthenticated={handleFanAuthenticated}
          onPurchaseSuccess={handleFanAuthenticated}
          onOpenFanAccount={() =>
            setModalState((prev) => ({ ...prev, isOpen: true, mode: 'fan_account', mediaItem: null, videoCallPlan: null }))
          }
          onOpenVipModal={() =>
            setModalState({ isOpen: true, mode: 'vip', mediaItem: null, videoCallPlan: null })
          }
          onOpenTipModal={() =>
            setModalState({ isOpen: true, mode: 'tip', mediaItem: null, videoCallPlan: null })
          }
          onLogoutFan={handleLogoutFan}
          isFavorite={modalState.mediaItem ? isFavorite(modalState.mediaItem.id) : false}
          onToggleFavorite={toggleFavorite}
        />
      </div>
    </MotionConfig>
  );
}


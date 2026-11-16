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

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(() => {
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
  });
  const [studioTab, setStudioTab] = useState<StudioTab>('overview');

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
    mode: 'media' | 'vip' | 'tip' | 'fan_login' | 'video_call';
    mediaItem: MediaItem | null;
    videoCallPlan: VideoCallPlan | null;
  }>({
    isOpen: false,
    mode: 'media',
    mediaItem: null,
    videoCallPlan: null,
  });

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

  const handleNavigateToStudio = (tab: StudioTab = 'overview') => {
    setStudioTab(tab);
    setActiveView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`min-h-screen flex flex-col ${
          activeView === 'studio'
            ? 'bg-[#D2CCC4] text-[#181615]'
            : 'bg-[#D8D4CF] text-[#1C1918]'
        }`}
      >
        <Navbar
          brandName={profile.display_name}
          activeView={activeView}
          onNavigateView={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNavigateStudioTab={(tab) => handleNavigateToStudio(tab)}
          onJumpToSection={handleJumpToSection}
          onOpenVipModal={() =>
            setModalState({ isOpen: true, mode: 'vip', mediaItem: null, videoCallPlan: null })
          }
        />

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeView === 'storefront' ? (
              <motion.div
                key="storefront-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Storefront
                  supabaseConnected={Boolean(supabaseStatus?.connected)}
                  schemaMissing={Boolean(supabaseStatus?.connected && !supabaseStatus?.schemaReady)}
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
                  onOpenTipModal={() =>
                    setModalState({ isOpen: true, mode: 'tip', mediaItem: null, videoCallPlan: null })
                  }
                  onOpenFanLogin={() =>
                    setModalState({ isOpen: true, mode: 'fan_login', mediaItem: null, videoCallPlan: null })
                  }
                  onLogoutFan={handleLogoutFan}
                  onNavigateToStudio={(tab) => handleNavigateToStudio(tab || 'overview')}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              </motion.div>
            ) : (
              <motion.div
                key="studio-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <CreatorStudio
                  initialTab={studioTab}
                  supabaseStatus={supabaseStatus}
                  profile={profile}
                  onRefreshStatus={refreshSupabaseStatus}
                  onRefreshStorefront={() => refreshStorefront()}
                  onOpenStorefront={() => {
                    setActiveView('storefront');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      <footer className="border-t border-[#453F3B] bg-[#23201E] py-8 px-6 lg:px-10">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#C7C1BA]">
          <p>
            © {new Date().getFullYear()} {profile.display_name} · Conteúdo exclusivo para maiores de 18 anos (+18).
          </p>
          <div className="flex flex-wrap items-center gap-6">
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
                  className="text-[#E5C158] hover:text-[#f0cf6b] transition-colors font-medium"
                >
                  Enviar Comprovante (WhatsApp)
                </a>
              ) : null;
            })()}
            <button
              type="button"
              onClick={() => handleNavigateToStudio('supabase')}
              className="hover:text-[#F4F1ED] transition-colors cursor-pointer"
            >
              Conexão Supabase
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToStudio('overview')}
              className="hover:text-[#F4F1ED] transition-colors cursor-pointer"
            >
              Administração do Site
            </button>
          </div>
        </div>
      </footer>

      <MediaModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        mediaItem={modalState.mediaItem}
        videoCallPlan={modalState.videoCallPlan}
        profile={profile}
        fan={fan}
        supabaseConnected={Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady)}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onFanAuthenticated={handleFanAuthenticated}
        onPurchaseSuccess={handleFanAuthenticated}
        onGoToSupabaseSetup={() => handleNavigateToStudio('supabase')}
        onGoToProfileSetup={() => handleNavigateToStudio('profile')}
        isFavorite={modalState.mediaItem ? isFavorite(modalState.mediaItem.id) : false}
        onToggleFavorite={toggleFavorite}
      />
      </div>
    </MotionConfig>
  );
}

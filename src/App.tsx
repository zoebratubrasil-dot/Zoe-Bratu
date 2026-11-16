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
import type { CreatorProfile, FanAccount, MediaItem, StorefrontStats, SupabaseStatus } from './types';

const INITIAL_PROFILE: CreatorProfile = {
  id: 'default-solo-creator',
  slug: 'solo',
  display_name: 'Valentina Noir',
  handle: '@valentinanoir',
  bio: 'Ensaios autorais, bastidores íntimos e vídeos exclusivos em 4K. Conteúdo estritamente para maiores de 18 anos.',
  location: 'São Paulo, Brasil',
  avatar_url: '/src/assets/images/creator_avatar_portrait_1794805425733.jpg',
  hero_url: '/src/assets/images/creator_hero_editorial_1794805426073.jpg',
  vip_monthly_price_brl: 49.9,
  vip_description:
    'Acesso ilimitado a todos os ensaios e vídeos marcados como VIP, atualizações semanais e prioridade em pedidos.',
  pix_key: '',
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
  const [activeView, setActiveView] = useState<AppView>('storefront');
  const [studioTab, setStudioTab] = useState<StudioTab>('upload');

  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [profile, setProfile] = useState<CreatorProfile>(INITIAL_PROFILE);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<StorefrontStats>(INITIAL_STATS);
  const [fanEmail, setFanEmail] = useState<string>(() => localStorage.getItem('mp_fan_email') || '');
  const [fan, setFan] = useState<FanAccount | null>(null);
  const [loadingStorefront, setLoadingStorefront] = useState(true);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'media' | 'vip' | 'tip' | 'fan_login';
    mediaItem: MediaItem | null;
  }>({
    isOpen: false,
    mode: 'media',
    mediaItem: null,
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

  const handleNavigateToStudio = (tab: StudioTab = 'upload') => {
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
      <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
        <Navbar
          brandName={profile.display_name}
          activeView={activeView}
          onNavigateView={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onJumpToSection={handleJumpToSection}
          onOpenVipModal={() => setModalState({ isOpen: true, mode: 'vip', mediaItem: null })}
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
                  onSelectMedia={(item) => setModalState({ isOpen: true, mode: 'media', mediaItem: item })}
                  onOpenVipModal={() => setModalState({ isOpen: true, mode: 'vip', mediaItem: null })}
                  onOpenTipModal={() => setModalState({ isOpen: true, mode: 'tip', mediaItem: null })}
                  onOpenFanLogin={() => setModalState({ isOpen: true, mode: 'fan_login', mediaItem: null })}
                  onLogoutFan={handleLogoutFan}
                  onNavigateToStudio={(tab) => handleNavigateToStudio(tab || 'upload')}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      <footer className="border-t border-zinc-800/80 bg-[#09090B] py-8 px-6 lg:px-10 mt-12">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>
            © {new Date().getFullYear()} {profile.display_name} · Conteúdo exclusivo para maiores de 18 anos (+18).
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => handleNavigateToStudio('supabase')}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Conexão Supabase
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToStudio('upload')}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Estúdio da Criadora
            </button>
          </div>
        </div>
      </footer>

      <MediaModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        mediaItem={modalState.mediaItem}
        profile={profile}
        fan={fan}
        supabaseConnected={Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady)}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onFanAuthenticated={handleFanAuthenticated}
        onPurchaseSuccess={handleFanAuthenticated}
        onGoToSupabaseSetup={() => handleNavigateToStudio('supabase')}
      />
      </div>
    </MotionConfig>
  );
}

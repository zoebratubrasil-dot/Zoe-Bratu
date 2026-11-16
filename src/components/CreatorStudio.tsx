import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Upload,
  FolderKanban,
  Receipt,
  UserCog,
  Database,
  Lock,
  LogOut,
} from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, SupabaseStatus } from '../types';
import { MediaUploader } from './studio/MediaUploader';
import { MediaManager } from './studio/MediaManager';
import { SalesLedger } from './studio/SalesLedger';
import { CreatorProfileSettings } from './studio/CreatorProfileSettings';
import { SupabaseSetup } from './studio/SupabaseSetup';

export type StudioTab = 'upload' | 'manage' | 'sales' | 'profile' | 'supabase';

interface CreatorStudioProps {
  initialTab?: StudioTab;
  supabaseStatus: SupabaseStatus | null;
  profile: CreatorProfile;
  onRefreshStatus: () => Promise<void>;
  onRefreshStorefront: () => Promise<void>;
}

const EMPTY_DASHBOARD: CreatorDashboardData = {
  mediaItems: [],
  sales: [],
  fans: [],
  metrics: {
    totalRevenueBrl: 0,
    vipRevenueBrl: 0,
    ppvRevenueBrl: 0,
    tipsRevenueBrl: 0,
    totalSalesCount: 0,
    activeVipFans: 0,
    totalMediaCount: 0,
  },
};

export const CreatorStudio: React.FC<CreatorStudioProps> = ({
  initialTab = 'upload',
  supabaseStatus,
  profile,
  onRefreshStatus,
  onRefreshStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [creatorPin, setCreatorPin] = useState<string>(() => sessionStorage.getItem('mp_creator_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [dashboard, setDashboard] = useState<CreatorDashboardData>(EMPTY_DASHBOARD);
  const [studioProfile, setStudioProfile] = useState<CreatorProfile>(profile);
  const [loadingDash, setLoadingDash] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setStudioProfile(profile);
  }, [profile]);

  const fetchDashboard = useCallback(async (pin: string) => {
    if (!pin) return;
    setLoadingDash(true);
    try {
      const resp = await fetch('/api/creator/dashboard', {
        headers: { 'x-creator-pin': pin },
      });
      if (resp.status === 401) {
        sessionStorage.removeItem('mp_creator_pin');
        setCreatorPin('');
        return;
      }
      const data = await resp.json();
      if (data.dashboard) setDashboard(data.dashboard);
      if (data.profile) setStudioProfile(data.profile);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  useEffect(() => {
    if (creatorPin) {
      fetchDashboard(creatorPin);
    }
  }, [creatorPin, fetchDashboard, supabaseStatus?.connected, supabaseStatus?.schemaReady]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setVerifying(true);
    try {
      const resp = await fetch('/api/creator/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (!resp.ok) {
        setPinError('PIN incorreto. O padrão inicial é 1818 (alterável em Perfil & Preços).');
      } else {
        sessionStorage.setItem('mp_creator_pin', pinInput);
        setCreatorPin(pinInput);
        setPinInput('');
      }
    } catch {
      setPinError('Erro ao verificar PIN.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLockStudio = () => {
    sessionStorage.removeItem('mp_creator_pin');
    setCreatorPin('');
  };

  const supabaseReady = Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady);

  if (!creatorPin) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-[#121215] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-[#D4AF37]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-zinc-50">
                Estúdio da Criadora
              </h1>
              <p className="text-xs text-zinc-400">
                Área privada para envio de fotos, vídeos e banco de vendas
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                PIN de Acesso da Criadora
              </label>
              <input
                type="password"
                required
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Digite o PIN (padrão inicial: 1818)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            {pinError && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {verifying ? 'Validando...' : 'Desbloquear Estúdio'}
            </button>
          </form>

          <p className="text-xs text-zinc-500">
            Você pode alterar o PIN padrão a qualquer momento na aba <span className="text-zinc-300">Perfil & Preços</span>.
          </p>
        </div>
      </main>
    );
  }

  const navItems: Array<{ id: StudioTab; label: string; icon: React.ReactNode }> = [
    { id: 'upload', label: 'Enviar Fotos & Vídeos', icon: <Upload className="h-4 w-4" /> },
    { id: 'manage', label: 'Gerenciar Conteúdo', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'sales', label: 'Banco de Vendas', icon: <Receipt className="h-4 w-4" /> },
    { id: 'profile', label: 'Perfil & Preços', icon: <UserCog className="h-4 w-4" /> },
    { id: 'supabase', label: 'Conexão Supabase', icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation (240-280px equivalent in 12-col grid) */}
        <aside className="lg:col-span-3 rounded-xl border border-zinc-800/80 bg-[#121215] p-4 space-y-6">
          <div className="px-2 pt-1">
            <p className="text-xs text-[#D4AF37] font-medium">Painel Administrativo</p>
            <p className="font-display text-lg font-semibold text-zinc-50 truncate">
              {studioProfile.display_name}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {supabaseReady ? 'Supabase conectado e ativo' : 'Supabase pendente de conexão'}
            </p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="studio-sidebar-pill"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-lg bg-[#D4AF37]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3 min-w-0">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={handleLockStudio}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Bloquear Estúdio
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <section className="lg:col-span-9 min-w-0">
          {loadingDash && dashboard.mediaItems.length === 0 && activeTab !== 'supabase' ? (
            <div className="rounded-xl border border-zinc-800 bg-[#121215] p-12 text-center text-xs text-zinc-400">
              Sincronizando dados do Supabase...
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'upload' && (
                <MediaUploader
                  creatorPin={creatorPin}
                  supabaseReady={supabaseReady}
                  onUploaded={async () => {
                    await fetchDashboard(creatorPin);
                    await onRefreshStorefront();
                  }}
                  onGoToSupabase={() => setActiveTab('supabase')}
                />
              )}

              {activeTab === 'manage' && (
                <MediaManager
                  creatorPin={creatorPin}
                  mediaItems={dashboard.mediaItems}
                  onRefresh={async () => {
                    await fetchDashboard(creatorPin);
                    await onRefreshStorefront();
                  }}
                  onGoToUpload={() => setActiveTab('upload')}
                />
              )}

              {activeTab === 'sales' && (
                <SalesLedger
                  creatorPin={creatorPin}
                  dashboard={dashboard}
                  onRefresh={() => fetchDashboard(creatorPin)}
                />
              )}

              {activeTab === 'profile' && (
                <CreatorProfileSettings
                  creatorPin={creatorPin}
                  profile={studioProfile}
                  supabaseReady={supabaseReady}
                  onUpdated={async (newPin) => {
                    const activePin = newPin || creatorPin;
                    if (newPin) {
                      sessionStorage.setItem('mp_creator_pin', newPin);
                      setCreatorPin(newPin);
                    }
                    await fetchDashboard(activePin);
                    await onRefreshStorefront();
                  }}
                />
              )}

              {activeTab === 'supabase' && (
                <SupabaseSetup
                  creatorPin={creatorPin}
                  status={supabaseStatus}
                  onRefreshStatus={async () => {
                    await onRefreshStatus();
                    await onRefreshStorefront();
                    await fetchDashboard(creatorPin);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { Crown, UserCheck } from 'lucide-react';
import type { FanAccount } from '../types';
import type { StudioTab } from './CreatorStudio';

export type AppView = 'storefront' | 'studio';

interface NavbarProps {
  brandName: string;
  activeView: AppView;
  fan?: FanAccount | null;
  onNavigateView: (view: AppView) => void;
  onNavigateStudioTab: (tab: StudioTab) => void;
  onJumpToSection: (sectionId: string) => void;
  onOpenVipModal: () => void;
  onOpenFanAccount?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName,
  activeView,
  fan,
  onNavigateView,
  onNavigateStudioTab,
  onJumpToSection,
  onOpenVipModal,
  onOpenFanAccount,
}) => {
  const isGoldVip = Boolean(fan?.loyalty?.is_gold_vip);

  return (
    <header className="sticky top-0 z-40 border-b border-[#2B2725]/25 bg-[#E4E0DC]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 sm:gap-6 lg:gap-8 px-3 sm:px-6 py-2.5 sm:py-3.5 lg:px-10">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigateView('storefront')}
          className="font-display text-lg sm:text-2xl font-bold uppercase tracking-[0.05em] sm:tracking-[0.06em] text-[#1C1918] whitespace-nowrap truncate max-w-[120px] sm:max-w-[210px] lg:max-w-none hover:text-[#4A4440] transition-colors cursor-pointer"
        >
          {brandName}
        </button>

        {/* Zone 2: Concise single-line editorial navigation links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 xl:gap-7 text-[11px] lg:text-xs font-semibold uppercase tracking-[0.08em] text-[#4A4440]">
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('vitrine-grid'), 40);
            }}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#1C1918] ${
              activeView === 'storefront' ? 'text-[#1C1918]' : ''
            }`}
          >
            Vitrine
            {activeView === 'storefront' && (
              <motion.span
                layoutId="navbar-active-underline"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 -bottom-1 h-[2px] bg-[#1C1918]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('video-chamada'), 40);
            }}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Vídeo Chamada
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('clube-vip'), 40);
            }}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Clube VIP
          </button>
          <button
            type="button"
            onClick={() => onNavigateStudioTab('overview')}
            className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#1C1918] ${
              activeView === 'studio' ? 'text-[#1C1918]' : ''
            }`}
          >
            Administração
            {activeView === 'studio' && (
              <motion.span
                layoutId="navbar-active-underline"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 -bottom-1 h-[2px] bg-[#1C1918]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigateStudioTab('sales')}
            className="hidden lg:inline-block py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Banco de Vendas
          </button>
        </nav>

        {/* Zone 3: Fan account / Loyalty shortcut + Primary action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {activeView === 'storefront' ? (
            <>
              {onOpenFanAccount && (
                <button
                  type="button"
                  onClick={onOpenFanAccount}
                  aria-label={fan ? 'Minha Conta e Nível de Lealdade' : 'Acessar Minha Conta'}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider rounded-sm border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    fan
                      ? isGoldVip
                        ? 'border-[#E5C158] bg-[#2B2012] text-[#F7DF8D] hover:bg-[#3A2B18]'
                        : 'border-[#2B2725]/35 bg-[#EAE6E2] text-[#1C1918] hover:border-[#1C1918]'
                      : 'border-[#2B2725]/25 bg-transparent text-[#4A4440] hover:text-[#1C1918] hover:border-[#1C1918]'
                  }`}
                >
                  {isGoldVip ? (
                    <Crown className="h-3.5 w-3.5 text-[#E5C158]" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 text-[#7A5412]" />
                  )}
                  <span className={fan ? 'inline' : 'hidden sm:inline'}>
                    {fan
                      ? isGoldVip
                        ? 'VIP Ouro'
                        : `${fan.loyalty?.progress_percent ?? 0}%`
                      : 'Minha Conta'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateStudioTab('overview')}
                className="md:hidden min-h-[38px] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#1C1918] border border-[#2B2725]/35 bg-[#EAE6E2] rounded-sm hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={onOpenVipModal}
                className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] rounded-sm hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="sm:hidden">VIP</span>
                <span className="hidden sm:inline">Assinar VIP</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateView('storefront')}
              className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] rounded-sm hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Vitrine Pública
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

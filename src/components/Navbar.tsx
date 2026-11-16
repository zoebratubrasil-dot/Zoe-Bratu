import React from 'react';
import { motion } from 'motion/react';
import type { StudioTab } from './CreatorStudio';

export type AppView = 'storefront' | 'studio';

interface NavbarProps {
  brandName: string;
  activeView: AppView;
  onNavigateView: (view: AppView) => void;
  onNavigateStudioTab: (tab: StudioTab) => void;
  onJumpToSection: (sectionId: string) => void;
  onOpenVipModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName,
  activeView,
  onNavigateView,
  onNavigateStudioTab,
  onJumpToSection,
  onOpenVipModal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[#2B2725]/25 bg-[#E4E0DC]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 sm:gap-8 px-6 py-3.5 lg:px-10">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigateView('storefront')}
          className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-[#1C1918] whitespace-nowrap shrink-0 hover:text-[#4A4440] transition-colors cursor-pointer"
        >
          {brandName}
        </button>

        {/* Zone 2: Concise single-line editorial navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-[0.08em] text-[#4A4440]">
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('vitrine-grid'), 40);
            }}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#1C1918] ${
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
            className="py-1 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Vídeo Chamada
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('clube-vip'), 40);
            }}
            className="py-1 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Clube VIP
          </button>
          <button
            type="button"
            onClick={() => onNavigateStudioTab('overview')}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#1C1918] ${
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
            className="whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Banco de Vendas
          </button>
        </nav>

        {/* Zone 3: Primary action + mobile admin shortcut */}
        <div className="flex items-center gap-2.5 shrink-0">
          {activeView === 'storefront' ? (
            <>
              <button
                type="button"
                onClick={() => onNavigateStudioTab('overview')}
                className="md:hidden px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#1C1918] border border-[#2B2725]/35 bg-[#EAE6E2] rounded-sm hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={onOpenVipModal}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] rounded-sm hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Assinar VIP
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateView('storefront')}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] rounded-sm hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Vitrine Pública
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

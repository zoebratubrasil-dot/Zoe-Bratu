import React from 'react';
import { motion } from 'motion/react';

export type AppView = 'storefront' | 'studio';

interface NavbarProps {
  brandName: string;
  activeView: AppView;
  onNavigateView: (view: AppView) => void;
  onJumpToSection: (sectionId: string) => void;
  onOpenVipModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName,
  activeView,
  onNavigateView,
  onJumpToSection,
  onOpenVipModal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090B]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-4 lg:px-10">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigateView('storefront')}
          className="font-display text-xl font-semibold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 hover:text-[#E5C158] transition-colors cursor-pointer"
        >
          {brandName}
        </button>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('vitrine-grid'), 40);
            }}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-zinc-100 ${
              activeView === 'storefront' ? 'text-zinc-100' : ''
            }`}
          >
            Vitrine
            {activeView === 'storefront' && (
              <motion.span
                layoutId="navbar-active-underline"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 -bottom-1 h-[2px] bg-[#D4AF37]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateView('storefront');
              setTimeout(() => onJumpToSection('clube-vip'), 40);
            }}
            className="py-1 whitespace-nowrap shrink-0 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Clube VIP
          </button>
          <button
            type="button"
            onClick={() => onNavigateView('studio')}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-zinc-100 ${
              activeView === 'studio' ? 'text-zinc-100' : ''
            }`}
          >
            Estúdio da Criadora
            {activeView === 'studio' && (
              <motion.span
                layoutId="navbar-active-underline"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 -bottom-1 h-[2px] bg-[#D4AF37]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateView('studio');
            }}
            className="whitespace-nowrap shrink-0 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Banco de Vendas
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {activeView === 'storefront' ? (
            <button
              type="button"
              onClick={onOpenVipModal}
              className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-[#D4AF37] rounded-md hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Assinar VIP
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateView('storefront')}
              className="px-4 py-2 text-xs font-semibold text-zinc-100 border border-zinc-700 bg-zinc-900 rounded-md hover:border-zinc-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Vitrine Pública
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

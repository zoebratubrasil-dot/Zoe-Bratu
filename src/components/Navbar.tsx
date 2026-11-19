import React from 'react';
import { Crown, UserPlus, UserCheck } from 'lucide-react';
import type { FanAccount } from '../types';
import { track } from '../lib/analytics';

export type AppView = 'storefront' | 'studio';

interface NavbarProps {
  brandName: string;
  fan?: FanAccount | null;
  onJumpToSection: (sectionId: string) => void;
  onOpenVipModal: () => void;
  onOpenFanAuth: (tab?: 'register' | 'login') => void;
  onOpenFanAccount: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName,
  fan,
  onJumpToSection,
  onOpenVipModal,
  onOpenFanAuth,
  onOpenFanAccount,
}) => {
  const isGoldVip = Boolean(fan?.loyalty?.is_gold_vip);

  return (
    <header className="sticky top-0 z-40 border-b border-[#2B2725]/25 bg-[#E4E0DC]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 sm:gap-6 lg:gap-8 px-3 sm:px-6 py-2.5 sm:py-3.5 lg:px-10">
        {/* Zone 1: Brand Title */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="font-display text-lg sm:text-2xl font-bold uppercase tracking-[0.05em] sm:tracking-[0.06em] text-[#1C1918] whitespace-nowrap truncate max-w-[130px] sm:max-w-[210px] lg:max-w-none hover:text-[#4A4440] transition-colors cursor-pointer"
        >
          {brandName}
        </button>

        {/* Zone 2: Public Pages Navigation (Internautas) */}
        <nav
          aria-label="Navegação do site público"
          className="hidden md:flex items-center gap-4 lg:gap-6 xl:gap-7 text-[11px] lg:text-xs font-semibold uppercase tracking-[0.08em] text-[#4A4440]"
        >
          <button
            type="button"
            onClick={() => onJumpToSection('sobre-criadora')}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Sobre
          </button>
          <button
            type="button"
            onClick={() => {
              track('video_call_click', {
                label: 'Menu Superior · Vídeo Chamada',
                placement: 'navbar',
              });
              onJumpToSection('video-chamada');
            }}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Vídeo Chamada
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('enviar-mimo')}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Mimos
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('vitrine-grid')}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Galeria
          </button>
          <button
            type="button"
            onClick={() => onJumpToSection('clube-vip')}
            className="py-1.5 whitespace-nowrap shrink-0 hover:text-[#1C1918] transition-colors cursor-pointer"
          >
            Clube VIP
          </button>
        </nav>

        {/* Zone 3: Internauta Cadastro / Minha Conta + Primary VIP CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {fan ? (
            <button
              type="button"
              onClick={onOpenFanAccount}
              aria-label="Minha Conta e Nível de Lealdade"
              className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider rounded-sm border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isGoldVip
                  ? 'border-[#E5C158] bg-[#2B2012] text-[#F7DF8D] hover:bg-[#3A2B18]'
                  : 'border-[#2B2725]/35 bg-[#EAE6E2] text-[#1C1918] hover:border-[#1C1918]'
              }`}
            >
              {isGoldVip ? (
                <Crown className="h-3.5 w-3.5 text-[#E5C158]" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 text-[#7A5412]" />
              )}
              <span>
                {isGoldVip
                  ? 'VIP Ouro'
                  : `Conta · ${fan.loyalty?.progress_percent ?? 0}%`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenFanAuth('register')}
              className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider rounded-sm border border-[#2B2725]/35 bg-[#EAE6E2] text-[#1C1918] hover:border-[#1C1918] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#7A5412]" />
              <span className="sm:hidden">Cadastro</span>
              <span className="hidden sm:inline">Cadastrar / Entrar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              track('buy_click', {
                label: 'Menu Superior · Assinar VIP',
                placement: 'navbar_vip',
              });
              onOpenVipModal();
            }}
            className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] rounded-sm hover:bg-[#383432] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="sm:hidden">VIP</span>
            <span className="hidden sm:inline">Assinar VIP</span>
          </button>
        </div>
      </div>
    </header>
  );
};


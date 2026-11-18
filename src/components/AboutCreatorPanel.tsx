import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  Video,
  Cpu,
  Heart,
  MessageCircle,
  ArrowRight,
  Lock,
  Radio,
  Sliders,
  Layers,
  Gift,
} from 'lucide-react';
import type { CreatorProfile, VideoCallPlan } from '../types';
import { resolveCreatorAboutContent } from '../lib/creatorAbout';
import { formatBrl } from '../lib/format';
import { buildWhatsappReceiptUrl } from '../lib/whatsapp';
import { ProtectedImage } from './ProtectedMedia';

type AboutModuleTab = 'carioca' | 'platform' | 'videocall';

interface AboutCreatorPanelProps {
  profile: CreatorProfile;
  avatarImgFailed: boolean;
  videoCallPlans: VideoCallPlan[];
  onSelectVideoCallPlan: (plan: VideoCallPlan) => void;
  onOpenVipModal: () => void;
  onOpenTipModal: (presetAmount?: number) => void;
}

const WAVE_BARS = [38, 72, 54, 92, 64, 84, 46, 76, 58, 88, 42, 68];

export const AboutCreatorPanel: React.FC<AboutCreatorPanelProps> = ({
  profile,
  avatarImgFailed,
  videoCallPlans,
  onSelectVideoCallPlan,
  onOpenVipModal,
  onOpenTipModal,
}) => {
  const about = useMemo(() => resolveCreatorAboutContent(profile.about_section), [profile.about_section]);
  const [activeTab, setActiveTab] = useState<AboutModuleTab>('carioca');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [activeExpIdx, setActiveExpIdx] = useState(0);
  const [activeTraitIdx, setActiveTraitIdx] = useState(0);
  const [whatsappPendingNotice, setWhatsappPendingNotice] = useState(false);

  const selectedExp = about.videocall_experiences[activeExpIdx] || about.videocall_experiences[0];
  const selectedStep = about.site_steps[activeStepIdx] || about.site_steps[0];

  const handleBookCreativeCall = () => {
    const plan = videoCallPlans[Math.min(activeExpIdx, Math.max(videoCallPlans.length - 1, 0))] || videoCallPlans[0];
    if (plan) {
      onSelectVideoCallPlan(plan);
    } else {
      const target = document.getElementById('video-chamada');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const tabs: Array<{ id: AboutModuleTab; label: string; icon: React.ReactNode }> = [
    { id: 'carioca', label: 'A Carioca', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'platform', label: 'Como Funciona', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'videocall', label: 'Na Chamada 1:1', icon: <Video className="h-3.5 w-3.5" /> },
  ];

  const waUrl = buildWhatsappReceiptUrl(profile.whatsapp_number, {
    creatorName: profile.display_name,
    isReceipt: true,
  });

  return (
    <div
      id="sobre-criadora"
      className="lg:col-span-5 bg-[#2B2725] text-[#F4F1ED] p-5 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-[#453F3B] flex flex-col justify-between gap-6"
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#453F3B] pb-3.5">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F1ED]">
              Sobre a Criadora
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#E5C158] mt-1">
              {about.headline_tag}
            </p>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-[#E5C158]">
            +18 Privado
          </span>
        </div>

        {/* Editorial Portrait + Live Signal Studio Module */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch">
          <div
            onContextMenu={(e) => e.preventDefault()}
            className="relative sm:col-span-5 aspect-[3/4] sm:aspect-auto sm:min-h-[215px] overflow-hidden border border-[#453F3B] bg-[#1C1918] media-shield"
          >
            {profile.avatar_url && !avatarImgFailed ? (
              <ProtectedImage
                src={profile.avatar_url}
                alt={profile.display_name}
                containerClassName="h-full w-full"
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-[#E5C158]">
                {profile.display_name.slice(0, 1)}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#1C1918]/90 via-transparent to-[#1C1918]/40" />
            <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 z-20 h-2.5 w-2.5 border-t border-l border-[#E5C158]" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 z-20 h-2.5 w-2.5 border-b border-r border-[#E5C158]" />
            <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1 text-[9px] font-mono uppercase tracking-[0.12em] text-[#E5C158]">
              <span className="inline-flex items-center gap-1">
                <Radio className="h-2.5 w-2.5" />
                CARISMA RJ
              </span>
              <span className="text-[#DED9D3]">4K PRIVADO</span>
            </div>
          </div>

          <div className="sm:col-span-7 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.1em] text-[#E5C158] font-semibold">
                {profile.handle} · {profile.location}
              </p>
              <p className="font-display italic text-base leading-snug text-[#F4F1ED]">
                {about.signature_quote}
              </p>
            </div>

            {/* High-Tech Encrypted Media & Presence Waveform Bar */}
            <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[#C7C1BA]">
                <span className="inline-flex items-center gap-1.5 text-[#E5C158]">
                  <ShieldCheck className="h-3 w-3" />
                  Sinal Privado Ativo
                </span>
                <span>Câmera 4K · Pix · WhatsApp</span>
              </div>
              <div className="flex items-end gap-1 h-5 pt-0.5" aria-hidden="true">
                {WAVE_BARS.map((heightPct, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ scaleY: 0.45 }}
                    animate={{ scaleY: [0.4, heightPct / 100, 0.5] }}
                    transition={{
                      duration: 1.8 + (idx % 4) * 0.25,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                      delay: idx * 0.08,
                    }}
                    style={{ originY: 1, height: '100%' }}
                    className={`flex-1 rounded-none ${
                      idx % 3 === 0 ? 'bg-[#E5C158]' : 'bg-[#6F665E]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-[#C7C1BA] leading-relaxed">
              {profile.vip_description}
            </p>
          </div>
        </div>

        {/* Interactive Tech Navigation Deck */}
        <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] overflow-hidden">
          <div className="grid grid-cols-3 border-b border-[#453F3B] bg-[#23201E]">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative min-h-[44px] flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.08em] transition-colors cursor-pointer ${
                    isSelected ? 'text-[#E5C158] bg-[#1C1918]' : 'text-[#C7C1BA] hover:text-[#F4F1ED]'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                  {isSelected && (
                    <motion.span
                      layoutId="aboutCreatorTabBar"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E5C158]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* TAB 1: A CARIOCA */}
            {activeTab === 'carioca' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F1ED]">
                      {about.carioca_title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158] shrink-0">
                      Essência 01
                    </span>
                  </div>
                  <p className="text-sm text-[#DED9D3] leading-relaxed">
                    {about.carioca_bio}
                  </p>
                </div>

                {/* 4 Interactive Signature Attribute Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {about.carioca_traits.map((trait, idx) => {
                    const isActive = activeTraitIdx === idx;
                    const levels = [98, 96, 100, 99];
                    return (
                      <button
                        key={`${trait}-${idx}`}
                        type="button"
                        onClick={() => setActiveTraitIdx(idx)}
                        className={`text-left rounded-sm border p-3 transition-colors cursor-pointer ${
                          isActive
                            ? 'border-[#E5C158] bg-[#2B2725]'
                            : 'border-[#3A3431] bg-[#23201E] hover:border-[#6F665E]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158]">
                            0{idx + 1} · DNA Carioca
                          </span>
                          <span className="font-mono text-[10px] text-[#C7C1BA] tabular-nums">
                            {levels[idx % levels.length]}%
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#F4F1ED] leading-snug">{trait}</p>
                        <div className="mt-2 h-1 w-full bg-[#1C1918] overflow-hidden">
                          <div
                            style={{ width: `${levels[idx % levels.length]}%` }}
                            className={`h-full transition-all duration-300 ${
                              isActive ? 'bg-[#E5C158]' : 'bg-[#6F665E]'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: COMO O SITE FUNCIONA */}
            {activeTab === 'platform' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F1ED]">
                      {about.site_how_title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158] shrink-0">
                      Arquitetura
                    </span>
                  </div>
                  <p className="text-sm text-[#DED9D3] leading-relaxed">
                    {about.site_how_intro}
                  </p>
                </div>

                {/* Interactive 4-Step Tech Timeline */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-1.5">
                  {about.site_steps.map((step, idx) => {
                    const active = idx === activeStepIdx;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setActiveStepIdx(idx)}
                        className={`min-h-[44px] rounded-sm border py-2 px-2 text-center transition-colors cursor-pointer ${
                          active
                            ? 'border-[#E5C158] bg-[#2B2725] text-[#E5C158]'
                            : 'border-[#3A3431] bg-[#23201E] text-[#C7C1BA] hover:border-[#6F665E]'
                        }`}
                      >
                        <span className="block font-mono text-xs font-bold tabular-nums">{step.step}</span>
                        <span className="block text-[10px] truncate mt-0.5 font-medium">
                          {step.title.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedStep && (
                  <div className="rounded-sm border border-[#E5C158]/40 bg-[#23201E] p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#E5C158]">
                        <Layers className="h-3 w-3" />
                        Etapa {selectedStep.step} de 0{about.site_steps.length}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#C7C1BA]">
                        <Lock className="h-3 w-3 text-[#E5C158]" />
                        TLS · Token Privado
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#F4F1ED]">{selectedStep.title}</p>
                    <p className="text-xs text-[#DED9D3] leading-relaxed">{selectedStep.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: COMO APROVEITAR NA VÍDEO CHAMADA */}
            {activeTab === 'videocall' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F1ED]">
                      {about.videocall_title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158] shrink-0">
                      Ao Vivo 1:1
                    </span>
                  </div>
                  <p className="text-sm text-[#DED9D3] leading-relaxed">
                    {about.videocall_intro}
                  </p>
                </div>

                {/* Creative Live Call Mood Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#C7C1BA]">
                    <span className="inline-flex items-center gap-1 text-[#E5C158]">
                      <Sliders className="h-3 w-3" />
                      Simulador de Clima ao Vivo
                    </span>
                    <span>Toque para explorar</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {about.videocall_experiences.map((exp, idx) => {
                      const active = idx === activeExpIdx;
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => setActiveExpIdx(idx)}
                          className={`rounded-sm border p-2.5 text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#E5C158] bg-[#2B2725] text-[#F4F1ED]'
                              : 'border-[#3A3431] bg-[#23201E] text-[#C7C1BA] hover:border-[#6F665E]'
                          }`}
                        >
                          <p className="font-mono text-[9px] uppercase tracking-wider text-[#E5C158] truncate">
                            {exp.badge}
                          </p>
                          <p className="text-xs font-semibold mt-0.5 line-clamp-1">{exp.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedExp && (
                  <div className="rounded-sm border border-[#E5C158]/45 bg-[#23201E] p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158]">
                        {selectedExp.subtitle}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#F4F1ED] bg-[#1C1918] border border-[#453F3B] px-2 py-0.5">
                        {selectedExp.duration_hint}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#F4F1ED]">{selectedExp.title}</p>
                    <p className="text-xs text-[#DED9D3] leading-relaxed">{selectedExp.description}</p>
                    <button
                      type="button"
                      onClick={handleBookCreativeCall}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#E5C158] hover:underline pt-1 cursor-pointer"
                    >
                      <span>Reservar Vídeo Chamada nesse clima</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Always-Visible Compact 3-Pillar Overview Cards (ensures full story visible at a glance) */}
        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('carioca')}
            className={`text-left rounded-sm border px-3.5 py-2.5 transition-colors cursor-pointer ${
              activeTab === 'carioca'
                ? 'border-[#E5C158]/60 bg-[#1C1918]'
                : 'border-[#453F3B] bg-[#23201E]/70 hover:border-[#6F665E]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#E5C158]">
                01 · A Carioca
              </span>
              <span className="text-[10px] text-[#C7C1BA]">Charme, Beleza & Inteligência</span>
            </div>
            <p className="text-xs text-[#DED9D3] mt-1 line-clamp-2">{about.carioca_bio}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('platform')}
            className={`text-left rounded-sm border px-3.5 py-2.5 transition-colors cursor-pointer ${
              activeTab === 'platform'
                ? 'border-[#E5C158]/60 bg-[#1C1918]'
                : 'border-[#453F3B] bg-[#23201E]/70 hover:border-[#6F665E]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#E5C158]">
                02 · Funcionamento do Site
              </span>
              <span className="text-[10px] text-[#C7C1BA]">VIP · Avulsos · Favoritos · Pix</span>
            </div>
            <p className="text-xs text-[#DED9D3] mt-1 line-clamp-2">{about.site_how_intro}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('videocall')}
            className={`text-left rounded-sm border px-3.5 py-2.5 transition-colors cursor-pointer ${
              activeTab === 'videocall'
                ? 'border-[#E5C158]/60 bg-[#1C1918]'
                : 'border-[#453F3B] bg-[#23201E]/70 hover:border-[#6F665E]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#E5C158]">
                03 · Na Vídeo Chamada 1 a 1
              </span>
              <span className="text-[10px] text-[#C7C1BA]">Câmera 4K & Criatividade ao Vivo</span>
            </div>
            <p className="text-xs text-[#DED9D3] mt-1 line-clamp-2">{about.videocall_intro}</p>
          </button>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="space-y-3 pt-4 border-t border-[#453F3B]">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenVipModal}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center rounded-sm bg-[#E5C158] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#1C1918] hover:bg-[#f0cf6b] transition-colors cursor-pointer"
          >
            Assinar VIP ({formatBrl(profile.vip_monthly_price_brl)})
          </button>
          <button
            type="button"
            onClick={() => onOpenTipModal()}
            className="mimo-shimmer-btn group w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Gift className="h-3.5 w-3.5 text-[#E5C158] transition-transform group-hover:rotate-[-10deg]" />
            <span>Enviar Mimo</span>
          </button>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-500/60 bg-emerald-950/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/60 hover:border-emerald-400 transition-colors cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              Enviar Comprovante (WhatsApp)
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setWhatsappPendingNotice((prev) => !prev)}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-500/50 bg-emerald-950/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 hover:border-emerald-400 transition-colors cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              Enviar Comprovante (WhatsApp)
            </button>
          )}
        </div>

        {whatsappPendingNotice && !profile.whatsapp_number && (
          <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] p-3 text-xs text-[#DED9D3]">
            Atendimento via WhatsApp indisponível no momento. Seu acesso e comprovantes ficam vinculados ao seu e-mail cadastrado.
          </div>
        )}
      </div>
    </div>
  );
};

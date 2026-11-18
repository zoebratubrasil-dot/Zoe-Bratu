import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Lock,
  Play,
  Check,
  CreditCard,
  QrCode,
  ShieldAlert,
  Image as ImageIcon,
  Film,
  Video,
  Clock,
  MessageCircle,
  Heart,
  Gift,
  Sparkles,
  Crown,
  Wine,
} from 'lucide-react';
import type {
  CreatorProfile,
  FanAccount,
  FanLoyaltySummary,
  MediaItem,
  PaymentMethod,
  SaleType,
  VideoCallPlan,
  MimoGiftTier,
} from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';
import { resolveVideoCallPlans } from '../lib/videoCalls';
import { resolveMimoSectionConfig } from '../lib/mimoGifts';
import { buildWhatsappReceiptUrl } from '../lib/whatsapp';
import { PixQrCard } from './PixQrCard';
import { ProtectedImage, ProtectedVideo } from './ProtectedMedia';
import { FanAccountPanel } from './FanAccountPanel';
import { LoyaltyBadge } from './LoyaltyBadge';

const CREATOR_LIVE_CALL_PHOTO = '/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';

interface MediaModalProps {
  isOpen: boolean;
  mode: 'media' | 'vip' | 'tip' | 'fan_login' | 'fan_account' | 'video_call';
  mediaItem: MediaItem | null;
  videoCallPlan?: VideoCallPlan | null;
  tipPresetAmount?: number;
  profile: CreatorProfile;
  fan: FanAccount | null;
  supabaseConnected: boolean;
  onClose: () => void;
  onFanAuthenticated: (email: string) => Promise<void>;
  onPurchaseSuccess: (email: string) => Promise<void>;
  onOpenFanAccount?: () => void;
  onOpenVipModal?: () => void;
  onOpenTipModal?: () => void;
  onLogoutFan?: () => void;
  onGoToSupabaseSetup: () => void;
  onGoToProfileSetup?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (mediaId: string) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  mode,
  mediaItem,
  videoCallPlan,
  tipPresetAmount,
  profile,
  fan,
  supabaseConnected,
  onClose,
  onFanAuthenticated,
  onPurchaseSuccess,
  onOpenFanAccount,
  onOpenVipModal,
  onOpenTipModal,
  onLogoutFan,
  onGoToSupabaseSetup,
  onGoToProfileSetup,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [email, setEmail] = useState(fan?.email || '');
  const [name, setName] = useState(fan?.display_name || '');
  const [contactInfo, setContactInfo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [ageConfirmed, setAgeConfirmed] = useState(true);
  const [tipAmount, setTipAmount] = useState('50');
  const [tipNote, setTipNote] = useState('');
  const [selectedCallPlanId, setSelectedCallPlanId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastOrderRef, setLastOrderRef] = useState<string>('');
  const [checkoutLoyalty, setCheckoutLoyalty] = useState<FanLoyaltySummary | null>(null);
  const [showMissingWaNotice, setShowMissingWaNotice] = useState(false);

  const activeCallPlans = resolveVideoCallPlans(profile.video_call_plans).filter((p) => p.active);
  const currentCallPlan =
    activeCallPlans.find((p) => p.id === selectedCallPlanId) ||
    videoCallPlan ||
    activeCallPlans[0] ||
    null;

  useEffect(() => {
    if (fan?.email) setEmail(fan.email);
    if (fan?.display_name) setName(fan.display_name);
    if (videoCallPlan?.id) {
      setSelectedCallPlanId(videoCallPlan.id);
    } else if (activeCallPlans[0]?.id) {
      setSelectedCallPlanId((prev) => prev || activeCallPlans[0].id);
    }
    if (mode === 'tip') {
      setTipAmount(String(tipPresetAmount && tipPresetAmount >= 5 ? tipPresetAmount : 50));
      setTipNote('');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setLastOrderRef('');
    setCheckoutLoyalty(null);
    setShowMissingWaNotice(false);
  }, [isOpen, mode, mediaItem?.id, videoCallPlan?.id, tipPresetAmount, fan?.email, fan?.display_name]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (mode === 'media' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, mode, onClose]);

  const isMediaUnlocked = Boolean(mediaItem?.is_unlocked);

  const handleFanLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!supabaseConnected) {
      setErrorMsg('Conecte seu projeto Supabase no Estúdio antes de entrar com uma conta de fã.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch('/api/fan/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: name, ageConfirmed18: ageConfirmed }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Erro ao acessar conta.');
      } else {
        await onFanAuthenticated(data.fan.email);
        setSuccessMsg('Conta sincronizada com sucesso.');
        setTimeout(() => {
          if (onOpenFanAccount) {
            onOpenFanAccount();
          } else {
            onClose();
          }
        }, 550);
      }
    } catch {
      setErrorMsg('Erro de conexão ao verificar conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (saleType: SaleType, amountBrl: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!supabaseConnected) {
      setErrorMsg('Banco de vendas ainda não conectado. Configure o Supabase no Estúdio da Criadora.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Informe um e-mail válido para vincular seu acesso.');
      return;
    }
    if (saleType === 'video_call' && !currentCallPlan) {
      setErrorMsg('Selecione um plano de vídeo chamada válido.');
      return;
    }
    if (!ageConfirmed) {
      setErrorMsg('É obrigatório declarar ser maior de 18 anos.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerEmail: email.trim(),
          buyerName: name.trim(),
          contactInfo:
            saleType === 'video_call'
              ? contactInfo.trim()
              : saleType === 'tip' && tipNote.trim()
              ? `Recado: ${tipNote.trim()}`
              : undefined,
          saleType,
          mediaId: saleType === 'ppv' ? mediaItem?.id : undefined,
          videoCallPlanId: saleType === 'video_call' ? currentCallPlan?.id : undefined,
          amountBrl,
          paymentMethod,
          ageConfirmed18: ageConfirmed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Não foi possível concluir o pagamento.');
      } else {
        const orderRef = data.sale?.external_ref ? String(data.sale.external_ref) : '';
        setLastOrderRef(orderRef);
        if (data.loyalty) {
          setCheckoutLoyalty(data.loyalty as FanLoyaltySummary);
        }
        const refLabel = orderRef ? ` (Pedido ${orderRef})` : '';
        setSuccessMsg(
          saleType === 'vip_subscription'
            ? 'Assinatura VIP ativada! Acesso liberado em todo o acervo VIP.'
            : saleType === 'video_call'
            ? `Reserva de Vídeo Chamada (${currentCallPlan?.duration_minutes} min) confirmada${refLabel}! A criadora entrará em contato pelo e-mail/contato informado.`
            : saleType === 'ppv'
            ? 'Compra confirmada! Conteúdo desbloqueado abaixo.'
            : 'Mimo registrado com sucesso. Obrigado pelo apoio!'
        );
        await onPurchaseSuccess(email.trim());
      }
    } catch {
      setErrorMsg('Erro de rede ao processar compra.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderLoyaltyFeedbackBanner = () => {
    if (!checkoutLoyalty) return null;
    return (
      <div className="rounded-sm border border-[#E5C158]/45 bg-[#1C1918] p-3.5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LoyaltyBadge loyalty={checkoutLoyalty} size="xs" />
            <span className="font-semibold text-[#F4F1ED]">
              {checkoutLoyalty.is_gold_vip
                ? 'Você conquistou o badge Fã VIP Ouro!'
                : `Nível de Lealdade · ${checkoutLoyalty.progress_percent}%`}
            </span>
          </div>
          {onOpenFanAccount && (
            <button
              type="button"
              onClick={onOpenFanAccount}
              className="text-[11px] font-semibold uppercase tracking-wider text-[#E5C158] hover:underline cursor-pointer"
            >
              Ver Painel da Conta →
            </button>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-sm bg-[#12100F] border border-[#342F2C]">
          <div
            className="h-full bg-gradient-to-r from-[#8A611C] via-[#E5C158] to-[#FFF0B3] transition-all duration-500"
            style={{ width: `${checkoutLoyalty.progress_percent}%` }}
          />
        </div>
        <p className="text-[11px] text-[#C7C1BA]">
          {checkoutLoyalty.is_gold_vip
            ? 'Seu perfil agora exibe o selo exclusivo Fã VIP Ouro.'
            : `Falta${checkoutLoyalty.remaining_for_gold === 1 ? '' : 'm'} ${checkoutLoyalty.remaining_for_gold} compra${checkoutLoyalty.remaining_for_gold === 1 ? '' : 's'} para o badge Fã VIP Ouro.`}
        </p>
      </div>
    );
  };

  const renderWhatsappReceiptCta = (itemLabel: string, amountBrl: number) => {
    const waUrl = buildWhatsappReceiptUrl(profile.whatsapp_number, {
      creatorName: profile.display_name,
      itemLabel,
      amountBrl,
      paymentMethod,
      buyerEmail: email.trim() || undefined,
      orderRef: lastOrderRef || undefined,
      isReceipt: true,
    });

    return (
      <div className="rounded-sm border border-emerald-700/50 bg-emerald-950/25 p-3.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs text-[#DED9D3]">
            <p className="font-semibold text-emerald-200">Já efetuou o pagamento?</p>
            <p className="text-[11px] text-zinc-400">
              Envie o comprovante direto no WhatsApp de {profile.display_name} para agilizar a confirmação.
            </p>
          </div>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Enviar Comprovante
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowMissingWaNotice(true)}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-600/60 bg-emerald-950/60 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Enviar Comprovante
            </button>
          )}
        </div>
        {showMissingWaNotice && !waUrl && (
          <div className="text-[11px] text-amber-200/90 border-t border-emerald-800/40 pt-2 flex flex-wrap items-center justify-between gap-2">
            <span>WhatsApp da criadora ainda não cadastrado para envio direto.</span>
            {onGoToProfileSetup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToProfileSetup();
                }}
                className="underline font-medium text-[#E5C158] cursor-pointer"
              >
                Cadastrar WhatsApp no Admin →
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="media-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1918]/85 backdrop-blur-sm p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            key="media-modal-dialog"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl max-h-[94dvh] overflow-y-auto rounded-sm border border-[#453F3B] bg-[#23201E] text-[#F4F1ED] shadow-2xl"
          >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela"
          className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20 flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-sm border border-[#453F3B] bg-[#1C1918]/95 text-[#DED9D3] hover:text-[#F4F1ED] hover:border-[#E5C158] transition-colors shadow-lg cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* MODE: FAN ACCOUNT & LOYALTY PANEL */}
        {mode === 'fan_account' && fan && (
          <FanAccountPanel
            fan={fan}
            profile={profile}
            onOpenVipModal={() => {
              if (onOpenVipModal) onOpenVipModal();
            }}
            onOpenTipModal={() => {
              if (onOpenTipModal) onOpenTipModal();
            }}
            onLogoutFan={() => {
              if (onLogoutFan) onLogoutFan();
            }}
            onClose={onClose}
          />
        )}

        {/* MODE: FAN LOGIN */}
        {mode === 'fan_login' && (
          <div className="p-5 sm:p-8 max-w-lg mx-auto">
            <p className="text-xs font-medium text-[#D4AF37] mb-2">Área do Assinante +18</p>
            <h2 className="font-display text-2xl font-semibold text-zinc-50 mb-2">
              Acessar minhas compras e Nível de Lealdade
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Digite o e-mail utilizado nas suas compras para restaurar sua assinatura VIP, conteúdos avulsos e acompanhar seu progresso para o badge <strong className="text-[#E5C158]">Fã VIP Ouro</strong>.
            </p>
            <form onSubmit={handleFanLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu e-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nome ou apelido (opcional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como prefere ser identificado"
                  className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <label className="flex items-start gap-3 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                />
                <span>Declaro ter 18 anos ou mais e concordo com os termos de conteúdo adulto privado.</span>
              </label>
              {errorMsg && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                  {successMsg}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#E5C158] px-5 py-2.5 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? 'Verificando no Supabase...' : 'Entrar e Abrir Minha Conta'}
              </button>
            </form>
          </div>
        )}

        {/* MODE: MEDIA VIEWER & PPV/VIP UNLOCK */}
        {mode === 'media' && mediaItem && (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Media Viewport */}
            <div
              onContextMenu={(e) => e.preventDefault()}
              className="lg:col-span-7 bg-black flex items-center justify-center min-h-[250px] sm:min-h-[340px] lg:min-h-[500px] relative border-b lg:border-b-0 lg:border-r border-[#453F3B] media-shield"
            >
              {isMediaUnlocked && mediaItem.media_url ? (
                mediaItem.media_type === 'video' ? (
                  <ProtectedVideo
                    src={mediaItem.media_url}
                    title={mediaItem.title}
                    controls
                    containerClassName="relative w-full h-full min-h-[250px] sm:min-h-[340px] lg:min-h-[500px] flex items-center justify-center bg-black"
                    className="max-h-[65dvh] sm:max-h-[75vh] w-full object-contain bg-black"
                  />
                ) : (
                  <ProtectedImage
                    src={mediaItem.media_url}
                    alt={mediaItem.title}
                    containerClassName="relative w-full h-full flex items-center justify-center bg-black"
                    className="max-h-[65dvh] sm:max-h-[75vh] w-full object-contain"
                  />
                )
              ) : (
                <div className="relative w-full h-full min-h-[260px] sm:min-h-[360px] flex flex-col items-center justify-center p-6 sm:p-8 text-center overflow-hidden">
                  {mediaItem.preview_url && (
                    <ProtectedImage
                      src={mediaItem.preview_url}
                      alt={mediaItem.title}
                      blurred
                      containerClassName="absolute inset-0 h-full w-full"
                      className="h-full w-full object-cover opacity-35 scale-110"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center max-w-sm">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#453F3B] bg-[#1C1918]/90 text-[#D4AF37]">
                      {mediaItem.media_type === 'video' ? <Play className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                    </div>
                    <p className="font-display text-xl font-semibold text-zinc-50 mb-2">
                      {mediaItem.access_tier === 'vip' ? 'Conteúdo Exclusivo do Clube VIP' : 'Mídia Avulsa Protegida'}
                    </p>
                    <p className="text-sm text-zinc-300">
                      {mediaItem.access_tier === 'vip'
                        ? `Assine o Clube VIP por ${formatBrl(profile.vip_monthly_price_brl)}/mês para assistir e visualizar sem restrições.`
                        : `Desbloqueie este ${mediaItem.media_type === 'video' ? 'vídeo' : 'ensaio'} avulso por ${formatBrl(mediaItem.price_brl)}.`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Info & Checkout Sidebar */}
            <div className="lg:col-span-5 p-5 sm:p-6 lg:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    {mediaItem.media_type === 'video' ? (
                      <Film className="h-3.5 w-3.5 text-[#D4AF37]" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-[#D4AF37]" />
                    )}
                    {mediaItem.media_type === 'video' ? 'Vídeo' : 'Foto'}
                  </span>
                  {mediaItem.duration_seconds ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatDuration(mediaItem.duration_seconds)}</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{mediaItem.collection_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDateShort(mediaItem.created_at)}</span>
                </div>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="font-display text-2xl font-semibold text-zinc-50">
                    {mediaItem.title}
                  </h2>
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(mediaItem.id)}
                      aria-pressed={isFavorite}
                      aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                        isFavorite
                          ? 'border-rose-400/70 bg-rose-950/40 text-rose-300'
                          : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-[#E5C158] hover:text-[#E5C158]'
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                      <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
                    </button>
                  )}
                </div>

                {mediaItem.description && (
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">{mediaItem.description}</p>
                )}

                {isMediaUnlocked ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-200 flex items-center gap-3">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>Acesso liberado na sua conta. Aproveite o conteúdo em alta definição.</span>
                    </div>
                    {renderLoyaltyFeedbackBanner()}
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-[#453F3B] pt-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-zinc-300">
                        {mediaItem.access_tier === 'vip' ? 'Assinatura Mensal VIP' : 'Desbloqueio Avulso (PPV)'}
                      </span>
                      <span className="font-mono text-xl font-semibold text-[#E5C158] tabular-nums">
                        {mediaItem.access_tier === 'vip'
                          ? formatBrl(profile.vip_monthly_price_brl)
                          : formatBrl(mediaItem.price_brl)}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">E-mail do comprador</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'pix'
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                            : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        <QrCode className="h-4 w-4" />
                        Pix Instantâneo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'card'
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                            : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Cartão
                      </button>
                    </div>

                    {paymentMethod === 'pix' && profile.pix_key && (
                      <PixQrCard
                        compact
                        pixKey={profile.pix_key}
                        merchantName={profile.display_name}
                        merchantCity={profile.location}
                        amountBrl={
                          mediaItem.access_tier === 'vip' ? profile.vip_monthly_price_brl : mediaItem.price_brl
                        }
                        txid={`MP${mediaItem.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`}
                        description={mediaItem.access_tier === 'vip' ? 'Clube VIP' : mediaItem.title}
                      />
                    )}

                    <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ageConfirmed}
                        onChange={(e) => setAgeConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                      />
                      <span>Confirmo ter 18 anos ou mais e estar ciente de que este conteúdo é estritamente privado.</span>
                    </label>

                    {errorMsg && (
                      <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 space-y-2">
                        <p>{errorMsg}</p>
                        {!supabaseConnected && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onGoToSupabaseSetup();
                            }}
                            className="underline font-medium text-[#E5C158] cursor-pointer"
                          >
                            Ir para Conexão Supabase →
                          </button>
                        )}
                      </div>
                    )}

                    {successMsg && (
                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                        {successMsg}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        handleCheckout(
                          mediaItem.access_tier === 'vip' ? 'vip_subscription' : 'ppv',
                          mediaItem.access_tier === 'vip' ? profile.vip_monthly_price_brl : mediaItem.price_brl
                        )
                      }
                      className="w-full rounded-lg bg-[#E5C158] px-5 py-3 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {submitting
                        ? 'Registrando no Banco de Vendas...'
                        : mediaItem.access_tier === 'vip'
                        ? `Assinar Clube VIP (${formatBrl(profile.vip_monthly_price_brl)})`
                        : `Desbloquear por ${formatBrl(mediaItem.price_brl)}`}
                    </button>

                    {renderWhatsappReceiptCta(
                      mediaItem.access_tier === 'vip' ? 'Assinatura Clube VIP' : mediaItem.title,
                      mediaItem.access_tier === 'vip' ? profile.vip_monthly_price_brl : mediaItem.price_brl
                    )}
                  </div>
                )}
              </div>

              <p className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
                <ShieldAlert className="h-4 w-4 text-zinc-400 shrink-0" />
                <span>Conteúdo exclusivo de {profile.display_name} (+18). Protegido por acesso assinado.</span>
              </p>
            </div>
          </div>
        )}

        {/* MODE: VIP SUBSCRIPTION */}
        {mode === 'vip' && (
          <div className="p-5 sm:p-8 max-w-xl mx-auto">
            <p className="text-xs font-medium text-[#D4AF37] mb-2">Acesso Total Mensal</p>
            <h2 className="font-display text-2xl font-semibold text-zinc-50 mb-2">
              Clube VIP — {profile.display_name}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">{profile.vip_description}</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-[#453F3B] bg-[#1C1918]/70 px-4 py-3.5">
                <span className="text-sm text-zinc-300">Plano Mensal VIP (30 dias)</span>
                <span className="font-mono text-xl font-semibold text-[#E5C158] tabular-nums">
                  {formatBrl(profile.vip_monthly_price_brl)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu e-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu nome (opcional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome no recibo"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  Pix Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Cartão de Crédito
                </button>
              </div>

              {paymentMethod === 'pix' && profile.pix_key && (
                <PixQrCard
                  compact
                  pixKey={profile.pix_key}
                  merchantName={profile.display_name}
                  merchantCity={profile.location}
                  amountBrl={profile.vip_monthly_price_brl}
                  txid="MPVIP30DIAS"
                  description="Assinatura VIP"
                />
              )}

              <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                />
                <span>Declaro ter 18 anos ou mais e aceito os termos de acesso ao conteúdo adulto exclusivo.</span>
              </label>

              {errorMsg && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 space-y-2">
                  <p>{errorMsg}</p>
                  {!supabaseConnected && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToSupabaseSetup();
                      }}
                      className="underline font-medium text-[#E5C158] cursor-pointer"
                    >
                      Conectar Supabase agora →
                    </button>
                  )}
                </div>
              )}

              {successMsg && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                    {successMsg}
                  </div>
                  {renderLoyaltyFeedbackBanner()}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCheckout('vip_subscription', profile.vip_monthly_price_brl)}
                className="w-full rounded-lg bg-[#E5C158] px-5 py-3 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Confirmando no Supabase...'
                  : `Confirmar Assinatura VIP (${formatBrl(profile.vip_monthly_price_brl)})`}
              </button>

              {renderWhatsappReceiptCta('Assinatura Clube VIP (30 dias)', profile.vip_monthly_price_brl)}
            </div>
          </div>
        )}

        {/* MODE: ELABORATE LUXURY MIMO / TIP CONCIERGE */}
        {mode === 'tip' && (() => {
          const mimoConfig = resolveMimoSectionConfig(profile.mimo_config);
          const activeTiers = mimoConfig.tiers.filter((t) => t.active);
          const displayTiers = activeTiers.length > 0 ? activeTiers : mimoConfig.tiers;
          const parsedAmount = Number(tipAmount || 0);
          const matchedTier: MimoGiftTier | undefined = displayTiers.find(
            (t) => Number(t.amount_brl) === parsedAmount
          );
          const renderSmallIcon = (icon: MimoGiftTier['icon'], active: boolean) => {
            const cls = `h-4 w-4 ${active ? 'text-[#E5C158]' : 'text-[#C7C1BA]'}`;
            if (icon === 'wine') return <Wine className={cls} />;
            if (icon === 'heart') return <Heart className={`${cls} ${active ? 'fill-current' : ''}`} />;
            if (icon === 'sparkles') return <Sparkles className={cls} />;
            return <Crown className={cls} />;
          };

          return (
            <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-5 sm:space-y-6">
              {/* Illuminated Portrait Hero Banner */}
              <div className="relative overflow-hidden rounded-sm border border-[#E5C158]/50 bg-gradient-to-r from-[#1C1918] via-[#2B221E] to-[#1C1918] p-5">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <motion.div
                      aria-hidden="true"
                      animate={{ opacity: [0.45, 1, 0.45] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -inset-1 rounded-sm border border-[#E5C158]"
                    />
                    <div className="h-full w-full overflow-hidden rounded-sm border border-[#E5C158] bg-[#1C1918]">
                      <ProtectedImage
                        src={profile.avatar_url || CREATOR_LIVE_CALL_PHOTO}
                        alt={profile.display_name}
                        containerClassName="h-full w-full"
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#E5C158]">
                      <Gift className="h-3.5 w-3.5" />
                      {mimoConfig.section_kicker}
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#F4F1ED]">
                      {mimoConfig.modal_title}
                    </h2>
                    <p className="text-xs text-[#DED9D3] leading-relaxed">
                      {mimoConfig.modal_description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 6 Editable Luxury Preset Cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F4F1ED]">Selecione um mimo especial</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#E5C158]">
                    Destaque Instantâneo
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {displayTiers.map((tier) => {
                    const isSelected = Number(tipAmount || 0) === tier.amount_brl;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setTipAmount(String(tier.amount_brl))}
                        className={`mimo-card-sheen relative rounded-sm border p-3 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#E5C158] bg-[#2E241F] shadow-[0_0_20px_-6px_rgba(229,193,88,0.5)]'
                            : 'border-[#453F3B] bg-[#1C1918] hover:border-[#E5C158]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          {renderSmallIcon(tier.icon, isSelected)}
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#E5C158]">
                            {tier.featured ? 'Top' : tier.badge.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#F4F1ED] leading-tight line-clamp-1">
                          {tier.title}
                        </p>
                        <p className="font-mono text-base font-bold text-[#E5C158] tabular-nums mt-1">
                          {formatBrl(tier.amount_brl)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount + Recognition Perk Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Ou digite outro valor (R$)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-full rounded-sm border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 font-mono text-base font-semibold text-[#E5C158] focus:border-[#E5C158] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-7 flex flex-col justify-center rounded-sm border border-[#E5C158]/35 bg-[#1C1918]/90 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#E5C158]">
                    {matchedTier ? matchedTier.badge : 'Gesto Personalizado'}
                  </p>
                  <p className="text-xs text-[#DED9D3] mt-0.5 leading-relaxed">
                    {matchedTier
                      ? matchedTier.perk
                      : 'Todo mimo demonstra cavalheirismo e coloca seu nome em evidência para a Carioca.'}
                  </p>
                </div>
              </div>

              {/* Secret Note / Dedication */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Deixe um recado carinhoso ou dedicatória para {profile.display_name} (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={180}
                  value={tipNote}
                  onChange={(e) => setTipNote(e.target.value)}
                  placeholder="Ex: Adorei seu sorriso carioca! Um brinde especial para alegrar seu dia..."
                  className="w-full rounded-sm border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#E5C158] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu e-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-sm border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#E5C158] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu nome ou apelido</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como ela deve te chamar"
                    className="w-full rounded-sm border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#E5C158] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'border-[#E5C158] bg-[#E5C158]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  Pix Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[#E5C158] bg-[#E5C158]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Cartão de Crédito
                </button>
              </div>

              {paymentMethod === 'pix' && profile.pix_key && (
                <PixQrCard
                  compact
                  pixKey={profile.pix_key}
                  merchantName={profile.display_name}
                  merchantCity={profile.location}
                  amountBrl={parsedAmount}
                  txid="MPMIMO"
                  description={matchedTier ? matchedTier.title : 'Mimo Especial'}
                />
              )}

              <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#E5C158]"
                />
                <span>Declaro ter 18 anos ou mais e aceito os termos do atendimento privado.</span>
              </label>

              {errorMsg && (
                <div className="rounded-sm border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 space-y-2">
                  <p>{errorMsg}</p>
                  {!supabaseConnected && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToSupabaseSetup();
                      }}
                      className="underline font-medium text-[#E5C158] cursor-pointer"
                    >
                      Conectar Supabase agora →
                    </button>
                  )}
                </div>
              )}

              {successMsg && (
                <div className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative overflow-hidden rounded-sm border border-[#E5C158] bg-gradient-to-r from-[#2D2419] via-[#3A2B1D] to-[#2D2419] p-4 text-xs text-[#F4F1ED]"
                  >
                    <div className="flex items-start gap-3">
                      <motion.span
                        animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }}
                        transition={{ duration: 0.9, repeat: 2 }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#E5C158] text-[#1C1918]"
                      >
                        <Sparkles className="h-4 w-4" />
                      </motion.span>
                      <div>
                        <p className="font-semibold text-[#E5C158] uppercase tracking-wider text-[11px]">
                          Mimo Registrado Com Brilho!
                        </p>
                        <p className="mt-1 text-[#DED9D3]">{successMsg}</p>
                      </div>
                    </div>
                  </motion.div>
                  {renderLoyaltyFeedbackBanner()}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCheckout('tip', parsedAmount)}
                className="mimo-shimmer-btn group w-full inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-[#FAF8F5] disabled:opacity-50 transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Gift className="h-4 w-4 text-[#E5C158] transition-transform group-hover:rotate-[-10deg]" />
                <span>
                  {submitting
                    ? 'Registrando Mimo Especial...'
                    : `Enviar Mimo Agora (${formatBrl(parsedAmount)})`}
                </span>
              </button>

              {renderWhatsappReceiptCta(
                matchedTier
                  ? `Mimo: ${matchedTier.title}${tipNote.trim() ? ` — "${tipNote.trim()}"` : ''}`
                  : `Mimo Especial${tipNote.trim() ? ` — "${tipNote.trim()}"` : ''}`,
                parsedAmount
              )}
            </div>
          );
        })()}

        {/* MODE: VIDEO CALL CHECKOUT */}
        {mode === 'video_call' && currentCallPlan && (
          <div className="p-5 sm:p-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-12 overflow-hidden rounded-sm border border-[#453F3B] bg-[#1C1918] mb-5">
              <div className="relative sm:col-span-4 h-44 sm:h-40 overflow-hidden bg-[#23201E] border-b sm:border-b-0 sm:border-r border-[#453F3B]">
                <ProtectedImage
                  src={CREATOR_LIVE_CALL_PHOTO}
                  alt={`${profile.display_name} ao vivo exclusivamente para quem comprar a vídeo chamada`}
                  containerClassName="h-full w-full"
                  className="h-full w-full object-cover object-top"
                />
                <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 z-20 h-3 w-3 border-t-2 border-l-2 border-[#E5C158]" />
                <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 z-20 h-3 w-3 border-t-2 border-r-2 border-[#E5C158]" />
                <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 z-20 h-3 w-3 border-b-2 border-l-2 border-[#E5C158]" />
                <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 z-20 h-3 w-3 border-b-2 border-r-2 border-[#E5C158]" />
              </div>

              <div className="sm:col-span-8 p-5 flex flex-col justify-between gap-2 bg-[#1C1918]">
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[#E5C158]">
                  <span className="inline-flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    AO VIVO · EXCLUSIVO DO COMPRADOR
                  </span>
                  <span className="text-[#F4F1ED]/85">SALA 1 A 1</span>
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#F4F1ED] leading-tight">
                    {currentCallPlan.title} — Ao Vivo Com {profile.display_name}
                  </h2>
                  <p className="text-xs text-[#DED9D3] mt-1">
                    Ela entra ao vivo na câmera exclusivamente para você após a confirmação do pagamento.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-[#DED9D3] mb-6">{currentCallPlan.description}</p>

            <div className="space-y-5">
              {/* Plan Selector across all active Video Call tiers */}
              <div>
                <p className="text-xs font-medium text-zinc-300 mb-2">Duração & Valor Selecionado</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeCallPlans.map((plan) => {
                    const selected = plan.id === currentCallPlan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedCallPlanId(plan.id)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                            : 'border-[#453F3B] bg-[#1C1918]/70 hover:border-zinc-600'
                        }`}
                      >
                        <p className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 tabular-nums">
                          <Clock className="h-3 w-3 text-[#D4AF37]" />
                          {plan.duration_minutes} min
                        </p>
                        <p className="font-mono text-sm font-semibold text-[#E5C158] tabular-nums mt-0.5">
                          {formatBrl(plan.price_brl)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu e-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    WhatsApp ou @Telegram (para receber o link)
                  </label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Ex: (11) 99999-9999 ou @usuario"
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu nome (opcional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome para o agendamento"
                  className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  Pix Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                      : 'border-[#453F3B] bg-[#1C1918] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Cartão de Crédito
                </button>
              </div>

              {paymentMethod === 'pix' && profile.pix_key && (
                <PixQrCard
                  compact
                  pixKey={profile.pix_key}
                  merchantName={profile.display_name}
                  merchantCity={profile.location}
                  amountBrl={currentCallPlan.price_brl}
                  txid={`MPVC${currentCallPlan.duration_minutes}MIN`}
                  description={`Video Chamada ${currentCallPlan.duration_minutes}m`}
                />
              )}

              <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                />
                <span>Declaro ter 18 anos ou mais e concordo com os termos de atendimento privado.</span>
              </label>

              {errorMsg && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 space-y-2">
                  <p>{errorMsg}</p>
                  {!supabaseConnected && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToSupabaseSetup();
                      }}
                      className="underline font-medium text-[#E5C158] cursor-pointer"
                    >
                      Conectar Supabase agora →
                    </button>
                  )}
                </div>
              )}

              {successMsg && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                    {successMsg}
                  </div>
                  {renderLoyaltyFeedbackBanner()}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCheckout('video_call', currentCallPlan.price_brl)}
                className="w-full rounded-lg bg-[#E5C158] px-5 py-3 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Confirmando Reserva no Supabase...'
                  : `Confirmar Vídeo Chamada ${currentCallPlan.duration_minutes} min (${formatBrl(currentCallPlan.price_brl)})`}
              </button>

              {renderWhatsappReceiptCta(
                `Vídeo Chamada ${currentCallPlan.duration_minutes} min (${currentCallPlan.title})`,
                currentCallPlan.price_brl
              )}
            </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

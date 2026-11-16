import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Lock, Play, Check, CreditCard, QrCode, ShieldAlert, Image as ImageIcon, Film, Video, Clock, MessageCircle, Heart } from 'lucide-react';
import type { CreatorProfile, FanAccount, MediaItem, PaymentMethod, SaleType, VideoCallPlan } from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';
import { resolveVideoCallPlans } from '../lib/videoCalls';
import { buildWhatsappReceiptUrl } from '../lib/whatsapp';
import { PixQrCard } from './PixQrCard';
import { ProtectedImage, ProtectedVideo } from './ProtectedMedia';

const CREATOR_LIVE_CALL_PHOTO = '/assets/aistudio/Capturarjhjhhjhjh_2c54840b.JPG';

interface MediaModalProps {
  isOpen: boolean;
  mode: 'media' | 'vip' | 'tip' | 'fan_login' | 'video_call';
  mediaItem: MediaItem | null;
  videoCallPlan?: VideoCallPlan | null;
  profile: CreatorProfile;
  fan: FanAccount | null;
  supabaseConnected: boolean;
  onClose: () => void;
  onFanAuthenticated: (email: string) => Promise<void>;
  onPurchaseSuccess: (email: string) => Promise<void>;
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
  profile,
  fan,
  supabaseConnected,
  onClose,
  onFanAuthenticated,
  onPurchaseSuccess,
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
  const [selectedCallPlanId, setSelectedCallPlanId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastOrderRef, setLastOrderRef] = useState<string>('');
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
    setErrorMsg(null);
    setSuccessMsg(null);
    setLastOrderRef('');
    setShowMissingWaNotice(false);
  }, [isOpen, mode, mediaItem?.id, videoCallPlan?.id, fan?.email, fan?.display_name]);

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
        setTimeout(() => onClose(), 700);
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
          contactInfo: saleType === 'video_call' ? contactInfo.trim() : undefined,
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1918]/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            key="media-modal-dialog"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-sm border border-[#453F3B] bg-[#23201E] text-[#F4F1ED] shadow-2xl"
          >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-sm border border-[#453F3B] bg-[#1C1918]/90 text-[#DED9D3] hover:text-[#F4F1ED] hover:border-[#E5C158] transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* MODE: FAN LOGIN */}
        {mode === 'fan_login' && (
          <div className="p-8 max-w-lg mx-auto">
            <p className="text-xs font-medium text-[#D4AF37] mb-2">Área do Assinante +18</p>
            <h2 className="font-display text-2xl font-semibold text-zinc-50 mb-2">
              Acessar minhas compras e VIP
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Digite o e-mail utilizado nas suas compras para restaurar automaticamente sua assinatura VIP e conteúdos avulsos desbloqueados no Supabase.
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
                {submitting ? 'Verificando no Supabase...' : 'Entrar e Sincronizar Acesso'}
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
              className="lg:col-span-7 bg-black flex items-center justify-center min-h-[340px] lg:min-h-[500px] relative border-b lg:border-b-0 lg:border-r border-[#453F3B] media-shield"
            >
              {isMediaUnlocked && mediaItem.media_url ? (
                mediaItem.media_type === 'video' ? (
                  <ProtectedVideo
                    src={mediaItem.media_url}
                    title={mediaItem.title}
                    controls
                    containerClassName="relative w-full h-full min-h-[340px] lg:min-h-[500px] flex items-center justify-center bg-black"
                    className="max-h-[75vh] w-full object-contain bg-black"
                  />
                ) : (
                  <ProtectedImage
                    src={mediaItem.media_url}
                    alt={mediaItem.title}
                    containerClassName="relative w-full h-full flex items-center justify-center bg-black"
                    className="max-h-[75vh] w-full object-contain"
                  />
                )
              ) : (
                <div className="relative w-full h-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
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
            <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col justify-between">
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
                  <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-200 flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Acesso liberado na sua conta. Aproveite o conteúdo em alta definição.</span>
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

        {/* MODE: VIP SUBSCRIPTION OR TIP */}
        {(mode === 'vip' || mode === 'tip') && (
          <div className="p-8 max-w-xl mx-auto">
            <p className="text-xs font-medium text-[#D4AF37] mb-2">
              {mode === 'vip' ? 'Acesso Total Mensal' : 'Apoio Direto à Criadora'}
            </p>
            <h2 className="font-display text-2xl font-semibold text-zinc-50 mb-2">
              {mode === 'vip'
                ? `Clube VIP — ${profile.display_name}`
                : `Enviar Mimo para ${profile.display_name}`}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              {mode === 'vip'
                ? profile.vip_description
                : 'Envie um agradecimento direto registrado no banco de vendas da criadora.'}
            </p>

            <div className="space-y-4">
              {mode === 'vip' ? (
                <div className="flex items-center justify-between rounded-lg border border-[#453F3B] bg-[#1C1918]/70 px-4 py-3.5">
                  <span className="text-sm text-zinc-300">Plano Mensal VIP (30 dias)</span>
                  <span className="font-mono text-xl font-semibold text-[#E5C158] tabular-nums">
                    {formatBrl(profile.vip_monthly_price_brl)}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Valor do mimo (R$)</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-full rounded-lg border border-[#453F3B] bg-[#1C1918] px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              )}

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
                  amountBrl={mode === 'vip' ? profile.vip_monthly_price_brl : Number(tipAmount || 0)}
                  txid={mode === 'vip' ? 'MPVIP30DIAS' : 'MPMIMO'}
                  description={mode === 'vip' ? 'Assinatura VIP' : 'Mimo Direto'}
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
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                  {successMsg}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  handleCheckout(
                    mode === 'vip' ? 'vip_subscription' : 'tip',
                    mode === 'vip' ? profile.vip_monthly_price_brl : Number(tipAmount || 0)
                  )
                }
                className="w-full rounded-lg bg-[#E5C158] px-5 py-3 text-sm font-semibold text-[#1C1918] hover:bg-[#f0cf6b] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Confirmando no Supabase...'
                  : mode === 'vip'
                  ? `Confirmar Assinatura VIP (${formatBrl(profile.vip_monthly_price_brl)})`
                  : `Enviar Mimo (${formatBrl(Number(tipAmount || 0))})`}
              </button>

              {renderWhatsappReceiptCta(
                mode === 'vip' ? 'Assinatura Clube VIP (30 dias)' : 'Mimo Direto',
                mode === 'vip' ? profile.vip_monthly_price_brl : Number(tipAmount || 0)
              )}
            </div>
          </div>
        )}

        {/* MODE: VIDEO CALL CHECKOUT */}
        {mode === 'video_call' && currentCallPlan && (
          <div className="p-8 max-w-2xl mx-auto">
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
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                  {successMsg}
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

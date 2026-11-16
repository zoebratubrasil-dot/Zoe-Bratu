import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Lock, Play, Check, CreditCard, QrCode, ShieldAlert, Image as ImageIcon, Film } from 'lucide-react';
import type { CreatorProfile, FanAccount, MediaItem, PaymentMethod, SaleType } from '../types';
import { formatBrl, formatDuration, formatDateShort } from '../lib/format';

interface MediaModalProps {
  isOpen: boolean;
  mode: 'media' | 'vip' | 'tip' | 'fan_login';
  mediaItem: MediaItem | null;
  profile: CreatorProfile;
  fan: FanAccount | null;
  supabaseConnected: boolean;
  onClose: () => void;
  onFanAuthenticated: (email: string) => Promise<void>;
  onPurchaseSuccess: (email: string) => Promise<void>;
  onGoToSupabaseSetup: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  mode,
  mediaItem,
  profile,
  fan,
  supabaseConnected,
  onClose,
  onFanAuthenticated,
  onPurchaseSuccess,
  onGoToSupabaseSetup,
}) => {
  const [email, setEmail] = useState(fan?.email || '');
  const [name, setName] = useState(fan?.display_name || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [ageConfirmed, setAgeConfirmed] = useState(true);
  const [tipAmount, setTipAmount] = useState('50');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (fan?.email) setEmail(fan.email);
    if (fan?.display_name) setName(fan.display_name);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, mode, mediaItem?.id, fan?.email, fan?.display_name]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
          saleType,
          mediaId: saleType === 'ppv' ? mediaItem?.id : undefined,
          amountBrl,
          paymentMethod,
          ageConfirmed18: ageConfirmed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Não foi possível concluir o pagamento.');
      } else {
        setSuccessMsg(
          saleType === 'vip_subscription'
            ? 'Assinatura VIP ativada! Acesso liberado em todo o acervo VIP.'
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="media-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            key="media-modal-dialog"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-zinc-800 bg-[#121215] text-zinc-100 shadow-2xl"
          >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/90 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nome ou apelido (opcional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como prefere ser identificado"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
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
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
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
            <div className="lg:col-span-7 bg-black flex items-center justify-center min-h-[340px] lg:min-h-[500px] relative border-b lg:border-b-0 lg:border-r border-zinc-800">
              {isMediaUnlocked && mediaItem.media_url ? (
                mediaItem.media_type === 'video' ? (
                  <video
                    src={mediaItem.media_url}
                    controls
                    playsInline
                    controlsList="nodownload"
                    className="max-h-[75vh] w-full object-contain bg-black"
                  />
                ) : (
                  <img
                    src={mediaItem.media_url}
                    alt={mediaItem.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[75vh] w-full object-contain"
                  />
                )
              ) : (
                <div className="relative w-full h-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
                  {mediaItem.preview_url && (
                    <img
                      src={mediaItem.preview_url}
                      alt={mediaItem.title}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-35 scale-110"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center max-w-sm">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-[#D4AF37]">
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

                <h2 className="font-display text-2xl font-semibold text-zinc-50 mb-3">
                  {mediaItem.title}
                </h2>

                {mediaItem.description && (
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">{mediaItem.description}</p>
                )}

                {isMediaUnlocked ? (
                  <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-200 flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Acesso liberado na sua conta. Aproveite o conteúdo em alta definição.</span>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-zinc-800 pt-5">
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
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'pix'
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#E5C158]'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
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
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Cartão
                      </button>
                    </div>

                    {paymentMethod === 'pix' && profile.pix_key && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
                        <span className="text-zinc-400">Chave Pix da criadora: </span>
                        <span className="font-mono text-zinc-100 select-all">{profile.pix_key}</span>
                      </div>
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
                      className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {submitting
                        ? 'Registrando no Banco de Vendas...'
                        : mediaItem.access_tier === 'vip'
                        ? `Assinar Clube VIP (${formatBrl(profile.vip_monthly_price_brl)})`
                        : `Desbloquear por ${formatBrl(mediaItem.price_brl)}`}
                    </button>
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
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3.5">
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
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
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
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Seu nome (opcional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome no recibo"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
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
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
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
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Cartão de Crédito
                </button>
              </div>

              {paymentMethod === 'pix' && profile.pix_key && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
                  <span className="text-zinc-400">Chave Pix configurada: </span>
                  <span className="font-mono text-zinc-100 select-all">{profile.pix_key}</span>
                </div>
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
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Confirmando no Supabase...'
                  : mode === 'vip'
                  ? `Confirmar Assinatura VIP (${formatBrl(profile.vip_monthly_price_brl)})`
                  : `Enviar Mimo (${formatBrl(Number(tipAmount || 0))})`}
              </button>
            </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

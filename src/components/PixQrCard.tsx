import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, CheckCircle2, QrCode, ShieldCheck } from 'lucide-react';
import { buildPixBrCodePayload, detectPixKeyType } from '../lib/pixBrCode';
import { formatBrl } from '../lib/format';

interface PixQrCardProps {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amountBrl?: number;
  txid?: string;
  description?: string;
  compact?: boolean;
  theme?: 'dark' | 'light';
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand when Clipboard API is restricted (e.g. embedded iframe)
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const PixQrCard: React.FC<PixQrCardProps> = ({
  pixKey,
  merchantName,
  merchantCity,
  amountBrl,
  txid,
  description,
  compact = false,
  theme = 'dark',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const keyTimerRef = useRef<number | null>(null);
  const codeTimerRef = useRef<number | null>(null);

  const brCode = useMemo(
    () =>
      buildPixBrCodePayload({
        pixKey,
        merchantName,
        merchantCity,
        amountBrl,
        txid,
        description,
      }),
    [pixKey, merchantName, merchantCity, amountBrl, txid, description]
  );

  useEffect(() => {
    let active = true;
    if (!brCode) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(brCode, {
      width: compact ? 220 : 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#09090B',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [brCode, compact]);

  useEffect(() => {
    return () => {
      if (keyTimerRef.current) window.clearTimeout(keyTimerRef.current);
      if (codeTimerRef.current) window.clearTimeout(codeTimerRef.current);
    };
  }, []);

  const handleCopyCode = async () => {
    if (!brCode) return;
    const ok = await copyTextToClipboard(brCode);
    if (!ok) return;
    setCopiedCode(true);
    if (codeTimerRef.current) window.clearTimeout(codeTimerRef.current);
    codeTimerRef.current = window.setTimeout(() => setCopiedCode(false), 2400);
  };

  const handleCopyKey = async () => {
    const cleanKey = pixKey.trim();
    if (!cleanKey) return;
    const ok = await copyTextToClipboard(cleanKey);
    if (!ok) return;
    setCopiedKey(true);
    if (keyTimerRef.current) window.clearTimeout(keyTimerRef.current);
    keyTimerRef.current = window.setTimeout(() => setCopiedKey(false), 2400);
  };

  const isLight = theme === 'light';

  if (!pixKey.trim()) {
    return (
      <div
        className={`rounded-sm border border-dashed p-6 text-center space-y-2 ${
          isLight
            ? 'border-[#181615]/30 bg-[#F3EFEA] text-[#181615]'
            : 'border-[#4A433F] bg-[#1C1918]'
        }`}
      >
        <div
          className={`mx-auto flex h-10 w-10 items-center justify-center rounded-sm border ${
            isLight
              ? 'border-[#181615]/20 bg-white text-[#524B45]'
              : 'border-[#453F3B] bg-[#2B2725] text-[#C7C1BA]'
          }`}
        >
          <QrCode className="h-5 w-5" />
        </div>
        <p className={`text-sm font-medium ${isLight ? 'text-[#181615]' : 'text-[#F4F1ED]'}`}>
          Nenhuma chave PIX cadastrada
        </p>
        <p className={`text-xs ${isLight ? 'text-[#524B45]' : 'text-[#C7C1BA]'}`}>
          Cadastre sua chave PIX (CPF, CNPJ, E-mail, Telefone ou EVP) para gerar o QR Code de pagamento.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-sm border p-4 sm:p-5 space-y-4 ${
        isLight
          ? 'border-[#181615]/20 bg-[#F3EFEA] text-[#181615]'
          : 'border-[#453F3B] bg-[#1C1918]'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div
          className={`rounded-sm bg-white p-2.5 shrink-0 border ${
            isLight ? 'border-[#181615]/20' : 'border-[#453F3B]'
          }`}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code Pix para pagamento instantâneo"
              loading="lazy"
              decoding="async"
              className={compact ? 'h-36 w-36' : 'h-44 w-44'}
            />
          ) : (
            <div className={`${compact ? 'h-36 w-36' : 'h-44 w-44'} flex items-center justify-center text-xs text-zinc-500`}>
              Gerando QR...
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full space-y-3">
          <div
            className={`flex items-baseline justify-between gap-2 border-b pb-2.5 ${
              isLight ? 'border-[#181615]/15' : 'border-[#453F3B]'
            }`}
          >
            <span className={`text-xs ${isLight ? 'text-[#524B45]' : 'text-[#C7C1BA]'}`}>
              Valor da transação
            </span>
            <span
              className={`font-mono text-lg font-semibold tabular-nums ${
                isLight ? 'text-[#181615]' : 'text-[#E5C158]'
              }`}
            >
              {typeof amountBrl === 'number' && amountBrl > 0 ? formatBrl(amountBrl) : 'Valor em aberto'}
            </span>
          </div>

          {/* Click-to-copy Interactive Pix Key Box with Animated Verified Feedback */}
          <motion.button
            type="button"
            onClick={handleCopyKey}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            aria-label={`Copiar chave Pix ${pixKey}`}
            className={`group relative w-full overflow-hidden rounded-sm border px-3 py-2.5 text-left transition-colors duration-200 cursor-pointer ${
              copiedKey
                ? isLight
                  ? 'border-emerald-600 bg-emerald-50 shadow-[0_0_0_1px_rgba(5,150,105,0.2)]'
                  : 'border-emerald-500/80 bg-emerald-950/35 shadow-[0_0_18px_-6px_rgba(16,185,129,0.55)]'
                : isLight
                ? 'border-[#181615]/20 bg-white hover:border-[#181615]/60'
                : 'border-[#453F3B] bg-[#23201E] hover:border-[#E5C158]/80'
            }`}
          >
            {/* Subtle highlight sweep on successful copy */}
            <AnimatePresence>
              {copiedKey && (
                <motion.span
                  aria-hidden="true"
                  initial={{ x: '-100%', opacity: 0.55 }}
                  animate={{ x: '130%', opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
                />
              )}
            </AnimatePresence>

            <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] mb-1">
              <span
                className={`font-medium ${
                  copiedKey
                    ? isLight
                      ? 'text-emerald-800'
                      : 'text-emerald-300'
                    : isLight
                    ? 'text-[#524B45]'
                    : 'text-[#C7C1BA]'
                }`}
              >
                Chave ({detectPixKeyType(pixKey)})
              </span>

              <span aria-live="polite" className="inline-flex items-center">
                <AnimatePresence mode="wait" initial={false}>
                  {copiedKey ? (
                    <motion.span
                      key="copied-key"
                      initial={{ opacity: 0, scale: 0.72, y: 2 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: -2 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isLight ? 'text-emerald-700' : 'text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Copiada!</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy-key"
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ duration: 0.15 }}
                      className={`inline-flex items-center gap-1 font-medium transition-colors ${
                        isLight
                          ? 'text-[#524B45] group-hover:text-[#181615]'
                          : 'text-[#E5C158]/90 group-hover:text-[#E5C158]'
                      }`}
                    >
                      <Copy className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                      <span>Clique para copiar</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-2">
              <p
                className={`font-mono text-xs sm:text-[13px] font-medium truncate ${
                  copiedKey
                    ? isLight
                      ? 'text-emerald-950'
                      : 'text-emerald-100'
                    : isLight
                    ? 'text-[#181615]'
                    : 'text-[#F4F1ED]'
                }`}
              >
                {pixKey}
              </p>
            </div>

            <AnimatePresence>
              {copiedKey && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`relative z-10 overflow-hidden flex items-center gap-1.5 text-[11px] font-medium ${
                    isLight ? 'text-emerald-700' : 'text-emerald-300'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Pronta para colar no aplicativo do seu banco</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {txid && (
            <div
              className={`flex items-center justify-between gap-2 text-xs ${
                isLight ? 'text-[#524B45]' : 'text-[#C7C1BA]'
              }`}
            >
              <span>Referência</span>
              <span className={`font-mono ${isLight ? 'text-[#181615]' : 'text-[#F4F1ED]'}`}>{txid}</span>
            </div>
          )}

          <motion.button
            type="button"
            onClick={handleCopyCode}
            disabled={!brCode}
            whileTap={{ scale: 0.985 }}
            className={`w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-sm px-3.5 py-2 text-xs font-semibold disabled:opacity-50 transition-colors duration-200 cursor-pointer ${
              copiedCode
                ? isLight
                  ? 'bg-emerald-700 text-white border border-emerald-700'
                  : 'border border-emerald-500/80 bg-emerald-950/45 text-emerald-300'
                : isLight
                ? 'bg-[#181615] text-[#FAF8F5] hover:bg-[#332E2C]'
                : 'border border-[#453F3B] bg-[#2B2725] text-[#F4F1ED] hover:border-[#E5C158]'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copiedCode ? (
                <motion.span
                  key="copied-code-state"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                  className="inline-flex items-center gap-2"
                >
                  <CheckCircle2 className={`h-4 w-4 ${isLight ? 'text-emerald-200' : 'text-emerald-400'}`} />
                  <span>Código Pix Copiado com Sucesso!</span>
                </motion.span>
              ) : (
                <motion.span
                  key="copy-code-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-2"
                >
                  <Copy className={`h-3.5 w-3.5 ${isLight ? 'text-[#FAF8F5]' : 'text-[#E5C158]'}`} />
                  <span>Copiar Pix Copia e Cola</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {brCode && (
        <motion.button
          type="button"
          onClick={handleCopyCode}
          whileTap={{ scale: 0.99 }}
          aria-label="Copiar código EMV Pix Copia e Cola"
          className={`w-full text-left rounded-sm border px-3 py-2 transition-colors duration-200 cursor-pointer ${
            copiedCode
              ? isLight
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-emerald-500/70 bg-emerald-950/30'
              : isLight
              ? 'border-[#181615]/15 bg-white hover:border-[#181615]/45'
              : 'border-[#453F3B] bg-[#23201E] hover:border-[#E5C158]/60'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[11px] ${isLight ? 'text-[#524B45]' : 'text-[#9B948D]'}`}>
              Código EMV Pix Copia e Cola
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                copiedCode
                  ? isLight
                    ? 'text-emerald-700'
                    : 'text-emerald-400'
                  : isLight
                  ? 'text-[#524B45]'
                  : 'text-[#E5C158]/80'
              }`}
            >
              {copiedCode ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Tocar para copiar</span>
                </>
              )}
            </span>
          </div>
          <p
            className={`font-mono text-[11px] break-all line-clamp-2 ${
              isLight ? 'text-[#181615]' : 'text-[#DED9D3]'
            }`}
          >
            {brCode}
          </p>
        </motion.button>
      )}
    </div>
  );
};

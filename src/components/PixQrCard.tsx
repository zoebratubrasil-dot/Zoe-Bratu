import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode } from 'lucide-react';
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
}

export const PixQrCard: React.FC<PixQrCardProps> = ({
  pixKey,
  merchantName,
  merchantCity,
  amountBrl,
  txid,
  description,
  compact = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopyCode = async () => {
    if (!brCode) return;
    await navigator.clipboard.writeText(brCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyKey = async () => {
    if (!pixKey.trim()) return;
    await navigator.clipboard.writeText(pixKey.trim());
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  if (!pixKey.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-500">
          <QrCode className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-zinc-200">Nenhuma chave PIX cadastrada</p>
        <p className="text-xs text-zinc-400">
          Cadastre sua chave PIX (CPF, CNPJ, E-mail, Telefone ou EVP) para gerar o QR Code de pagamento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#09090B] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="rounded-lg bg-white p-2.5 shrink-0 border border-zinc-700">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code Pix"
              className={compact ? 'h-36 w-36' : 'h-44 w-44'}
            />
          ) : (
            <div className={`${compact ? 'h-36 w-36' : 'h-44 w-44'} flex items-center justify-center text-xs text-zinc-500`}>
              Gerando QR...
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-zinc-800 pb-2.5">
            <span className="text-xs text-zinc-400">Valor da transação</span>
            <span className="font-mono text-lg font-semibold text-[#E5C158] tabular-nums">
              {typeof amountBrl === 'number' && amountBrl > 0 ? formatBrl(amountBrl) : 'Valor em aberto'}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2 text-zinc-400">
              <span>Chave ({detectPixKeyType(pixKey)})</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="inline-flex items-center gap-1 text-[#E5C158] hover:underline cursor-pointer"
              >
                {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedKey ? 'Copiada' : 'Copiar chave'}
              </button>
            </div>
            <p className="font-mono text-zinc-200 truncate select-all">{pixKey}</p>
          </div>

          {txid && (
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
              <span>Referência</span>
              <span className="font-mono text-zinc-300">{txid}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!brCode}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-100 hover:border-[#D4AF37] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-[#D4AF37]" />}
            {copiedCode ? 'Código Pix Copiado!' : 'Copiar Pix Copia e Cola'}
          </button>
        </div>
      </div>

      {brCode && (
        <div className="rounded-lg border border-zinc-800 bg-[#121215] px-3 py-2">
          <p className="text-[11px] text-zinc-500 mb-1">Código EMV Pix Copia e Cola</p>
          <p className="font-mono text-[11px] text-zinc-300 break-all line-clamp-2 select-all">{brCode}</p>
        </div>
      )}
    </div>
  );
};

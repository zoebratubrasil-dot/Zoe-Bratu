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
      <div className="rounded-sm border border-dashed border-[#4A433F] bg-[#1C1918] p-6 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-sm border border-[#453F3B] bg-[#2B2725] text-[#C7C1BA]">
          <QrCode className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-[#F4F1ED]">Nenhuma chave PIX cadastrada</p>
        <p className="text-xs text-[#C7C1BA]">
          Cadastre sua chave PIX (CPF, CNPJ, E-mail, Telefone ou EVP) para gerar o QR Code de pagamento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[#453F3B] bg-[#1C1918] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="rounded-sm bg-white p-2.5 shrink-0 border border-[#453F3B]">
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
          <div className="flex items-baseline justify-between gap-2 border-b border-[#453F3B] pb-2.5">
            <span className="text-xs text-[#C7C1BA]">Valor da transação</span>
            <span className="font-mono text-lg font-semibold text-[#E5C158] tabular-nums">
              {typeof amountBrl === 'number' && amountBrl > 0 ? formatBrl(amountBrl) : 'Valor em aberto'}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2 text-[#C7C1BA]">
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
            <p className="font-mono text-[#F4F1ED] truncate select-all">{pixKey}</p>
          </div>

          {txid && (
            <div className="flex items-center justify-between gap-2 text-xs text-[#C7C1BA]">
              <span>Referência</span>
              <span className="font-mono text-[#F4F1ED]">{txid}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!brCode}
            className="w-full inline-flex items-center justify-center gap-2 rounded-sm border border-[#453F3B] bg-[#2B2725] px-3.5 py-2 text-xs font-medium text-[#F4F1ED] hover:border-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-[#E5C158]" />}
            {copiedCode ? 'Código Pix Copiado!' : 'Copiar Pix Copia e Cola'}
          </button>
        </div>
      </div>

      {brCode && (
        <div className="rounded-sm border border-[#453F3B] bg-[#23201E] px-3 py-2">
          <p className="text-[11px] text-[#9B948D] mb-1">Código EMV Pix Copia e Cola</p>
          <p className="font-mono text-[11px] text-[#DED9D3] break-all line-clamp-2 select-all">{brCode}</p>
        </div>
      )}
    </div>
  );
};

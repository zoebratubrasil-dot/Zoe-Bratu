export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amountBrl?: number;
  txid?: string;
  description?: string;
}

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function detectPixKeyType(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) return 'Não cadastrada';
  if (key.includes('@')) return 'E-mail';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return 'Chave Aleatória (EVP)';
  }
  const digits = key.replace(/\D/g, '');
  if (digits.length === 14 && !key.startsWith('+')) return 'CNPJ';
  if (digits.length === 11 && !key.startsWith('+')) {
    return 'CPF ou Celular';
  }
  if (key.startsWith('+') || (digits.length >= 10 && digits.length <= 13)) {
    return 'Telefone';
  }
  return 'Chave Pix';
}

export function normalizePixKeyForBrCode(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Keep explicit +E164 phone numbers clean
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  // Formatted phone like (11) 99999-9999 -> +5511999999999
  if (/^\(\d{2}\)/.test(trimmed)) {
    return '+55' + trimmed.replace(/\D/g, '');
  }
  // CPF/CNPJ formatted with dots/slashes -> digits only
  if (/^[\d.\-/]+$/.test(trimmed)) {
    return trimmed.replace(/\D/g, '');
  }
  return trimmed;
}

export function buildPixBrCodePayload({
  pixKey,
  merchantName,
  merchantCity,
  amountBrl,
  txid,
  description,
}: PixPayloadInput): string {
  const cleanKey = normalizePixKeyForBrCode(pixKey);
  if (!cleanKey) return '';

  const cleanName = (stripDiacritics(merchantName) || 'MAISON PRIVE').toUpperCase().slice(0, 25);
  const rawCity = (merchantCity || 'SAO PAULO').split(',')[0] || 'SAO PAULO';
  const cleanCity = (stripDiacritics(rawCity) || 'SAO PAULO').toUpperCase().slice(0, 15);
  const cleanTxid =
    stripDiacritics(txid || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 25) || '***';

  let merchantAccountContent = tlv('00', 'br.gov.bcb.pix') + tlv('01', cleanKey);
  if (description) {
    const cleanDesc = stripDiacritics(description).slice(0, 40);
    if (cleanDesc) {
      merchantAccountContent += tlv('02', cleanDesc);
    }
  }

  const parts: string[] = [
    tlv('00', '01'), // Payload Format Indicator
    tlv('26', merchantAccountContent), // Merchant Account Information - PIX
    tlv('52', '0000'), // Merchant Category Code
    tlv('53', '986'), // Currency: BRL (986)
  ];

  if (typeof amountBrl === 'number' && Number.isFinite(amountBrl) && amountBrl > 0) {
    parts.push(tlv('54', amountBrl.toFixed(2)));
  }

  parts.push(
    tlv('58', 'BR'),
    tlv('59', cleanName),
    tlv('60', cleanCity),
    tlv('62', tlv('05', cleanTxid)),
    '6304'
  );

  const partial = parts.join('');
  return partial + crc16Ccitt(partial);
}

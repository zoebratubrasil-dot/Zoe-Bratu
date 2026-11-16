export function normalizeWhatsappDigits(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits || digits.length < 10) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function formatWhatsappDisplay(raw?: string | null): string {
  const digits = normalizeWhatsappDigits(raw);
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith('55') && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}

export interface WhatsappReceiptOptions {
  creatorName: string;
  itemLabel?: string;
  amountBrl?: number;
  paymentMethod?: string;
  buyerEmail?: string;
  orderRef?: string;
  isReceipt?: boolean;
}

export function buildWhatsappReceiptUrl(
  rawPhone: string | null | undefined,
  options: WhatsappReceiptOptions
): string | null {
  const digits = normalizeWhatsappDigits(rawPhone);
  if (!digits) return null;

  const lines: string[] = [];
  if (options.isReceipt !== false) {
    lines.push(`Olá ${options.creatorName}! Estou entrando em contato para enviar meu comprovante de pagamento.`);
  } else {
    lines.push(`Olá ${options.creatorName}! Gostaria de falar com você pelo WhatsApp.`);
  }

  if (options.itemLabel) {
    lines.push(`• Pedido: ${options.itemLabel}`);
  }
  if (typeof options.amountBrl === 'number' && options.amountBrl > 0) {
    lines.push(`• Valor: R$ ${options.amountBrl.toFixed(2).replace('.', ',')}`);
  }
  if (options.paymentMethod) {
    lines.push(`• Forma: ${options.paymentMethod === 'pix' ? 'Pix' : 'Cartão'}`);
  }
  if (options.orderRef) {
    lines.push(`• Código: ${options.orderRef}`);
  }
  if (options.buyerEmail) {
    lines.push(`• Meu e-mail de acesso: ${options.buyerEmail}`);
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

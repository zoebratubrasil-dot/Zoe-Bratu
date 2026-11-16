import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, CheckCircle2, AlertCircle, KeyRound, Receipt, ArrowRight } from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, SaleRecord, SaleStatus, SaleType } from '../../types';
import { detectPixKeyType } from '../../lib/pixBrCode';
import { formatBrl, formatDateTime } from '../../lib/format';
import { PixQrCard } from '../PixQrCard';

interface PixManagerProps {
  creatorToken: string;
  profile: CreatorProfile;
  dashboard: CreatorDashboardData;
  supabaseReady: boolean;
  onRefreshAll: () => Promise<void>;
  onGoToSales: () => void;
}

function makeTxid(): string {
  return `MPPIX${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

export const PixManager: React.FC<PixManagerProps> = ({
  creatorToken,
  profile,
  dashboard,
  supabaseReady,
  onRefreshAll,
  onGoToSales,
}) => {
  const [pixKeyInput, setPixKeyInput] = useState(profile.pix_key || '');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [saleType, setSaleType] = useState<SaleType>('vip_subscription');
  const [selectedMediaId, setSelectedMediaId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>(String(profile.vip_monthly_price_brl || 49.9));
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [txid, setTxid] = useState<string>(() => makeTxid());

  const [recordingSale, setRecordingSale] = useState(false);
  const [saleMsg, setSaleMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);

  useEffect(() => {
    setPixKeyInput(profile.pix_key || '');
  }, [profile.pix_key]);

  const ppvOrAllMedia = useMemo(() => {
    const ppv = dashboard.mediaItems.filter((m) => m.access_tier === 'ppv');
    return ppv.length > 0 ? ppv : dashboard.mediaItems;
  }, [dashboard.mediaItems]);

  useEffect(() => {
    if (saleType === 'vip_subscription') {
      setAmountInput(String(profile.vip_monthly_price_brl || 49.9));
    } else if (saleType === 'ppv') {
      const target = ppvOrAllMedia.find((m) => m.id === selectedMediaId) || ppvOrAllMedia[0];
      if (target) {
        if (!selectedMediaId) setSelectedMediaId(target.id);
        setAmountInput(String(target.price_brl > 0 ? target.price_brl : 29.9));
      }
    }
  }, [saleType, selectedMediaId, ppvOrAllMedia, profile.vip_monthly_price_brl]);

  const pixSales = useMemo(() => {
    return dashboard.sales.filter((s) => s.payment_method === 'pix');
  }, [dashboard.sales]);

  const pixPaidTotal = useMemo(() => {
    return pixSales.filter((s) => s.status === 'paid').reduce((acc, s) => acc + s.amount_brl, 0);
  }, [pixSales]);

  const pixPendingTotal = useMemo(() => {
    return pixSales.filter((s) => s.status === 'pending').reduce((acc, s) => acc + s.amount_brl, 0);
  }, [pixSales]);

  const parsedAmount = Number(String(amountInput).replace(',', '.')) || 0;

  const handleSavePixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyMsg(null);
    if (!supabaseReady) {
      setKeyMsg({ type: 'err', text: 'Conecte o Supabase antes de salvar sua chave PIX.' });
      return;
    }
    const clean = pixKeyInput.trim();
    if (!clean) {
      setKeyMsg({ type: 'err', text: 'Informe uma chave PIX válida (CPF, CNPJ, E-mail, Telefone ou Chave Aleatória).' });
      return;
    }

    setSavingKey(true);
    try {
      const resp = await fetch('/api/creator/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ pix_key: clean }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao salvar chave PIX.');
      }
      await onRefreshAll();
      setKeyMsg({
        type: 'ok',
        text: 'Chave PIX salva e integrada ao checkout público e ao gerador de QR Code!',
      });
    } catch (err) {
      setKeyMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar chave PIX.',
      });
    } finally {
      setSavingKey(false);
    }
  };

  const handleRecordPixSale = async (status: 'pending' | 'paid') => {
    setSaleMsg(null);
    if (!supabaseReady) {
      setSaleMsg({ type: 'err', text: 'Conecte o Supabase antes de registrar transações.' });
      return;
    }
    if (!profile.pix_key && !pixKeyInput.trim()) {
      setSaleMsg({ type: 'err', text: 'Cadastre e salve sua chave PIX primeiro.' });
      return;
    }
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      setSaleMsg({ type: 'err', text: 'Informe o e-mail do comprador para vincular a venda no banco.' });
      return;
    }
    if (saleType === 'ppv' && !selectedMediaId) {
      setSaleMsg({ type: 'err', text: 'Selecione qual mídia avulsa está sendo vendida.' });
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSaleMsg({ type: 'err', text: 'Informe um valor positivo em R$ para registrar.' });
      return;
    }

    setRecordingSale(true);
    try {
      const resp = await fetch('/api/creator/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({
          buyerEmail: buyerEmail.trim(),
          buyerName: buyerName.trim(),
          saleType,
          mediaId: saleType === 'ppv' ? selectedMediaId : undefined,
          amountBrl: parsedAmount,
          paymentMethod: 'pix',
          status,
          externalRef: txid,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Erro ao registrar transação Pix.');
      }
      await onRefreshAll();
      setSaleMsg({
        type: 'ok',
        text:
          status === 'paid'
            ? `Pix de ${formatBrl(parsedAmount)} confirmado no Banco de Vendas (Ref: ${data.sale?.external_ref})!`
            : `Cobrança Pix de ${formatBrl(parsedAmount)} registrada como pendente no Banco de Vendas (Ref: ${data.sale?.external_ref}).`,
      });
      setTxid(makeTxid());
      setBuyerEmail('');
      setBuyerName('');
    } catch (err) {
      setSaleMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao registrar venda.',
      });
    } finally {
      setRecordingSale(false);
    }
  };

  const handleStatusChange = async (saleId: string, status: SaleStatus) => {
    setUpdatingSaleId(saleId);
    try {
      await fetch(`/api/creator/sales/${saleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ status }),
      });
      await onRefreshAll();
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const handleInspectSaleQr = (sale: SaleRecord) => {
    setSaleType(sale.sale_type);
    if (sale.media_id) setSelectedMediaId(sale.media_id);
    setAmountInput(String(sale.amount_brl));
    setBuyerEmail(sale.buyer_email);
    setBuyerName(sale.buyer_name || '');
    setTxid((sale.external_ref || sale.id.slice(0, 10)).replace(/[^a-zA-Z0-9]/g, ''));
    setSaleMsg(null);
  };

  const activePixKey = pixKeyInput.trim() || profile.pix_key || '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            Chave PIX & QR Code de Pagamentos
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Cadastre sua chave PIX, visualize o QR Code oficial EMV para cobranças e integre cada transação ao Banco de Vendas.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToSales}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-100 hover:border-[#D4AF37] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Receipt className="h-3.5 w-3.5 text-[#D4AF37]" />
          Abrir Banco de Vendas
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-[#121215]">
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Chave PIX Ativa</p>
          <p className="font-mono text-sm font-medium text-zinc-100 truncate">
            {profile.pix_key ? profile.pix_key : 'Não cadastrada'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {profile.pix_key ? detectPixKeyType(profile.pix_key) : 'Cadastre abaixo para ativar no checkout'}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Recebido via PIX</p>
          <p className="font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(pixPaidTotal)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {pixSales.filter((s) => s.status === 'paid').length} transações confirmadas
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Aguardando Confirmação PIX</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {formatBrl(pixPendingTotal)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {pixSales.filter((s) => s.status === 'pending').length} cobranças pendentes
          </p>
        </div>
      </div>

      {/* Main Two-Column Grid: Left = Register Pix Key & Transaction Form, Right = Live QR Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-6">
          {/* Form 1: Cadastrar Chave PIX */}
          <form
            onSubmit={handleSavePixKey}
            className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-[#D4AF37]" />
              <h3 className="font-display text-lg font-semibold text-zinc-50">
                1. Cadastrar Chave PIX
              </h3>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Esta chave será usada automaticamente no QR Code do checkout público (Clube VIP, Avulsos e Mimos) e nas cobranças geradas abaixo.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Chave PIX (CPF, CNPJ, E-mail, Celular ou EVP)
                </label>
                <span className="text-xs text-zinc-400">{detectPixKeyType(pixKeyInput)}</span>
              </div>
              <input
                type="text"
                value={pixKeyInput}
                onChange={(e) => setPixKeyInput(e.target.value)}
                placeholder="Ex: zoebratubrasil@gmail.com ou CPF/CNPJ"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Titular exibido no QR: <span className="text-zinc-200">{profile.display_name}</span></span>
              <span>Cidade: <span className="text-zinc-200">{profile.location.split(',')[0]}</span></span>
            </div>

            {keyMsg && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  keyMsg.type === 'ok'
                    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
                }`}
              >
                {keyMsg.type === 'ok' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{keyMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingKey}
              className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingKey ? 'Salvando chave...' : 'Salvar Chave PIX'}
            </button>
          </form>

          {/* Form 2: Configurar Transação e Integrar ao Banco de Vendas */}
          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-4 w-4 text-[#D4AF37]" />
                <h3 className="font-display text-lg font-semibold text-zinc-50">
                  2. Transação & Banco de Vendas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTxid(makeTxid())}
                className="text-xs text-[#E5C158] hover:underline cursor-pointer"
              >
                Nova ref
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#09090B] border border-zinc-800">
              {(
                [
                  { id: 'vip_subscription', label: 'Clube VIP' },
                  { id: 'ppv', label: 'Avulso (PPV)' },
                  { id: 'tip', label: 'Personalizado' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSaleType(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    saleType === opt.id
                      ? 'bg-[#D4AF37] text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {saleType === 'ppv' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Selecionar Foto ou Vídeo
                </label>
                {ppvOrAllMedia.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Nenhuma mídia cadastrada ainda. Envie fotos/vídeos primeiro ou use valor personalizado.
                  </p>
                ) : (
                  <select
                    value={selectedMediaId}
                    onChange={(e) => setSelectedMediaId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                  >
                    {ppvOrAllMedia.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.price_brl > 0 ? formatBrl(m.price_brl) : 'VIP/Prévia'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Valor da Compra (R$)</label>
                <input
                  type="number"
                  min="1"
                  step="0.50"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Identificador (TXID)</label>
                <input
                  type="text"
                  maxLength={25}
                  value={txid}
                  onChange={(e) => setTxid(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">E-mail do Comprador</label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nome (opcional)</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            {saleMsg && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  saleMsg.type === 'ok'
                    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-700/60 bg-rose-950/30 text-rose-200'
                }`}
              >
                {saleMsg.type === 'ok' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{saleMsg.text}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={recordingSale}
                onClick={() => handleRecordPixSale('paid')}
                className="flex-1 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {recordingSale ? 'Registrando...' : 'Confirmar Pix Pago no Banco'}
              </button>
              <button
                type="button"
                disabled={recordingSale}
                onClick={() => handleRecordPixSale('pending')}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-100 hover:border-[#D4AF37] disabled:opacity-50 transition-colors cursor-pointer"
              >
                Registrar Cobrança Pendente
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Scannable QR Code Preview */}
        <div className="lg:col-span-6 rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-zinc-50">
                Pré-visualização do QR Code PIX
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Padrão Banco Central (BR Code EMV) · Pronto para leitura em qualquer aplicativo bancário.
              </p>
            </div>
          </div>

          <PixQrCard
            pixKey={activePixKey}
            merchantName={profile.display_name}
            merchantCity={profile.location}
            amountBrl={parsedAmount}
            txid={txid}
            description={
              saleType === 'vip_subscription'
                ? 'Assinatura Clube VIP'
                : saleType === 'ppv'
                ? 'Desbloqueio Midia'
                : 'Maison Prive'
            }
          />

          <p className="text-xs text-zinc-400 leading-relaxed">
            Ao confirmar o recebimento acima ou pelo checkout da vitrine pública, o valor em <span className="font-mono text-zinc-200">{formatBrl(parsedAmount)}</span> é integrado imediatamente ao Banco de Vendas e libera o acesso correspondente ao e-mail do comprador.
          </p>
        </div>
      </div>

      {/* Pix Ledger Snapshot */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-zinc-50">
            Transações PIX Integradas ao Banco de Vendas ({pixSales.length})
          </h3>
        </div>

        {pixSales.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-10 text-center space-y-2">
            <p className="font-display text-base text-zinc-200">Nenhuma transação PIX registrada ainda</p>
            <p className="text-xs text-zinc-400">
              Compras feitas na vitrine via Pix ou cobranças registradas acima aparecerão aqui com atualização em tempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">QR Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {pixSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300 whitespace-nowrap">
                      {sale.external_ref || sale.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-100 font-medium">{sale.buyer_email}</p>
                      {sale.buyer_name && <p className="text-zinc-500">{sale.buyer_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {sale.sale_type === 'vip_subscription'
                        ? 'Clube VIP'
                        : sale.sale_type === 'tip'
                        ? 'Personalizado / Mimo'
                        : sale.media_title || 'Mídia Avulsa'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                      {formatBrl(sale.amount_brl)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={sale.status}
                        disabled={updatingSaleId === sale.id}
                        onChange={(e) => handleStatusChange(sale.id, e.target.value as SaleStatus)}
                        className={`rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium focus:outline-none ${
                          sale.status === 'paid'
                            ? 'text-emerald-300'
                            : sale.status === 'pending'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                        }`}
                      >
                        <option value="paid">Pago</option>
                        <option value="pending">Pendente</option>
                        <option value="refunded">Estornado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectSaleQr(sale)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-[#D4AF37] cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5 text-[#D4AF37]" />
                        Ver QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

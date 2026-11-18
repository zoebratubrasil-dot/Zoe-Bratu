import React, { useMemo, useState } from 'react';
import { Download, Search, QrCode } from 'lucide-react';
import type { CreatorDashboardData, SaleStatus } from '../../types';
import { formatBrl, formatDateTime } from '../../lib/format';

interface SalesLedgerProps {
  creatorToken: string;
  dashboard: CreatorDashboardData;
  onRefresh: () => Promise<void>;
  onOpenPix?: () => void;
}

export const SalesLedger: React.FC<SalesLedgerProps> = ({
  creatorToken,
  dashboard,
  onRefresh,
  onOpenPix,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vip_subscription' | 'video_call' | 'ppv' | 'tip'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    return dashboard.sales.filter((s) => {
      if (typeFilter !== 'all' && s.sale_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${s.buyer_email} ${s.buyer_name || ''} ${s.media_title || ''} ${s.external_ref || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dashboard.sales, typeFilter, search]);

  const handleStatusChange = async (saleId: string, status: SaleStatus) => {
    setUpdatingId(saleId);
    try {
      await fetch(`/api/creator/sales/${saleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-creator-token': creatorToken,
        },
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCsv = () => {
    const header = ['Data', 'Referencia', 'Comprador', 'Tipo', 'Item', 'Metodo', 'Valor BRL', 'Status'];
    const rows = filteredSales.map((s) => [
      s.created_at,
      s.external_ref || s.id,
      s.buyer_email,
      s.sale_type,
      s.media_title ||
        (s.sale_type === 'vip_subscription'
          ? 'Assinatura Clube VIP'
          : s.sale_type === 'video_call'
          ? 'Vídeo Chamada ao Vivo'
          : 'Mimo'),
      s.payment_method,
      s.amount_brl.toFixed(2),
      s.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-maison-prive-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/20 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#524B45]">
            Livro Financeiro
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Banco de Vendas & Financeiro
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Acompanhe receitas de assinaturas VIP, vídeo chamadas, desbloqueios avulsos (PPV) e mimos em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenPix && (
            <button
              type="button"
              onClick={onOpenPix}
              className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-4 py-2 text-xs font-semibold text-[#181615] hover:border-[#181615] transition-colors cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              Chave PIX & QR Code
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-2 rounded-sm bg-[#181615] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:bg-[#332E2C] disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 [&>*:nth-child(odd)]:border-r lg:[&>*:nth-child(odd)]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0 lg:divide-x divide-[#181615]/15 rounded-sm border border-[#181615]/20 bg-[#F3EFEA]">
        <div className="p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Receita Total Confirmada
          </p>
          <p className="font-mono text-lg sm:text-2xl font-bold text-[#8A5A00] tabular-nums">
            {formatBrl(dashboard.metrics.totalRevenueBrl)}
          </p>
        </div>
        <div className="p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Assinaturas Clube VIP
          </p>
          <p className="font-mono text-lg sm:text-2xl font-bold text-[#181615] tabular-nums">
            {formatBrl(dashboard.metrics.vipRevenueBrl)}
          </p>
        </div>
        <div className="p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Vendas Avulsas (PPV)
          </p>
          <p className="font-mono text-lg sm:text-2xl font-bold text-[#181615] tabular-nums">
            {formatBrl(dashboard.metrics.ppvRevenueBrl)}
          </p>
        </div>
        <div className="p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Assinantes VIP Ativos
          </p>
          <p className="font-mono text-lg sm:text-2xl font-bold text-[#181615] tabular-nums">
            {dashboard.metrics.activeVipFans}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 p-1 rounded-sm bg-[#EFEBE5] border border-[#181615]/20 overflow-x-auto no-scrollbar max-w-full sm:flex-wrap sm:w-fit">
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'vip_subscription', label: 'Clube VIP' },
              { id: 'video_call', label: 'Vídeo Chamadas' },
              { id: 'ppv', label: 'Avulsas (PPV)' },
              { id: 'tip', label: 'Mimos' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === opt.id
                  ? 'bg-[#181615] text-[#FAF8F5] font-semibold'
                  : 'text-[#524B45] hover:text-[#181615]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#524B45]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por e-mail ou referência..."
            className="w-full min-h-[40px] rounded-sm border border-[#181615]/25 bg-white pl-9 pr-3 py-2 text-sm sm:text-xs text-[#181615] placeholder:text-[#7A726B] focus:border-[#181615] focus:outline-none"
          />
        </div>
      </div>

      {/* Ledger Table */}
      {filteredSales.length === 0 ? (
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-12 text-center space-y-2">
          <p className="font-display text-lg font-bold text-[#181615]">Nenhuma venda registrada ainda</p>
          <p className="text-xs text-[#524B45]">
            Todas as assinaturas VIP, vídeo chamadas, desbloqueios e mimos aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#181615]/20 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#181615]/15 bg-[#F3EFEA] text-[#524B45] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Data / Hora</th>
                <th className="px-4 py-3 font-semibold">Ref</th>
                <th className="px-4 py-3 font-semibold">Comprador</th>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 font-semibold">Método</th>
                <th className="px-4 py-3 font-semibold text-right">Valor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181615]/10">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="px-4 py-3 font-mono text-[#524B45] tabular-nums whitespace-nowrap">
                    {formatDateTime(sale.created_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#181615] whitespace-nowrap">
                    {sale.external_ref || sale.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#181615] font-semibold">{sale.buyer_email}</p>
                    {sale.buyer_name && <p className="text-[#524B45]">{sale.buyer_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#181615]">
                    {sale.sale_type === 'vip_subscription'
                      ? 'Assinatura Mensal VIP'
                      : sale.sale_type === 'video_call'
                      ? sale.media_title || 'Vídeo Chamada ao Vivo'
                      : sale.sale_type === 'tip'
                      ? 'Mimo Direto'
                      : sale.media_title || 'Conteúdo Avulso'}
                  </td>
                  <td className="px-4 py-3 text-[#524B45]">
                    {sale.payment_method === 'pix' ? 'Pix' : 'Cartão'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#181615] tabular-nums">
                    {formatBrl(sale.amount_brl)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={sale.status}
                      disabled={updatingId === sale.id}
                      onChange={(e) => handleStatusChange(sale.id, e.target.value as SaleStatus)}
                      className={`rounded-sm border border-[#181615]/25 bg-white px-2 py-1 text-xs font-semibold focus:outline-none ${
                        sale.status === 'paid'
                          ? 'text-emerald-800'
                          : sale.status === 'pending'
                          ? 'text-amber-800'
                          : 'text-rose-800'
                      }`}
                    >
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="refunded">Estornado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

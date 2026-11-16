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
  const [typeFilter, setTypeFilter] = useState<'all' | 'vip_subscription' | 'ppv' | 'tip'>('all');
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
      s.media_title || (s.sale_type === 'vip_subscription' ? 'Assinatura Clube VIP' : 'Mimo'),
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            Banco de Vendas & Financeiro
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Acompanhe receitas de assinaturas VIP, desbloqueios avulsos (PPV) e mimos em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenPix && (
            <button
              type="button"
              onClick={onOpenPix}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-4 py-2 text-xs font-medium text-[#E5C158] hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              Chave PIX & QR Code
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-[#121215]">
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Receita Total Confirmada</p>
          <p className="font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(dashboard.metrics.totalRevenueBrl)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Assinaturas Clube VIP</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {formatBrl(dashboard.metrics.vipRevenueBrl)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Vendas Avulsas (PPV)</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {formatBrl(dashboard.metrics.ppvRevenueBrl)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Assinantes VIP Ativos</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {dashboard.metrics.activeVipFans}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121215] border border-zinc-800 w-fit">
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'vip_subscription', label: 'Clube VIP' },
              { id: 'ppv', label: 'Avulsas (PPV)' },
              { id: 'tip', label: 'Mimos' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                typeFilter === opt.id ? 'bg-[#D4AF37] text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por e-mail ou referência..."
            className="w-64 rounded-lg border border-zinc-800 bg-[#121215] pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>
      </div>

      {/* Ledger Table */}
      {filteredSales.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-[#121215] p-12 text-center space-y-2">
          <p className="font-display text-lg text-zinc-200">Nenhuma venda registrada ainda</p>
          <p className="text-xs text-zinc-400">
            Todas as assinaturas VIP, desbloqueios de fotos/vídeos e mimos aparecerão aqui automaticamente.
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
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filteredSales.map((sale) => (
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
                      ? 'Assinatura Mensal VIP'
                      : sale.sale_type === 'tip'
                      ? 'Mimo Direto'
                      : sale.media_title || 'Conteúdo Avulso'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {sale.payment_method === 'pix' ? 'Pix' : 'Cartão'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-100 tabular-nums">
                    {formatBrl(sale.amount_brl)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={sale.status}
                      disabled={updatingId === sale.id}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

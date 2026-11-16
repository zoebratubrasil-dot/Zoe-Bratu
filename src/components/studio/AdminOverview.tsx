import React from 'react';
import {
  Upload,
  FolderKanban,
  Receipt,
  UserCog,
  Users,
  Database,
  ExternalLink,
  Image as ImageIcon,
  Film,
  Crown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, SupabaseStatus } from '../../types';
import { formatBrl, formatDateShort } from '../../lib/format';
import type { StudioTab } from '../CreatorStudio';

interface AdminOverviewProps {
  profile: CreatorProfile;
  dashboard: CreatorDashboardData;
  supabaseStatus: SupabaseStatus | null;
  onNavigateTab: (tab: StudioTab) => void;
  onOpenStorefront: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  profile,
  dashboard,
  supabaseStatus,
  onNavigateTab,
  onOpenStorefront,
}) => {
  const photosCount = dashboard.mediaItems.filter((m) => m.media_type === 'photo').length;
  const videosCount = dashboard.mediaItems.filter((m) => m.media_type === 'video').length;
  const draftsCount = dashboard.mediaItems.filter((m) => !m.is_published).length;
  const supabaseReady = Boolean(supabaseStatus?.connected && supabaseStatus?.schemaReady);

  const quickActions: Array<{
    tab: StudioTab;
    title: string;
    desc: string;
    badge: string;
    icon: React.ReactNode;
  }> = [
    {
      tab: 'manage',
      title: 'Editar Fotos & Vídeos',
      desc: 'Altere títulos, preços avulsos, coleções, capas de prévia, arquivos ou visibilidade.',
      badge: `${dashboard.mediaItems.length} itens`,
      icon: <FolderKanban className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'upload',
      title: 'Enviar Novas Mídias',
      desc: 'Suba fotos em alta resolução e vídeos privados diretamente para o Storage.',
      badge: `${photosCount} fotos · ${videosCount} vídeos`,
      icon: <Upload className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'profile',
      title: 'Informações & Visual do Site',
      desc: 'Edite nome, arroba, bio, avatar, capa hero, valor da assinatura VIP e chave Pix.',
      badge: formatBrl(profile.vip_monthly_price_brl) + '/mês',
      icon: <UserCog className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'fans',
      title: 'Assinantes & Acessos VIP',
      desc: 'Consulte clientes, libere ou estenda acessos VIP manualmente após Pix direto.',
      badge: `${dashboard.metrics.activeVipFans} VIPs ativos`,
      icon: <Users className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'pix',
      title: 'Pix & QR Code',
      desc: 'Cadastre sua chave PIX, visualize QR Codes de compra e integre pagamentos ao banco de vendas.',
      badge: profile.pix_key ? 'Chave ativa' : 'Configurar',
      icon: <QrCode className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'sales',
      title: 'Banco de Vendas',
      desc: 'Acompanhe pagamentos, atualize status, faça estornos e exporte relatórios CSV.',
      badge: `${dashboard.metrics.totalSalesCount} vendas`,
      icon: <Receipt className="h-5 w-5 text-[#D4AF37]" />,
    },
    {
      tab: 'supabase',
      title: 'Supabase & Exportar Código',
      desc: 'Gerencie banco de dados, buckets de mídia e baixe o arquivo .zip completo do site.',
      badge: supabaseReady ? 'Ativo' : 'Pendente',
      icon: <Database className="h-5 w-5 text-[#D4AF37]" />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            Administração Completa do Site
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie todas as fotos, vídeos, informações públicas da vitrine, assinantes e vendas em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenStorefront}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-100 hover:border-[#D4AF37] transition-colors shrink-0 cursor-pointer"
        >
          <ExternalLink className="h-3.5 w-3.5 text-[#D4AF37]" />
          Visualizar Vitrine Pública
        </button>
      </div>

      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 rounded-xl border border-zinc-800 bg-[#121215]">
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Receita Confirmada</p>
          <p className="font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
            {formatBrl(dashboard.metrics.totalRevenueBrl)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Acervo Total</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {dashboard.mediaItems.length}
            <span className="text-xs font-sans font-normal text-zinc-400 ml-2">
              ({draftsCount} rascunho{draftsCount === 1 ? '' : 's'})
            </span>
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Assinantes VIP Ativos</p>
          <p className="font-mono text-2xl font-semibold text-zinc-50 tabular-nums">
            {dashboard.metrics.activeVipFans}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Banco Supabase</p>
          <div className="flex items-center gap-2 mt-1.5 text-sm font-semibold">
            {supabaseReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300">Conectado</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300">Pendente</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Site Identity Preview Card */}
      <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={profile.avatar_url || '/src/assets/images/creator_avatar_portrait_1794805425733.jpg'}
            alt={profile.display_name}
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full object-cover border border-zinc-700 shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg font-semibold text-zinc-50 truncate">
                {profile.display_name}
              </h3>
              <span className="text-xs text-[#D4AF37] font-mono">{profile.handle}</span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2 max-w-xl">{profile.bio}</p>
            <p className="text-[11px] text-zinc-500">
              {profile.location} · VIP {formatBrl(profile.vip_monthly_price_brl)}/mês · Pix:{' '}
              {profile.pix_key ? profile.pix_key : 'Não cadastrada'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#E5C158] transition-colors shrink-0 cursor-pointer"
        >
          Editar Informações & Capa
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick Action Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((act) => (
          <button
            key={act.tab}
            type="button"
            onClick={() => onNavigateTab(act.tab)}
            className="group text-left rounded-xl border border-zinc-800 bg-[#121215] p-5 hover:border-[#D4AF37]/70 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                  {act.icon}
                </div>
                <span className="text-[11px] font-mono text-zinc-400">{act.badge}</span>
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-100 group-hover:text-[#E5C158] transition-colors">
                  {act.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{act.desc}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D4AF37]">
              <span>Abrir módulo</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Recent Media & Recent Sales Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Últimas Fotos & Vídeos
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('manage')}
              className="text-xs text-[#E5C158] hover:underline cursor-pointer"
            >
              Ver tudo
            </button>
          </div>
          {dashboard.mediaItems.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">
              Nenhuma mídia publicada ainda. Clique em "Enviar Novas Mídias" para começar.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/70">
              {dashboard.mediaItems.slice(0, 4).map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-12 rounded bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {m.preview_url || (m.media_type === 'photo' && m.media_url) ? (
                        <img
                          src={m.preview_url || m.media_url || ''}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : m.media_type === 'video' ? (
                        <Film className="h-4 w-4 text-[#D4AF37]" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-100 truncate">{m.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {m.media_type === 'video' ? 'Vídeo' : 'Foto'} · {m.collection_name}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-300 shrink-0">
                    {m.access_tier === 'ppv'
                      ? formatBrl(m.price_brl)
                      : m.access_tier === 'vip'
                      ? 'VIP'
                      : 'Prévia'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-zinc-100">
              Vendas & Assinaturas Recentes
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('sales')}
              className="text-xs text-[#E5C158] hover:underline cursor-pointer"
            >
              Abrir banco de vendas
            </button>
          </div>
          {dashboard.sales.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">
              Nenhuma venda registrada até o momento.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/70">
              {dashboard.sales.slice(0, 4).map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-100 truncate">{s.buyer_email}</p>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      {s.sale_type === 'vip_subscription' && <Crown className="h-3 w-3 text-[#D4AF37]" />}
                      <span>
                        {s.sale_type === 'vip_subscription'
                          ? 'Assinatura VIP'
                          : s.sale_type === 'tip'
                          ? 'Mimo'
                          : s.media_title || 'Avulso PPV'}
                      </span>
                      <span>·</span>
                      <span>{formatDateShort(s.created_at)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#E5C158] shrink-0">
                    {formatBrl(s.amount_brl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

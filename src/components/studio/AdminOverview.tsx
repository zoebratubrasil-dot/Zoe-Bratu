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
  Video,
} from 'lucide-react';
import type { CreatorDashboardData, CreatorProfile, SupabaseStatus } from '../../types';
import { formatBrl, formatDateShort } from '../../lib/format';
import { resolveVideoCallPlans } from '../../lib/videoCalls';
import type { StudioTab } from '../CreatorStudio';
import { ProtectedImage } from '../ProtectedMedia';

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
    num: string;
    title: string;
    desc: string;
    badge: string;
    icon: React.ReactNode;
  }> = [
    {
      tab: 'manage',
      num: '01.',
      title: 'Editar Fotos & Vídeos',
      desc: 'Altere títulos, preços avulsos, coleções, capas de prévia, arquivos ou visibilidade.',
      badge: `${dashboard.mediaItems.length} itens`,
      icon: <FolderKanban className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'upload',
      num: '02.',
      title: 'Enviar Novas Mídias',
      desc: 'Suba fotos em alta resolução e vídeos privados diretamente para o Storage.',
      badge: `${photosCount} fotos · ${videosCount} vídeos`,
      icon: <Upload className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'video_calls',
      num: '03.',
      title: 'Vídeo Chamadas (4 Planos)',
      desc: 'Edite os valores, durações em minutos e descrições dos 4 planos em destaque na vitrine.',
      badge: `${resolveVideoCallPlans(profile.video_call_plans).filter((p) => p.active).length} ativos`,
      icon: <Video className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'profile',
      num: '04.',
      title: 'Informações & Visual do Site',
      desc: 'Edite nome, arroba, bio, avatar, capa hero, valor da assinatura VIP e chave Pix.',
      badge: formatBrl(profile.vip_monthly_price_brl) + '/mês',
      icon: <UserCog className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'fans',
      num: '05.',
      title: 'Assinantes, VIPs & Boas-Vindas',
      desc: 'Gerencie clientes, libere VIP e configure o e-mail automático via Supabase Edge Function.',
      badge: `${dashboard.metrics.activeVipFans} VIPs ativos`,
      icon: <Users className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'pix',
      num: '06.',
      title: 'Pix & QR Code',
      desc: 'Cadastre sua chave PIX, visualize QR Codes de compra e integre pagamentos ao banco de vendas.',
      badge: profile.pix_key ? 'Chave ativa' : 'Configurar',
      icon: <QrCode className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'sales',
      num: '07.',
      title: 'Banco de Vendas',
      desc: 'Acompanhe pagamentos, atualize status, faça estornos e exporte relatórios CSV.',
      badge: `${dashboard.metrics.totalSalesCount} vendas`,
      icon: <Receipt className="h-4 w-4 text-[#181615]" />,
    },
    {
      tab: 'supabase',
      num: '08.',
      title: 'Supabase & Exportar Código',
      desc: 'Gerencie banco de dados, buckets de mídia e baixe o arquivo .zip completo do site.',
      badge: supabaseReady ? 'Ativo' : 'Pendente',
      icon: <Database className="h-4 w-4 text-[#181615]" />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Editorial Sheet */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#181615]/20 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#524B45]">
            Painel de Controle
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#181615] mt-1">
            Visão Geral do Site
          </h2>
          <p className="text-sm text-[#524B45] mt-1">
            Gerencie fotos, vídeos, chamadas ao vivo, informações públicas, assinantes e finanças.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenStorefront}
          className="inline-flex items-center gap-2 rounded-sm border border-[#181615]/30 bg-[#EFEBE5] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#181615] hover:border-[#181615] hover:bg-[#E7E1D9] transition-colors shrink-0 cursor-pointer"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visualizar Vitrine Pública
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#181615]/15 rounded-sm border border-[#181615]/20 bg-[#F3EFEA]">
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Receita Confirmada
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {formatBrl(dashboard.metrics.totalRevenueBrl)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Acervo Total
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {dashboard.mediaItems.length}
            <span className="text-xs font-sans font-normal text-[#524B45] ml-2">
              ({draftsCount} rascunho{draftsCount === 1 ? '' : 's'})
            </span>
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Assinantes VIP Ativos
          </p>
          <p className="font-mono text-2xl font-bold text-[#181615] tabular-nums">
            {dashboard.metrics.activeVipFans}
          </p>
        </div>
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#524B45] mb-1">
            Banco Supabase
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-sm font-semibold">
            {supabaseReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-900">Conectado</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-amber-900">Pendente</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editorial Contrast Identity Card (Echoing the dark "ABOUT / APPROACH" band in reference) */}
      <div className="rounded-sm border border-[#181615] bg-[#181615] text-[#FAF8F5] p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-3">
          <div className="aspect-[4/3] md:aspect-[4/5] rounded-sm overflow-hidden border border-white/15 bg-[#262321]">
            <ProtectedImage
              src={profile.avatar_url || '/api/profile/asset/avatar'}
              alt={profile.display_name}
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>

        <div className="md:col-span-9 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#D2CCC4]">
                  Identidade Pública
                </p>
                <h3 className="font-display text-3xl font-bold uppercase tracking-tight text-[#FAF8F5]">
                  {profile.display_name}
                </h3>
              </div>
              <span className="font-mono text-xs text-[#E5C158]">{profile.handle}</span>
            </div>
            <p className="text-sm text-[#DED9D3] leading-relaxed max-w-2xl pt-1">{profile.bio}</p>
            <p className="text-xs font-mono text-[#BDB5AD] pt-1">
              {profile.location} · VIP {formatBrl(profile.vip_monthly_price_brl)}/mês · Pix:{' '}
              {profile.pix_key ? profile.pix_key : 'Não cadastrada'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('profile')}
              className="inline-flex items-center gap-2 rounded-sm bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#181615] hover:bg-[#E7E1D9] transition-colors cursor-pointer"
            >
              Editar Informações & Capa
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('video_calls')}
              className="inline-flex items-center gap-2 rounded-sm border border-white/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF8F5] hover:border-white transition-colors cursor-pointer"
            >
              Configurar Vídeo Chamadas
            </button>
          </div>
        </div>
      </div>

      {/* Numbered Process / Modules Grid (matching "THE PROCESS 01. 02. 03. 04." editorial pattern) */}
      <div className="space-y-4">
        <div className="flex items-end justify-between border-b border-[#181615]/15 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#524B45]">
              Estrutura Operacional
            </p>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#181615]">
              Módulos de Administração
            </h3>
          </div>
          <span className="text-xs font-mono text-[#524B45]">01 — 08</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((act) => (
            <button
              key={act.tab}
              type="button"
              onClick={() => onNavigateTab(act.tab)}
              className="group text-left rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-5 hover:border-[#181615] hover:bg-white transition-colors flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#181615]/15 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-lg font-bold text-[#181615] tabular-nums">
                      {act.num}
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#181615]/20 bg-white">
                      {act.icon}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-[#524B45]">{act.badge}</span>
                </div>
                <div>
                  <h4 className="font-display text-lg font-bold uppercase tracking-tight text-[#181615]">
                    {act.title}
                  </h4>
                  <p className="text-xs text-[#524B45] mt-1 leading-relaxed">{act.desc}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#181615]">
                <span>Abrir módulo</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Media & Recent Sales Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#181615]/15 pb-3">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#181615]">
              Últimas Fotos & Vídeos
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('manage')}
              className="text-xs font-semibold text-[#181615] hover:underline cursor-pointer"
            >
              Ver tudo →
            </button>
          </div>
          {dashboard.mediaItems.length === 0 ? (
            <p className="text-xs text-[#524B45] py-4">
              Nenhuma mídia publicada ainda. Clique em "Enviar Novas Mídias" para começar.
            </p>
          ) : (
            <div className="divide-y divide-[#181615]/15">
              {dashboard.mediaItems.slice(0, 4).map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-12 rounded-sm bg-[#181615] border border-[#181615]/20 overflow-hidden shrink-0 flex items-center justify-center">
                      {m.preview_url || (m.media_type === 'photo' && m.media_url) ? (
                        <ProtectedImage
                          src={m.preview_url || m.media_url || ''}
                          alt={m.title}
                          className="h-full w-full object-cover"
                        />
                      ) : m.media_type === 'video' ? (
                        <Film className="h-4 w-4 text-[#FAF8F5]" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-[#D2CCC4]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#181615] truncate">{m.title}</p>
                      <p className="text-[11px] text-[#524B45]">
                        {m.media_type === 'video' ? 'Vídeo' : 'Foto'} · {m.collection_name}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#181615] shrink-0">
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

        <div className="rounded-sm border border-[#181615]/20 bg-[#F3EFEA] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#181615]/15 pb-3">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#181615]">
              Vendas & Assinaturas Recentes
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('sales')}
              className="text-xs font-semibold text-[#181615] hover:underline cursor-pointer"
            >
              Banco de vendas →
            </button>
          </div>
          {dashboard.sales.length === 0 ? (
            <p className="text-xs text-[#524B45] py-4">
              Nenhuma venda registrada até o momento.
            </p>
          ) : (
            <div className="divide-y divide-[#181615]/15">
              {dashboard.sales.slice(0, 4).map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#181615] truncate">{s.buyer_email}</p>
                    <p className="text-[11px] text-[#524B45] flex items-center gap-1.5">
                      {s.sale_type === 'vip_subscription' && <Crown className="h-3 w-3 text-[#8A5A00]" />}
                      <span>
                        {s.sale_type === 'vip_subscription'
                          ? 'Assinatura VIP'
                          : s.sale_type === 'video_call'
                          ? s.media_title || 'Vídeo Chamada ao Vivo'
                          : s.sale_type === 'tip'
                          ? 'Mimo'
                          : s.media_title || 'Avulso PPV'}
                      </span>
                      <span>·</span>
                      <span>{formatDateShort(s.created_at)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#8A5A00] shrink-0">
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

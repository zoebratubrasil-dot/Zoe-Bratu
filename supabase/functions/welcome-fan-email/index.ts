import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WelcomeRequestPayload {
  fanId?: string;
  email?: string;
  displayName?: string;
  triggerSource?: 'signup' | 'first_purchase' | 'manual_test';
  saleType?: 'vip_subscription' | 'ppv' | 'tip' | 'video_call';
  amountBrl?: number;
  creatorName?: string;
  siteUrl?: string;
  forceTest?: boolean;
  // Database Webhook shape
  type?: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  record?: Record<string, unknown>;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function buildWelcomeHtml(opts: {
  fanName: string;
  creatorName: string;
  creatorHandle: string;
  triggerSource: 'signup' | 'first_purchase' | 'manual_test';
  saleType?: string;
  amountBrl?: number;
  siteUrl?: string;
}): { subject: string; html: string; text: string } {
  const safeFan = escapeHtml(opts.fanName || 'Assinante');
  const safeCreator = escapeHtml(opts.creatorName || 'Maison Privé');
  const safeHandle = escapeHtml(opts.creatorHandle || '');
  const siteLink = opts.siteUrl ? escapeHtml(opts.siteUrl) : '';

  const isPurchase = opts.triggerSource === 'first_purchase';
  const purchaseLabel =
    opts.saleType === 'vip_subscription'
      ? 'sua assinatura no Clube VIP'
      : opts.saleType === 'video_call'
      ? 'sua reserva de Vídeo Chamada ao vivo'
      : opts.saleType === 'ppv'
      ? 'seu primeiro conteúdo exclusivo'
      : opts.saleType === 'tip'
      ? 'seu primeiro mimo'
      : 'sua primeira compra';

  const subject = isPurchase
    ? `Bem-vindo(a) ao acervo privado de ${opts.creatorName}`
    : `Seu acesso em ${opts.creatorName} está ativo`;

  const headline = isPurchase
    ? `Obrigado por ${purchaseLabel}, ${safeFan}.`
    : `Bem-vindo(a) ao espaço privado de ${safeCreator}, ${safeFan}.`;

  const bodyCopy = isPurchase
    ? `Confirmamos ${purchaseLabel}${
        opts.amountBrl ? ` (${formatBrl(opts.amountBrl)})` : ''
      }. Seu acesso já está sincronizado com o seu e-mail para aproveitar fotos e vídeos exclusivos com proteção total.`
    : `Seu cadastro para maiores de 18 anos foi concluído com sucesso. Agora você já pode explorar prévias, assinar o Clube VIP ou desbloquear ensaios e vídeos avulsos usando este e-mail.`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#121215;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #27272a;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#d4af37;font-weight:600;">
                Maison Privé · +18
              </p>
              <h1 style="margin:0;font-size:24px;line-height:1.25;color:#fafafa;font-weight:600;">
                ${safeCreator}
              </h1>
              ${
                safeHandle
                  ? `<p style="margin:4px 0 0 0;font-size:13px;color:#a1a1aa;">${safeHandle}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <h2 style="margin:0 0 12px 0;font-size:18px;line-height:1.35;color:#f4f4f5;font-weight:600;">
                ${headline}
              </h2>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#d4d4d8;">
                ${bodyCopy}
              </p>
              ${
                siteLink
                  ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;">
                      <tr>
                        <td style="border-radius:8px;background-color:#d4af37;">
                          <a href="${siteLink}" style="display:inline-block;padding:12px 22px;font-size:13px;font-weight:600;color:#09090b;text-decoration:none;">
                            Acessar Vitrine Privada
                          </a>
                        </td>
                      </tr>
                    </table>`
                  : ''
              }
              <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
                Sempre que retornar ao site, basta informar este e-mail em "Já sou assinante" para restaurar seus conteúdos liberados.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #27272a;background-color:#0d0d10;">
              <p style="margin:0;font-size:11px;color:#71717a;">
                Conteúdo estritamente para maiores de 18 anos. Envio automático via Supabase Edge Function.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${opts.creatorName}\n\n${headline}\n\n${bodyCopy}${
    opts.siteUrl ? `\n\nAcesse: ${opts.siteUrl}` : ''
  }`;

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, function: 'welcome-fan-email', runtime: 'supabase-edge' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Maison Privé <onboarding@resend.dev>';
    const webhookUrl = Deno.env.get('WELCOME_WEBHOOK_URL') || '';

    const payload = (await req.json()) as WelcomeRequestPayload;

    let fanId = payload.fanId || null;
    let email = (payload.email || '').trim().toLowerCase();
    let displayName = (payload.displayName || '').trim();
    let triggerSource: 'signup' | 'first_purchase' | 'manual_test' = payload.triggerSource || 'signup';
    let saleType = payload.saleType;
    let amountBrl = payload.amountBrl;
    const forceTest = Boolean(payload.forceTest || triggerSource === 'manual_test');

    // Normalize Supabase Database Webhook payload if triggered directly by Postgres
    if (payload.type === 'INSERT' && payload.record) {
      if (payload.table === 'fans') {
        fanId = String(payload.record.id || '') || null;
        email = String(payload.record.email || '').trim().toLowerCase();
        displayName = String(payload.record.display_name || '').trim();
        triggerSource = 'signup';
      } else if (payload.table === 'sales') {
        fanId = payload.record.fan_id ? String(payload.record.fan_id) : null;
        email = String(payload.record.buyer_email || '').trim().toLowerCase();
        displayName = String(payload.record.buyer_name || '').trim();
        saleType = String(payload.record.sale_type || '') as WelcomeRequestPayload['saleType'];
        amountBrl = Number(payload.record.amount_brl || 0);
        triggerSource = 'first_purchase';
      }
    }

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'E-mail do fã inválido ou ausente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;

    let creatorName = payload.creatorName || 'Maison Privé';
    let creatorHandle = '';

    if (adminClient) {
      // Load creator branding
      const { data: prof } = await adminClient
        .from('creator_profile')
        .select('display_name, handle')
        .eq('slug', 'solo')
        .maybeSingle();
      if (prof?.display_name) creatorName = prof.display_name;
      if (prof?.handle) creatorHandle = prof.handle || '';

      // Check idempotency via fans.welcome_email_sent_at unless manual test
      if (!forceTest) {
        const { data: fanRow } = await adminClient
          .from('fans')
          .select('id, display_name, welcome_email_sent_at')
          .eq('email', email)
          .maybeSingle();

        if (fanRow) {
          if (!fanId) fanId = fanRow.id;
          if (!displayName && fanRow.display_name) displayName = fanRow.display_name;
          if (fanRow.welcome_email_sent_at) {
            return new Response(
              JSON.stringify({
                ok: true,
                skipped: true,
                reason: 'welcome_already_sent',
                email,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    const fanName = displayName || email.split('@')[0];
    const message = buildWelcomeHtml({
      fanName,
      creatorName,
      creatorHandle,
      triggerSource,
      saleType,
      amountBrl,
      siteUrl: payload.siteUrl,
    });

    let deliveryStatus: 'sent' | 'pending_config' | 'failed' = 'pending_config';
    let provider = 'supabase_edge';
    let edgeResponseText = '';
    let errorMessage: string | null = null;

    if (resendApiKey) {
      provider = 'resend';
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [email],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      edgeResponseText = await resendResp.text();
      if (resendResp.ok) {
        deliveryStatus = 'sent';
      } else {
        deliveryStatus = 'failed';
        errorMessage = `Resend (${resendResp.status}): ${edgeResponseText}`;
      }
    } else if (webhookUrl) {
      provider = 'webhook';
      const hookResp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          fanName,
          subject: message.subject,
          html: message.html,
          text: message.text,
          triggerSource,
        }),
      });
      edgeResponseText = await hookResp.text();
      if (hookResp.ok) {
        deliveryStatus = 'sent';
      } else {
        deliveryStatus = 'failed';
        errorMessage = `Webhook (${hookResp.status}): ${edgeResponseText}`;
      }
    } else {
      deliveryStatus = 'pending_config';
      errorMessage = 'RESEND_API_KEY não configurada nos secrets da Edge Function.';
    }

    if (adminClient) {
      if (deliveryStatus === 'sent' && !forceTest) {
        await adminClient
          .from('fans')
          .update({ welcome_email_sent_at: new Date().toISOString() })
          .eq('email', email)
          .then(() => {}, () => {});
      }

      await adminClient
        .from('welcome_email_logs')
        .insert({
          fan_id: fanId,
          fan_email: email,
          trigger_source: triggerSource,
          provider,
          status: deliveryStatus,
          edge_response: edgeResponseText ? edgeResponseText.slice(0, 500) : null,
          error_message: errorMessage,
        })
        .then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({
        ok: deliveryStatus !== 'failed',
        status: deliveryStatus,
        provider,
        email,
        triggerSource,
        subject: message.subject,
        error: errorMessage,
      }),
      {
        status: deliveryStatus === 'failed' ? 502 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno na Edge Function';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

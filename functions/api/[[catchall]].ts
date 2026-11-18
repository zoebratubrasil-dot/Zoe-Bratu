export async function onRequest(context: {
  request: Request;
  env: { API_ORIGIN?: string };
}) {
  const apiOrigin = (context.env.API_ORIGIN || "").replace(/\/+$/, "");
  if (!apiOrigin) {
    return Response.json(
      { error: "A variável API_ORIGIN ainda não foi configurada no Cloudflare Pages." },
      { status: 500 }
    );
  }

  const incoming = new URL(context.request.url);
  const target = new URL(incoming.pathname + incoming.search, apiOrigin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  try {
    const upstream = await fetch(new Request(target.toString(), init));
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch {
    return Response.json(
      { error: "Não foi possível alcançar o servidor Maison Privé. Verifique o serviço de API." },
      { status: 502 }
    );
  }
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { escapeHtml } from "../_shared/html.ts";
import { funnelLabel } from "../_shared/funnels.ts";
import { emailForResponsavel } from "../_shared/responsaveis.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!webhookSecret || provided !== webhookSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.type !== "INSERT" || body.table !== "acoes") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = body.record ?? {};
  const texto = String(row.texto ?? "").trim();
  const prazo = row.prazo != null ? String(row.prazo) : "—";
  const funilSlug = row.funil_slug != null ? String(row.funil_slug) : "";
  const responsavel = row.responsavel != null ? String(row.responsavel) : "";
  const concluido = row.concluido === true;

  if (concluido) {
    return new Response(JSON.stringify({ ok: true, skipped: "concluido" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const to = emailForResponsavel(responsavel);
  if (!to) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_email_mapping" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) {
    return new Response(JSON.stringify({ error: "missing RESEND_API_KEY or RESEND_FROM" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const funilNome = funnelLabel(funilSlug);
  const subject = `[Desafio Diabetes] Nova tarefa atribuída — ${funilNome}`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #0D1B3E;">
  <h2 style="color:#FF0028;">Nova tarefa</h2>
  <p><strong>Tarefa:</strong> ${escapeHtml(texto || "(sem texto)")}</p>
  <p><strong>Prazo:</strong> ${escapeHtml(prazo)}</p>
  <p><strong>Funil:</strong> ${escapeHtml(funilNome)}${funilSlug ? ` <span style="color:#64748b">(${escapeHtml(funilSlug)})</span>` : ""}</p>
  <p style="color:#64748b;font-size:14px;">Responsável: ${escapeHtml(responsavel)}</p>
</body>
</html>`;

  try {
    await sendResendEmail({ apiKey, from, to, subject, html });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { escapeHtml } from "../_shared/html.ts";
import { funnelLabel } from "../_shared/funnels.ts";
import { emailForResponsavel } from "../_shared/responsaveis.ts";
import { prazoToYmd, todayYmdInTimeZone } from "../_shared/dates.ts";
import { sendResendEmail } from "../_shared/resend.ts";

type AcaoRow = {
  id: string;
  texto: string | null;
  prazo: string | null;
  funil_slug: string | null;
  responsavel: string | null;
  concluido: boolean | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const provided = bearer || headerSecret;
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
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

  const supabase = createClient(url, serviceKey);
  const { data: rows, error } = await supabase
    .from("acoes")
    .select("id, texto, prazo, funil_slug, responsavel, concluido")
    .eq("concluido", false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = todayYmdInTimeZone("America/Sao_Paulo");
  const list = (rows ?? []) as AcaoRow[];
  const dueToday = list.filter((r) => prazoToYmd(r.prazo) === today);

  const byResp = new Map<string, AcaoRow[]>();
  for (const r of dueToday) {
    const name = String(r.responsavel ?? "").trim();
    if (!name) continue;
    if (!byResp.has(name)) byResp.set(name, []);
    byResp.get(name)!.push(r);
  }

  let sent = 0;
  const errors: string[] = [];

  for (const [name, tasks] of byResp) {
    const to = emailForResponsavel(name);
    if (!to) continue;

    const lines = tasks.map((r) => {
      const t = escapeHtml(String(r.texto ?? "").trim());
      const f = escapeHtml(funnelLabel(String(r.funil_slug ?? "")));
      const p = escapeHtml(String(r.prazo ?? "—"));
      return `<li style="margin-bottom:12px"><strong>${t}</strong><br/><span style="color:#64748b">${f} · Prazo ${p}</span></li>`;
    });

    const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #0D1B3E;">
  <h2 style="color:#FF0028;">Tarefas para hoje (${escapeHtml(today)})</h2>
  <p>Olá, ${escapeHtml(name)}.</p>
  <p>As seguintes tarefas pendentes têm <strong>prazo hoje</strong>:</p>
  <ul style="line-height:1.6;padding-left:18px">${lines.join("")}</ul>
</body>
</html>`;

    try {
      await sendResendEmail({
        apiKey,
        from,
        to,
        subject: `[Desafio Diabetes] Tarefas de hoje (${today})`,
        html,
      });
      sent++;
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      today,
      pendingDueToday: dueToday.length,
      recipients: byResp.size,
      emailsSent: sent,
      errors,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

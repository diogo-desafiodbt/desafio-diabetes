/** Títulos dos funis (alinhado com src/data/funnelForms.js) para corpo de e-mail. */

const TITLES: Record<string, string> = {
  "instagram-organico": "Instagram Orgânico — Questionário Metabólico",
  "youtube-questionario": "YouTube Orgânico — Aplicativo",
  "youtube-livro": "YouTube Orgânico — Livro",
  "youtube-suplemento": "YouTube Orgânico — Suplemento",
  "pago-meta": "Pago Meta — Questionário Web",
  sistema: "Melhorias do sistema",
};

export function funnelLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return TITLES[String(slug)] ?? String(slug);
}

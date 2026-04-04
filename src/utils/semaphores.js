/** @typedef {{ label: string, ratioPct: number | null }} Stage */

/**
 * @param {number | null | undefined} actual
 * @param {number | null | undefined} target
 * @returns {number | null}
 */
export function ratioPct(actual, target) {
  const a = Number(actual);
  const t = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return null;
  return (a / t) * 100;
}

/**
 * @param {number | null} r
 * @returns {'green' | 'yellow' | 'red' | 'gray'}
 */
export function trafficLight(r) {
  if (r == null || Number.isNaN(r)) return "gray";
  if (r >= 100) return "green";
  if (r >= 70) return "yellow";
  return "red";
}

/**
 * @param {Stage[]} stages
 */
export function overallFromStages(stages) {
  const valid = stages.filter((s) => s.ratioPct != null && !Number.isNaN(s.ratioPct));
  if (!valid.length) return { avg: null, light: "gray", stages };
  const avg = valid.reduce((s, x) => s + x.ratioPct, 0) / valid.length;
  return { avg, light: trafficLight(avg), stages };
}

/** @param {Record<string, unknown>} row */
export function evaluateOrganicoYoutube(row) {
  const views = Number(row.views_totais);
  const cliques = Number(row.cliques_link);
  const vendas = Number(row.vendas);
  const metaCliques = views * 0.02;
  const metaVendas = cliques * 0.025;
  const stages = [
    { label: "Cliques (meta: 2% das views)", ratioPct: ratioPct(cliques, metaCliques) },
    { label: "Vendas (meta: 2,5% dos cliques)", ratioPct: ratioPct(vendas, metaVendas) },
  ];
  return overallFromStages(stages);
}

/** @param {Record<string, unknown>} row */
export function evaluatePagoMetaVsl(row) {
  const lp = Number(row.chegada_lp);
  const cliques = Number(row.cliques_cta);
  const taxaCliques = lp > 0 ? (cliques / lp) * 100 : null;
  const stages = [
    { label: "Taxa reprodução VSL (meta 70%)", ratioPct: ratioPct(row.taxa_reproducao_vsl, 70) },
    { label: "Taxa retenção (meta 40%)", ratioPct: ratioPct(row.taxa_retencao, 40) },
    {
      label: "Cliques no CTA vs LP (meta 10%)",
      ratioPct: taxaCliques != null ? ratioPct(taxaCliques, 10) : null,
    },
    { label: "Conversão checkout (meta 30%)", ratioPct: ratioPct(row.conversao_checkout, 30) },
    { label: "ROAS (meta 5)", ratioPct: ratioPct(row.roas, 5) },
  ];
  return overallFromStages(stages);
}

/** @param {Record<string, unknown>} row */
export function evaluatePagoGoogleLp(row) {
  const lp = Number(row.chegada_lp);
  const chk = Number(row.chegada_checkout);
  const taxaChk = lp > 0 ? (chk / lp) * 100 : null;
  const stages = [
    { label: "Taxa conversão LP (meta 8%)", ratioPct: ratioPct(row.taxa_conversao_lp, 8) },
    {
      label: "Chegada checkout vs LP (meta 80%)",
      ratioPct: taxaChk != null ? ratioPct(taxaChk, 80) : null,
    },
    { label: "Conversão checkout (meta 30%)", ratioPct: ratioPct(row.conversao_checkout, 30) },
    { label: "ROAS (meta 3)", ratioPct: ratioPct(row.roas, 3) },
  ];
  return overallFromStages(stages);
}

/**
 * Webinário: cliques_cta e conversao_checkout informados como percentuais (0–100), conforme metas.
 * @param {Record<string, unknown>} row
 */
export function evaluateWebinario(row) {
  const stages = [
    { label: "Taxa inscrição (meta 25%)", ratioPct: ratioPct(row.taxa_inscricao, 25) },
    { label: "Taxa presença (meta 50%)", ratioPct: ratioPct(row.taxa_presenca, 50) },
    {
      label: "Permanência até pitch (meta 80%)",
      ratioPct: ratioPct(row.permanencia_ate_pitch, 80),
    },
    { label: "Taxa cliques CTA (meta 30%)", ratioPct: ratioPct(row.cliques_cta, 30) },
    { label: "Conversão checkout (meta 50%)", ratioPct: ratioPct(row.conversao_checkout, 50) },
    { label: "ROAS (meta 5)", ratioPct: ratioPct(row.roas, 5) },
  ];
  return overallFromStages(stages);
}

/** @param {Record<string, unknown>} row */
export function evaluateOrganicoInstagram(row) {
  const alcance = Number(row.alcance_total);
  const visitas = Number(row.visitas_pagina);
  const vendas = Number(row.vendas);
  const metaVisitas = alcance * 0.02;
  const metaVendas = visitas * 0.02;
  const stages = [
    { label: "Visitas à página (meta 2% do alcance)", ratioPct: ratioPct(visitas, metaVisitas) },
    { label: "Vendas (meta 2% das visitas)", ratioPct: ratioPct(vendas, metaVendas) },
  ];
  return overallFromStages(stages);
}

/** @param {Record<string, unknown>} row */
export function evaluateOrganicoYoutubeLow(row) {
  const views = Number(row.views_totais);
  const visitas = Number(row.visitas_lp);
  const vendas = Number(row.vendas);
  const metaVisitas = views * 0.02;
  const metaVendas = visitas * 0.025;
  const stages = [
    { label: "Visitas LP (meta 2% das views)", ratioPct: ratioPct(visitas, metaVisitas) },
    { label: "Vendas (meta 2,5% das visitas)", ratioPct: ratioPct(vendas, metaVendas) },
  ];
  return overallFromStages(stages);
}

/** @param {Record<string, unknown>} row */
export function evaluatePagoLowticket(row) {
  const lp = Number(row.chegada_lp);
  const chk = Number(row.chegada_checkout);
  const taxaChk = lp > 0 ? (chk / lp) * 100 : null;
  const stages = [
    { label: "Taxa conversão LP (meta 10%)", ratioPct: ratioPct(row.taxa_conversao_lp, 10) },
    {
      label: "Chegada checkout vs LP (meta 80%)",
      ratioPct: taxaChk != null ? ratioPct(taxaChk, 80) : null,
    },
    { label: "Conversão checkout (meta 30%)", ratioPct: ratioPct(row.conversao_checkout, 30) },
    { label: "ROAS (meta 1)", ratioPct: ratioPct(row.roas, 1) },
  ];
  return overallFromStages(stages);
}

export const FUNNEL_EVALUATORS = {
  "organico-youtube": { title: "Orgânico YouTube", evaluate: evaluateOrganicoYoutube },
  "pago-meta-vsl": { title: "Pago Meta (VSL)", evaluate: evaluatePagoMetaVsl },
  "pago-google-lp": { title: "Pago Google (LP)", evaluate: evaluatePagoGoogleLp },
  webinario: { title: "Webinário", evaluate: evaluateWebinario },
  "organico-instagram": { title: "Orgânico Instagram", evaluate: evaluateOrganicoInstagram },
  "organico-youtube-lowticket": {
    title: "Orgânico YouTube Low Ticket",
    evaluate: evaluateOrganicoYoutubeLow,
  },
  "pago-lowticket": { title: "Pago Low Ticket", evaluate: evaluatePagoLowticket },
};

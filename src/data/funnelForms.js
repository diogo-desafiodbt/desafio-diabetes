/** @typedef {{ key: string, label: string, step?: string, hint?: string }} FieldDef */

/** @type {Record<string, { table: string, title: string, nav: string, fields: FieldDef[] }>} */
export const FUNNEL_FORMS = {
  "organico-youtube": {
    table: "funil_organico_youtube",
    title: "Funil 1 — Orgânico YouTube",
    nav: "1 · YouTube",
    fields: [
      { key: "views_totais", label: "Views totais", step: "1" },
      { key: "cliques_link", label: "Cliques no link", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "pago-meta-vsl": {
    table: "funil_pago_meta_vsl",
    title: "Funil 2 — Pago Meta (VSL)",
    nav: "2 · Meta VSL",
    fields: [
      { key: "valor_investido", label: "Valor investido (R$)", step: "0.01" },
      { key: "chegada_lp", label: "Chegadas na LP", step: "1" },
      {
        key: "taxa_reproducao_vsl",
        label: "Taxa de reprodução VSL (%)",
        step: "0.1",
        hint: "Meta: 70%",
      },
      { key: "taxa_retencao", label: "Taxa de retenção (%)", step: "0.1", hint: "Meta: 40%" },
      { key: "cliques_cta", label: "Cliques no CTA", step: "1", hint: "Meta: 10% das chegadas na LP" },
      { key: "chegada_checkout", label: "Chegadas no checkout", step: "1" },
      {
        key: "conversao_checkout",
        label: "Conversão checkout (%)",
        step: "0.1",
        hint: "Meta: 30%",
      },
      { key: "vendas", label: "Vendas", step: "1" },
      { key: "custo_por_venda", label: "Custo por venda (R$)", step: "0.01" },
      { key: "roas", label: "ROAS", step: "0.01", hint: "Meta: 5" },
    ],
  },
  "pago-google-lp": {
    table: "funil_pago_google_lp",
    title: "Funil 3 — Pago Google (LP)",
    nav: "3 · Google LP",
    fields: [
      { key: "valor_investido", label: "Valor investido (R$)", step: "0.01" },
      { key: "chegada_lp", label: "Chegadas na LP", step: "1" },
      { key: "taxa_conversao_lp", label: "Taxa conversão LP (%)", step: "0.1", hint: "Meta: 8%" },
      { key: "chegada_checkout", label: "Chegadas no checkout", step: "1" },
      {
        key: "conversao_checkout",
        label: "Conversão checkout (%)",
        step: "0.1",
        hint: "Meta: 30%",
      },
      { key: "vendas", label: "Vendas", step: "1" },
      { key: "custo_por_venda", label: "Custo por venda (R$)", step: "0.01" },
      { key: "roas", label: "ROAS", step: "0.01", hint: "Meta: 3" },
    ],
  },
  webinario: {
    table: "funil_webinario",
    title: "Funil 4 — Webinário",
    nav: "4 · Webinário",
    fields: [
      { key: "valor_investido", label: "Valor investido (R$)", step: "0.01" },
      { key: "taxa_inscricao", label: "Taxa de inscrição (%)", step: "0.1", hint: "Meta: 25%" },
      { key: "taxa_presenca", label: "Taxa de presença (%)", step: "0.1", hint: "Meta: 50%" },
      {
        key: "permanencia_ate_pitch",
        label: "Permanência até o pitch (%)",
        step: "0.1",
        hint: "Meta: 80%",
      },
      {
        key: "cliques_cta",
        label: "Taxa de cliques no CTA (%)",
        step: "0.1",
        hint: "Meta: 30% — informe como percentual",
      },
      {
        key: "conversao_checkout",
        label: "Conversão checkout (%)",
        step: "0.1",
        hint: "Meta: 50%",
      },
      { key: "vendas", label: "Vendas", step: "1" },
      { key: "custo_por_venda", label: "Custo por venda (R$)", step: "0.01" },
      { key: "roas", label: "ROAS", step: "0.01", hint: "Meta: 5" },
    ],
  },
  "organico-instagram": {
    table: "funil_organico_instagram",
    title: "Funil 5 — Orgânico Instagram",
    nav: "5 · Instagram",
    fields: [
      { key: "alcance_total", label: "Alcance total", step: "1" },
      { key: "visitas_pagina", label: "Visitas à página", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "organico-youtube-lowticket": {
    table: "funil_organico_youtube_lowticket",
    title: "Funil 6 — Orgânico YouTube Low Ticket",
    nav: "6 · YT Low",
    fields: [
      { key: "views_totais", label: "Views totais", step: "1" },
      { key: "visitas_lp", label: "Visitas à LP", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "pago-lowticket": {
    table: "funil_pago_lowticket",
    title: "Funil 7 — Pago Low Ticket",
    nav: "7 · Pago Low",
    fields: [
      { key: "valor_investido", label: "Valor investido (R$)", step: "0.01" },
      { key: "chegada_lp", label: "Chegadas na LP", step: "1" },
      { key: "taxa_conversao_lp", label: "Taxa conversão LP (%)", step: "0.1", hint: "Meta: 10%" },
      { key: "chegada_checkout", label: "Chegadas no checkout", step: "1" },
      {
        key: "conversao_checkout",
        label: "Conversão checkout (%)",
        step: "0.1",
        hint: "Meta: 30%",
      },
      { key: "vendas", label: "Vendas", step: "1" },
      { key: "custo_por_venda", label: "Custo por venda (R$)", step: "0.01" },
      { key: "roas", label: "ROAS", step: "0.01", hint: "Meta: 1" },
    ],
  },
};

export const FUNNEL_SLUGS = Object.keys(FUNNEL_FORMS);

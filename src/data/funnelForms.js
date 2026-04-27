/** @typedef {{ key: string, label: string, step?: string, hint?: string }} FieldDef */

/** @type {Record<string, { table: string, title: string, nav: string, fields: FieldDef[] }>} */
export const FUNNEL_FORMS = {
  "instagram-organico": {
    table: "funil_organico_instagram",
    title: "Instagram Orgânico — Questionário Metabólico",
    nav: "Instagram · Orgânico",
    fields: [
      { key: "views", label: "Views", step: "1" },
      { key: "cliques", label: "Cliques", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "youtube-questionario": {
    table: "funil_organico_youtube_questionario",
    title: "YouTube Orgânico — Aplicativo",
    nav: "YouTube · Questionário",
    fields: [
      { key: "views_totais", label: "Views totais", step: "1" },
      { key: "cliques_link", label: "Cliques QR Code", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "youtube-livro": {
    table: "funil_organico_youtube_livro",
    title: "YouTube Orgânico — Livro",
    nav: "YouTube · Livro",
    fields: [
      { key: "views_totais", label: "Views totais", step: "1" },
      { key: "cliques_link", label: "Cliques QR Code", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "youtube-suplemento": {
    table: "funil_organico_youtube_suplemento",
    title: "YouTube Orgânico — Suplemento",
    nav: "YouTube · Suplemento",
    fields: [
      { key: "views_totais", label: "Views totais", step: "1" },
      { key: "cliques_link", label: "Cliques QR Code", step: "1" },
      { key: "vendas", label: "Vendas", step: "1" },
    ],
  },
  "pago-meta": {
    table: "funil_pago_meta_questionario",
    title: "Pago Meta — Questionário Web",
    nav: "Meta · Pago",
    fields: [
      { key: "valor_investido", label: "Valor Investido R$", step: "0.01" },
      { key: "vendas", label: "Vendas Realizadas", step: "1" },
    ],
  },
};

export const FUNNEL_SLUGS = Object.keys(FUNNEL_FORMS);

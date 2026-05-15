/*
 * --- SQL Supabase (rodar manualmente no SQL Editor) ---
 *
 * create table public.metas (
 *   id uuid primary key default gen_random_uuid(),
 *   funil_slug text not null,
 *   metrica text not null,
 *   valor_meta numeric not null,
 *   periodo text not null,
 *   responsavel text,
 *   created_at timestamptz not null default now()
 * );
 *
 * create index if not exists metas_funil_slug_idx on public.metas (funil_slug);
 *
 * -- Opcional: RLS conforme sua política de segurança
 * -- alter table public.metas enable row level security;
 *
 * create table if not exists public.kpis_mensais (
 *   mes text primary key,
 *   -- Audiência
 *   views_totais numeric, meta_views numeric,
 *   inscritos_novos numeric, meta_inscritos numeric,
 *   clicks_totais numeric, meta_clicks numeric,
 *   click_rate numeric, meta_click_rate numeric,
 *   -- Vendas
 *   suplementos_vendidos numeric, meta_suplementos numeric,
 *   compradores_total numeric, meta_compradores numeric,
 *   taxa_recompra numeric, meta_taxa_recompra numeric,
 *   livros_vendidos numeric, meta_livros numeric,
 *   vendas_pagas_livro numeric, meta_vendas_pagas_livro numeric,
 *   -- Financeiro
 *   faturamento numeric, meta_faturamento numeric,
 *   receita_suplemento numeric, meta_receita_suplemento numeric,
 *   receita_livro numeric, meta_receita_livro numeric,
 *   receita_app numeric, meta_receita_app numeric,
 *   receita_adsense numeric, meta_receita_adsense numeric,
 *   pro_labore numeric, meta_pro_labore numeric,
 *   margem_operacional numeric, meta_margem_operacional numeric,
 *   -- Tráfego pago
 *   orcamento_pago numeric, meta_orcamento_pago numeric,
 *   cac_livro numeric, meta_cac_livro numeric,
 *   margem_campanha numeric, meta_margem_campanha numeric,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * create table if not exists public.comentarios_acoes (
 *   id uuid primary key default gen_random_uuid(),
 *   acao_id uuid not null references public.acoes (id) on delete cascade,
 *   autor text not null,
 *   texto text not null,
 *   created_at timestamptz not null default now()
 * );
 * create index if not exists comentarios_acoes_acao_id_idx on public.comentarios_acoes (acao_id);
 *
 * -- Migration: controle de comentários vistos por usuário (nome em dd_user)
 * alter table public.comentarios_acoes
 *   add column if not exists visto_por text[] not null default '{}';
 *
 * ------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWindowSize } from "../hooks/useWindowSize";
import { FUNNEL_FORMS, FUNNEL_SLUGS } from "../data/funnelForms";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { evaluateOrganicoYoutube, overallFromStages, ratioPct } from "../utils/semaphores";
import { getFormAbsoluteUrl } from "../utils/formUrls";

const C = {
  bg: "#F4F6FA",
  primary: "#FF0028",
  dark: "#0D1B3E",
  white: "#FFFFFF",
};

const cardEnterprise = {
  background: "#fff",
  borderRadius: 12,
  border: "0.5px solid #e8ecf0",
  padding: 18,
};

const sidebarShell = {
  width: 240,
  flexShrink: 0,
  minHeight: "100vh",
  background: C.dark,
  display: "flex",
  flexDirection: "column",
  padding: "20px 0",
  boxSizing: "border-box",
};

const navSectionLabel = {
  fontSize: 9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)",
  margin: "20px 16px 8px",
  fontFamily: "Inter, sans-serif",
  fontWeight: 600,
};

const GERAL_METRIC_OPTIONS = [
  { key: "views", label: "Views" },
  { key: "cliques", label: "Cliques" },
  { key: "vendas", label: "Vendas" },
  { key: "valor_investido", label: "Valor Investido" },
  { key: "outros", label: "Outros" },
];

function readDdUser() {
  try {
    const raw = sessionStorage.getItem("dd_user");
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || !o.nome) return null;
    return { nome: String(o.nome), email: o.email != null ? String(o.email) : "" };
  } catch {
    return null;
  }
}

function readComentarioAutorNome() {
  try {
    const raw = sessionStorage.getItem("usuario");
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object" && o.nome) {
        const n = String(o.nome).trim();
        if (n) return n;
      }
    }
  } catch {
    /* ignore */
  }
  return readDdUser()?.nome?.trim() || "—";
}

function parseVistoPor(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return [s];
    }
    return [s];
  }
  return [];
}

function isComentarioNaoVisto(comentario, viewerNome) {
  const viewer = String(viewerNome ?? "").trim();
  if (!viewer || viewer === "—") return false;
  const autor = String(comentario?.autor ?? "").trim();
  if (!autor || autor === viewer) return false;
  const visto = parseVistoPor(comentario?.visto_por);
  return !visto.includes(viewer);
}

function formatComentarioDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function metaMetricaDisplayLabel(funilSlug, storedKey) {
  if (!storedKey) return "—";
  if (funilSlug === "geral") {
    const g = GERAL_METRIC_OPTIONS.find((x) => x.key === storedKey);
    if (g) return g.label;
  }
  const f = FUNNEL_FORMS[funilSlug]?.fields?.find((x) => x.key === storedKey);
  if (f) return f.label;
  return String(storedKey);
}

function getISOWeek(date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function lightToBarColor(light) {
  if (light === "green") return "#22c55e";
  if (light === "yellow") return "#eab308";
  if (light === "red") return "#ef4444";
  return "#94a3b8";
}

/** Alinha `FUNNEL_FORMS` (tabelas reais) com a lógica de semáforo (campos do formulário). */
function evaluateInstagramOrganicoQuestionario(row) {
  const views = Number(row?.views);
  const cliques = Number(row?.cliques);
  const vendas = Number(row?.vendas);
  const metaCliques = views * 0.02;
  const metaVendas = cliques * 0.025;
  return overallFromStages([
    { label: "Cliques (meta: 2% das views)", ratioPct: ratioPct(cliques, metaCliques) },
    { label: "Vendas (meta: 2,5% dos cliques)", ratioPct: ratioPct(vendas, metaVendas) },
  ]);
}

/** Funil pago Meta — questionário (valor_investido, vendas). */
function evaluatePagoMetaQuestionario(row) {
  const vendas = Number(row?.vendas);
  const inv = Number(row?.valor_investido);
  if (!Number.isFinite(vendas)) {
    return overallFromStages([{ label: "Vendas", ratioPct: null }]);
  }
  if (!Number.isFinite(inv) || inv <= 0) {
    return overallFromStages([{ label: "Vendas (meta referência 10)", ratioPct: ratioPct(vendas, 10) }]);
  }
  const receitaEst = vendas * 100;
  const roas = receitaEst / inv;
  return overallFromStages([{ label: "ROAS estimado (meta 2x)", ratioPct: ratioPct(roas, 2) }]);
}

/** @param {string} slug @param {Record<string, unknown> | null | undefined} row */
export function evaluateFunnelRow(slug, row) {
  if (!row) return null;
  if (slug === "instagram-organico") return evaluateInstagramOrganicoQuestionario(row);
  if (slug === "youtube-questionario" || slug === "youtube-livro" || slug === "youtube-suplemento") {
    return evaluateOrganicoYoutube(row);
  }
  if (slug === "pago-meta") return evaluatePagoMetaQuestionario(row);
  return null;
}

function currentMesYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabelChart(mesYYYYMM) {
  const [y, mo] = String(mesYYYYMM).split("-").map(Number);
  if (!y || !mo) return "—";
  const d = new Date(y, mo - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "short" });
  return s.replace(/\./g, "").replace(/^\w/, (c) => c.toUpperCase());
}

function pctMeta(atual, meta) {
  const a = Number(atual);
  const m = Number(meta);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (!Number.isFinite(a)) return null;
  return (a / m) * 100;
}

function kpiBarColor(pct) {
  if (pct == null || !Number.isFinite(pct)) return "#94a3b8";
  if (pct >= 100) return "#22c55e";
  if (pct >= 70) return "#eab308";
  return "#ef4444";
}

function formatMoneyBRL(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const KPI_FORM_SECTIONS = [
  {
    id: "audiencia",
    title: "Audiência",
    pairs: [
      { key: "views_totais", metaKey: "meta_views", label: "Views Totais", metaLabel: "Meta Views", kind: "num" },
      { key: "inscritos_novos", metaKey: "meta_inscritos", label: "Inscritos Novos", metaLabel: "Meta Inscritos", kind: "num" },
      { key: "clicks_totais", metaKey: "meta_clicks", label: "Clicks Totais", metaLabel: "Meta Clicks", kind: "num" },
      { key: "click_rate", metaKey: "meta_click_rate", label: "Click Rate (%)", metaLabel: "Meta Click Rate (%)", kind: "pct" },
    ],
  },
  {
    id: "vendas",
    title: "Vendas",
    pairs: [
      { key: "suplementos_vendidos", metaKey: "meta_suplementos", label: "Suplementos Vendidos", metaLabel: "Meta Suplementos", kind: "num" },
      { key: "compradores_total", metaKey: "meta_compradores", label: "Compradores Total", metaLabel: "Meta Compradores", kind: "num" },
      { key: "taxa_recompra", metaKey: "meta_taxa_recompra", label: "Taxa de Recompra (%)", metaLabel: "Meta Taxa Recompra (%)", kind: "pct" },
      { key: "livros_vendidos", metaKey: "meta_livros", label: "Livros (Primeiro Passo) Vendidos", metaLabel: "Meta Livros", kind: "num" },
      { key: "vendas_pagas_livro", metaKey: "meta_vendas_pagas_livro", label: "Vendas Pagas Livro", metaLabel: "Meta Vendas Pagas Livro", kind: "num" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    pairs: [
      { key: "faturamento", metaKey: "meta_faturamento", label: "Faturamento Total (R$)", metaLabel: "Meta Faturamento (R$)", kind: "money" },
      { key: "receita_suplemento", metaKey: "meta_receita_suplemento", label: "Receita Suplemento (R$)", metaLabel: "Meta Receita Suplemento (R$)", kind: "money" },
      { key: "receita_livro", metaKey: "meta_receita_livro", label: "Receita Livro (R$)", metaLabel: "Meta Receita Livro (R$)", kind: "money" },
      { key: "receita_app", metaKey: "meta_receita_app", label: "Receita App (R$)", metaLabel: "Meta Receita App (R$)", kind: "money" },
      { key: "receita_adsense", metaKey: "meta_receita_adsense", label: "Receita AdSense (R$)", metaLabel: "Meta Receita AdSense (R$)", kind: "money" },
      { key: "pro_labore", metaKey: "meta_pro_labore", label: "Pró-labore (R$)", metaLabel: "Meta Pró-labore (R$)", kind: "money" },
      { key: "margem_operacional", metaKey: "meta_margem_operacional", label: "Margem Operacional (%)", metaLabel: "Meta Margem Operacional (%)", kind: "pct" },
    ],
  },
  {
    id: "trafego_pago",
    title: "Tráfego Pago",
    pairs: [
      { key: "orcamento_pago", metaKey: "meta_orcamento_pago", label: "Orçamento Pago (R$)", metaLabel: "Meta Orçamento (R$)", kind: "money" },
      { key: "cac_livro", metaKey: "meta_cac_livro", label: "CAC Livro (R$)", metaLabel: "Meta CAC Livro (R$)", kind: "money" },
      { key: "margem_campanha", metaKey: "meta_margem_campanha", label: "Margem da Campanha (%)", metaLabel: "Meta Margem Campanha (%)", kind: "pct" },
    ],
  },
];

const KPI_FORM_KEYS = KPI_FORM_SECTIONS.flatMap((s) => s.pairs.flatMap((p) => [p.key, p.metaKey]));

function emptyKpiForm() {
  return Object.fromEntries(KPI_FORM_KEYS.map((k) => [k, ""]));
}

function dbValueToKpiFormField(val) {
  if (val == null || val === "") return "";
  return String(val);
}

function kpiFormFieldToDb(val) {
  const s = String(val ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Unifica colunas legadas com os nomes atuais de kpis_mensais. */
function normalizeKpiMensaisRow(row) {
  if (!row) return null;
  return {
    ...row,
    suplementos_vendidos: row.suplementos_vendidos ?? row.suplementos ?? null,
    livros_vendidos: row.livros_vendidos ?? row.livros ?? null,
    receita_app: row.receita_app ?? row.downloads_app ?? row.downloads ?? null,
    meta_receita_app: row.meta_receita_app ?? row.meta_downloads ?? null,
  };
}

const KPI_FIELD_LEGACY = {
  suplementos_vendidos: ["suplementos"],
  livros_vendidos: ["livros"],
  receita_app: ["downloads_app", "downloads"],
  meta_receita_app: ["meta_downloads"],
};

function getKpiField(row, key) {
  if (!row || !key) return null;
  const primary = row[key];
  if (primary != null && primary !== "") return primary;
  const legacy = KPI_FIELD_LEGACY[key];
  if (!legacy) return null;
  for (const alt of legacy) {
    const v = row[alt];
    if (v != null && v !== "") return v;
  }
  return null;
}

const KPI_RECEITA_PART_KEYS = ["receita_suplemento", "receita_livro", "receita_app", "receita_adsense"];
const KPI_META_RECEITA_PART_KEYS = [
  "meta_receita_suplemento",
  "meta_receita_livro",
  "meta_receita_app",
  "meta_receita_adsense",
];

function sumKpiNumericParts(row, keys) {
  if (!row) return null;
  let sum = 0;
  let has = false;
  keys.forEach((k) => {
    const n = Number(getKpiField(row, k) ?? row[k]);
    if (Number.isFinite(n)) {
      sum += n;
      has = true;
    }
  });
  return has ? sum : null;
}

/** Receita total: faturamento ou soma das receitas do bloco Financeiro. */
function kpiReceitaTotal(row) {
  const normalized = normalizeKpiMensaisRow(row);
  if (!normalized) return null;
  const fat = Number(getKpiField(normalized, "faturamento"));
  if (Number.isFinite(fat)) return fat;
  return sumKpiNumericParts(normalized, KPI_RECEITA_PART_KEYS);
}

function kpiMetaReceitaTotal(row) {
  const normalized = normalizeKpiMensaisRow(row);
  if (!normalized) return null;
  const meta = Number(getKpiField(normalized, "meta_faturamento"));
  if (Number.isFinite(meta)) return meta;
  return sumKpiNumericParts(normalized, KPI_META_RECEITA_PART_KEYS);
}

function formatKpiMetricValue(val, kind) {
  if (val == null || val === "") return "—";
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  if (kind === "money") return formatMoneyBRL(n);
  if (kind === "pct") return `${n.toLocaleString("pt-BR")}%`;
  return fmtCell(n);
}

function formatKpiMetaLine(meta, kind) {
  if (meta == null || meta === "") return "Meta: —";
  const n = Number(meta);
  if (!Number.isFinite(n)) return "Meta: —";
  if (kind === "money") return `Meta: ${formatMoneyBRL(n)}`;
  if (kind === "pct") return `Meta: ${n.toLocaleString("pt-BR")}%`;
  return `Meta: ${fmtCell(n)}`;
}

const KPI_ACCORDION_DEFS = [
  {
    id: "financeiro",
    title: "💰 FINANCEIRO",
    primary: { type: "receita_total" },
    details: [
      { label: "Receita Suplemento", key: "receita_suplemento", metaKey: "meta_receita_suplemento", kind: "money" },
      { label: "Receita Livro", key: "receita_livro", metaKey: "meta_receita_livro", kind: "money" },
      { label: "Receita App", key: "receita_app", metaKey: "meta_receita_app", kind: "money" },
      { label: "Receita AdSense", key: "receita_adsense", metaKey: "meta_receita_adsense", kind: "money" },
      { label: "Pró-labore", key: "pro_labore", metaKey: "meta_pro_labore", kind: "money" },
      { label: "Margem Operacional (%)", key: "margem_operacional", metaKey: "meta_margem_operacional", kind: "pct" },
    ],
  },
  {
    id: "suplemento",
    title: "💊 SUPLEMENTO",
    primary: { key: "compradores_total", metaKey: "meta_compradores", kind: "num" },
    details: [
      { label: "Suplementos Vendidos", key: "suplementos_vendidos", metaKey: "meta_suplementos", kind: "num" },
      { label: "Taxa de Recompra (%)", key: "taxa_recompra", metaKey: "meta_taxa_recompra", kind: "pct" },
      { label: "Receita Suplemento", key: "receita_suplemento", metaKey: "meta_receita_suplemento", kind: "money" },
    ],
  },
  {
    id: "primeiro_passo",
    title: "📖 PRIMEIRO PASSO",
    primary: { key: "livros_vendidos", metaKey: "meta_livros", kind: "num" },
    details: [
      { label: "Vendas Pagas Livro", key: "vendas_pagas_livro", metaKey: "meta_vendas_pagas_livro", kind: "num" },
      { label: "CAC Livro (R$)", key: "cac_livro", metaKey: "meta_cac_livro", kind: "money" },
      { label: "Margem Campanha (%)", key: "margem_campanha", metaKey: "meta_margem_campanha", kind: "pct" },
      { label: "Receita Livro", key: "receita_livro", metaKey: "meta_receita_livro", kind: "money" },
    ],
  },
  {
    id: "audiencia",
    title: "📣 AUDIÊNCIA",
    primary: { key: "views_totais", metaKey: "meta_views", kind: "num" },
    details: [
      { label: "Inscritos Novos", key: "inscritos_novos", metaKey: "meta_inscritos", kind: "num" },
      { label: "Clicks Totais", key: "clicks_totais", metaKey: "meta_clicks", kind: "num" },
      { label: "Click Rate (%)", key: "click_rate", metaKey: "meta_click_rate", kind: "pct" },
    ],
  },
];

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" opacity="0.95" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.95" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.95" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" opacity="0.95" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 21v-5h5M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResponsavelAvatar({ nome }) {
  const letter = (nome && nome.trim()[0]) ? nome.trim()[0].toUpperCase() : "?";
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#e8ecf0",
        color: C.dark,
        fontSize: 11,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {letter}
    </span>
  );
}

function parseDateOnlyYmd(str) {
  if (!str || typeof str !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = Number(m[1], 10);
  const mo = Number(m[2], 10) - 1;
  const d = Number(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo, d);
}

function startOfTodayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDaysLocal(date, days) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function calendarDiffDays(fromStartOfDay, toStartOfDay) {
  const a = new Date(fromStartOfDay.getFullYear(), fromStartOfDay.getMonth(), fromStartOfDay.getDate()).getTime();
  const b = new Date(toStartOfDay.getFullYear(), toStartOfDay.getMonth(), toStartOfDay.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function formatPrazoDdMmYyyy(date) {
  if (!date) return "—";
  try {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function vencendoPrazoColor(prazoDate, todayStart) {
  const diff = calendarDiffDays(todayStart, prazoDate);
  if (diff < 0) return "#ef4444";
  if (diff <= 2) return "#eab308";
  if (diff >= 3 && diff <= 7) return "#22c55e";
  return "#555555";
}

function funnelStatusBadge(light, compact) {
  const label =
    light === "green" ? "No objetivo" : light === "yellow" ? "Atenção" : light === "red" ? "Abaixo" : "Sem dados";
  const bg = lightToBarColor(light);
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: compact ? "2px 8px" : "4px 10px",
        borderRadius: 20,
        background: bg,
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function fmtCell(v) {
  if (v == null) return "—";
  return typeof v === "number" ? v.toLocaleString("pt-BR") : String(v);
}

function StagePctSpot({ pct }) {
  const cor = pct == null ? "#94a3b8" : pct >= 100 ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444";
  const label = pct == null ? "s/d" : `${pct.toFixed(1)}%`;
  return (
    <span style={{ background: cor, color: "#fff", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{label}</span>
  );
}

function FunnelSidebarEmbed({ slug, row, onBack, isMobile }) {
  const cfg = FUNNEL_FORMS[slug];
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!cfg) return null;

  const url = getFormAbsoluteUrl(slug);
  const ev = evaluateFunnelRow(slug, row);
  const stageMap = {};
  (ev?.stages ?? []).forEach((s) => {
    stageMap[s.label] = s.ratioPct;
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCopied(true);
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: C.white,
          color: C.dark,
          border: "1px solid #e2e8f0",
          padding: "8px 14px",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 20,
        }}
      >
        ← Voltar
      </button>
      <h1
        style={{
          margin: "0 0 20px",
          fontSize: isMobile ? 17 : 22,
          fontWeight: 700,
          color: C.dark,
          fontFamily: "Inter, sans-serif",
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}
      >
        {cfg.title}
      </h1>

      <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
        <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 16, marginBottom: 12, fontWeight: 700 }}>
          Link de preenchimento
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, wordBreak: "break-all", fontFamily: "Inter, sans-serif" }}>{url}</p>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? "#16a34a" : C.primary,
            color: C.white,
            border: "none",
            padding: "10px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {copied ? "Copiado!" : "Copiar Link"}
        </button>
      </section>

      <section style={{ ...cardEnterprise, border: "0.5px solid #e8ecf0" }}>
        <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 16, marginBottom: 14, fontWeight: 700 }}>
          Semana atual
        </h2>
        {!row ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Sem dados</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {cfg.fields.map((f) => {
              const pct = stageMap[f.label];
              return (
                <li
                  key={f.key}
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isMobile ? "flex-start" : "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#64748b", fontFamily: "Inter, sans-serif" }}>{f.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{fmtCell(row[f.key])}</span>
                    {pct !== undefined && <StagePctSpot pct={pct} />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const ddUser = readDdUser();
  const userNome = ddUser?.nome ?? "—";
  const userEmail = ddUser?.email ?? "";
  const userInitial = userNome && userNome !== "—" ? userNome.trim()[0].toUpperCase() : "?";
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [vencendoResponsavel, setVencendoResponsavel] = useState("Todos");
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [novaTarefaTexto, setNovaTarefaTexto] = useState("");
  const [novaTarefaFunil, setNovaTarefaFunil] = useState("");
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState("");
  const [novaTarefaResponsavel, setNovaTarefaResponsavel] = useState("");
  const [melhoriaNova, setMelhoriaNova] = useState({ texto: "", prazo: "", responsavel: "" });
  const [sidebarTab, setSidebarTab] = useState("dashboard");
  const [funnelDetailSlug, setFunnelDetailSlug] = useState(null);
  const [metasList, setMetasList] = useState([]);
  const [metaFunil, setMetaFunil] = useState("");
  const [metaMetrica, setMetaMetrica] = useState("");
  const [metaValor, setMetaValor] = useState("");
  const [metaPeriodo, setMetaPeriodo] = useState("semanal");
  const [metaResponsavel, setMetaResponsavel] = useState("");

  const [kpiMesAtualRow, setKpiMesAtualRow] = useState(null);
  const [kpisChart6, setKpisChart6] = useState([]);

  const [kpiFormMes, setKpiFormMes] = useState(() => currentMesYYYYMM());
  const [kpiForm, setKpiForm] = useState(emptyKpiForm);
  const [kpiFormSaving, setKpiFormSaving] = useState(false);
  const [kpiFormFeedback, setKpiFormFeedback] = useState(null);
  const [expandedKpiCard, setExpandedKpiCard] = useState(null);

  const [commentsModal, setCommentsModal] = useState(null);
  const [comentariosList, setComentariosList] = useState([]);
  const [comentariosLoading, setComentariosLoading] = useState(false);
  const [comentariosError, setComentariosError] = useState(null);
  const [novoComentarioTexto, setNovoComentarioTexto] = useState("");
  const [comentarioSubmitting, setComentarioSubmitting] = useState(false);
  const [comentariosNaoVistos, setComentariosNaoVistos] = useState({});

  const loadComentariosNaoVistosCount = useCallback(async (acaoIds) => {
    if (!supabase || !acaoIds?.length) {
      setComentariosNaoVistos({});
      return;
    }
    const viewer = readComentarioAutorNome();
    if (!viewer || viewer === "—") {
      setComentariosNaoVistos({});
      return;
    }
    const { data, error } = await supabase
      .from("comentarios_acoes")
      .select("id, acao_id, autor, visto_por")
      .in("acao_id", acaoIds);
    if (error) {
      setComentariosNaoVistos({});
      return;
    }
    const counts = Object.fromEntries(acaoIds.map((id) => [id, 0]));
    (data ?? []).forEach((c) => {
      if (!isComentarioNaoVisto(c, viewer)) return;
      const aid = c.acao_id;
      if (aid) counts[aid] = (counts[aid] ?? 0) + 1;
    });
    setComentariosNaoVistos(counts);
  }, []);

  const markComentariosVistos = useCallback(
    async (acaoId) => {
      if (!supabase || !acaoId) return;
      const viewer = readComentarioAutorNome();
      if (!viewer || viewer === "—") return;
      const { data, error } = await supabase
        .from("comentarios_acoes")
        .select("id, autor, visto_por")
        .eq("acao_id", acaoId);
      if (error || !data?.length) {
        setComentariosNaoVistos((prev) => ({ ...prev, [acaoId]: 0 }));
        return;
      }
      const toMark = data.filter((c) => isComentarioNaoVisto(c, viewer));
      if (toMark.length === 0) {
        setComentariosNaoVistos((prev) => ({ ...prev, [acaoId]: 0 }));
        return;
      }
      await Promise.all(
        toMark.map((c) => {
          const visto = parseVistoPor(c.visto_por);
          if (visto.includes(viewer)) return Promise.resolve();
          return supabase
            .from("comentarios_acoes")
            .update({ visto_por: [...visto, viewer] })
            .eq("id", c.id);
        })
      );
      setComentariosNaoVistos((prev) => ({ ...prev, [acaoId]: 0 }));
    },
    []
  );

  const loadPendingActions = useCallback(async () => {
    if (!supabase) {
      setPendingActions([]);
      return;
    }
    const { data, error } = await supabase.from("acoes").select("*").eq("concluido", false);
    if (error) {
      setPendingActions([]);
      return;
    }
    const items = (data ?? [])
      .filter((item) => item?.id && item?.texto)
      .map((item) => {
        const slug = item.funil_slug ?? "";
        return {
          id: item.id,
          texto: item.texto,
          prazo: item.prazo ?? "",
          responsavel: item.responsavel ?? "",
          slug,
          funnelTitle: FUNNEL_FORMS[slug]?.title ?? slug,
        };
      });
    setPendingActions(items);
    await loadComentariosNaoVistosCount(items.map((i) => i.id));
  }, [loadComentariosNaoVistosCount]);

  const loadComentarios = useCallback(async (acaoId) => {
    if (!supabase || !acaoId) {
      setComentariosList([]);
      return;
    }
    setComentariosLoading(true);
    setComentariosError(null);
    const { data, error } = await supabase
      .from("comentarios_acoes")
      .select("id, autor, texto, created_at")
      .eq("acao_id", acaoId)
      .order("created_at", { ascending: true });
    setComentariosLoading(false);
    if (error) {
      setComentariosError(error.message ?? "Erro ao carregar comentários.");
      setComentariosList([]);
      return;
    }
    setComentariosList(data ?? []);
  }, []);

  const openCommentsModal = (item) => {
    if (!item?.id) return;
    setCommentsModal({ id: item.id, titulo: item.texto ?? "Tarefa" });
    setNovoComentarioTexto("");
    setComentariosError(null);
    setComentariosList([]);
    loadComentarios(item.id);
    markComentariosVistos(item.id);
  };

  const closeCommentsModal = () => {
    setCommentsModal(null);
    setComentariosList([]);
    setNovoComentarioTexto("");
    setComentariosError(null);
  };

  const submitComentario = async () => {
    if (!supabase || !commentsModal?.id) return;
    const texto = novoComentarioTexto.trim();
    if (!texto) return;
    setComentarioSubmitting(true);
    setComentariosError(null);
    const autor = readComentarioAutorNome();
    const { error } = await supabase.from("comentarios_acoes").insert([{ acao_id: commentsModal.id, autor, texto }]);
    setComentarioSubmitting(false);
    if (error) {
      setComentariosError(error.message ?? "Erro ao enviar comentário.");
      return;
    }
    setNovoComentarioTexto("");
    await loadComentarios(commentsModal.id);
  };

  const vencendoEmBreveList = useMemo(() => {
    const todayStart = startOfTodayLocal();
    const endWindow = addDaysLocal(todayStart, 7);
    const inWindow = pendingActions
      .filter((item) => item.slug !== "sistema")
      .map((item) => {
        const prazoDate = parseDateOnlyYmd(item.prazo);
        if (!prazoDate) return null;
        if (prazoDate > endWindow) return null;
        if (prazoDate >= todayStart && prazoDate <= endWindow) return { ...item, _prazoDate: prazoDate };
        if (prazoDate < todayStart) return { ...item, _prazoDate: prazoDate };
        return null;
      })
      .filter(Boolean);
    inWindow.sort((a, b) => a._prazoDate.getTime() - b._prazoDate.getTime());
    const withPrazoColor = inWindow.map((item) => ({
      ...item,
      _prazoColor: vencendoPrazoColor(item._prazoDate, todayStart),
    }));
    if (vencendoResponsavel === "Todos") return withPrazoColor;
    return withPrazoColor.filter((item) => (item.responsavel ?? "") === vencendoResponsavel);
  }, [pendingActions, vencendoResponsavel]);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const mesRef = currentMesYYYYMM();

      const funnelEntriesPromise = Promise.all(
        Object.entries(FUNNEL_FORMS).map(async ([slug, cfg]) => {
          const { data, error } = await supabase
            .from(cfg.table)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          return [slug, data];
        })
      );

      const [entries, curKpi, sixKpi] = await Promise.all([
        funnelEntriesPromise,
        supabase.from("kpis_mensais").select("*").eq("mes", mesRef).maybeSingle(),
        supabase.from("kpis_mensais").select("*").order("mes", { ascending: false }).limit(6),
      ]);

      setRows(Object.fromEntries(entries));

      if (!curKpi.error) setKpiMesAtualRow(normalizeKpiMensaisRow(curKpi.data ?? null));
      else setKpiMesAtualRow(null);
      if (!sixKpi.error && Array.isArray(sixKpi.data)) {
        setKpisChart6(
          [...sixKpi.data]
            .map((r) => normalizeKpiMensaisRow(r))
            .filter(Boolean)
            .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
        );
      } else {
        setKpisChart6([]);
      }
    } catch (e) {
      setErr(e?.message ?? "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKpiFormRow = useCallback(async () => {
    if (!supabase || !kpiFormMes) return;
    setKpiFormFeedback(null);
    const { data, error } = await supabase.from("kpis_mensais").select("*").eq("mes", kpiFormMes).maybeSingle();
    if (error || !data) {
      setKpiForm(emptyKpiForm());
      return;
    }
    const next = emptyKpiForm();
    KPI_FORM_KEYS.forEach((key) => {
      next[key] = dbValueToKpiFormField(data[key]);
    });
    setKpiForm(next);
  }, [kpiFormMes]);

  const setKpiFormField = (field, value) => {
    setKpiForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveKpisMensais = async () => {
    if (!supabase) return;
    setKpiFormSaving(true);
    setKpiFormFeedback(null);
    const row = { mes: kpiFormMes };
    KPI_FORM_SECTIONS.forEach((section) => {
      section.pairs.forEach((pair) => {
        row[pair.key] = kpiFormFieldToDb(kpiForm[pair.key]);
        row[pair.metaKey] = kpiFormFieldToDb(kpiForm[pair.metaKey]);
      });
    });
    const { error } = await supabase.from("kpis_mensais").upsert(row, { onConflict: "mes" });
    setKpiFormSaving(false);
    if (error) {
      setKpiFormFeedback({ ok: false, text: error.message ?? "Erro ao salvar KPIs." });
      return;
    }
    setKpiFormFeedback({ ok: true, text: "KPIs do mês salvos." });
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPendingActions();
  }, [loadPendingActions]);

  const loadMetas = useCallback(async () => {
    if (!supabase) {
      setMetasList([]);
      return;
    }
    const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
    if (error) {
      setMetasList([]);
      return;
    }
    setMetasList(data ?? []);
  }, []);

  useEffect(() => {
    if (sidebarTab === "metas") loadMetas();
  }, [sidebarTab, loadMetas]);

  useEffect(() => {
    if (sidebarTab === "metas") loadKpiFormRow();
  }, [sidebarTab, kpiFormMes, loadKpiFormRow]);

  const updatePendingAction = async (id, patch) => {
    if (!supabase) return;
    const { error } = await supabase.from("acoes").update(patch).eq("id", id);
    if (!error) loadPendingActions();
  };

  const completePendingAction = async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from("acoes").update({ concluido: true }).eq("id", id);
    if (!error) loadPendingActions();
  };

  const saveNovaTarefa = async () => {
    const texto = novaTarefaTexto.trim();
    if (!texto || !novaTarefaFunil || !supabase) return;
    const { error } = await supabase.from("acoes").insert([
      {
        funil_slug: novaTarefaFunil,
        texto,
        prazo: novaTarefaPrazo || null,
        responsavel: novaTarefaResponsavel || null,
      },
    ]);
    if (error) return;
    setNovaTarefaOpen(false);
    setNovaTarefaTexto("");
    setNovaTarefaFunil("");
    setNovaTarefaPrazo("");
    setNovaTarefaResponsavel("");
    loadPendingActions();
  };

  const cancelNovaTarefa = () => {
    setNovaTarefaOpen(false);
    setNovaTarefaTexto("");
    setNovaTarefaFunil("");
    setNovaTarefaPrazo("");
    setNovaTarefaResponsavel("");
  };

  const addMelhoriaSistema = async () => {
    const texto = melhoriaNova.texto.trim();
    if (!texto || !supabase) return;
    const { error } = await supabase.from("acoes").insert([
      {
        funil_slug: "sistema",
        texto,
        prazo: melhoriaNova.prazo || null,
        responsavel: melhoriaNova.responsavel || null,
      },
    ]);
    if (error) return;
    setMelhoriaNova({ texto: "", prazo: "", responsavel: "" });
    loadPendingActions();
  };

  const mainPendingActions = pendingActions.filter((item) => item.slug !== "sistema");
  const sistemaPendingActions = pendingActions.filter((item) => item.slug === "sistema");
  const pendingTasksCount = pendingActions.length;

  const metasGrouped = useMemo(() => {
    const buckets = {};
    metasList.forEach((m) => {
      const k = m.funil_slug ?? "geral";
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(m);
    });
    const order = [...FUNNEL_SLUGS, "geral"];
    return order.filter((k) => buckets[k]?.length).map((k) => [k, buckets[k]]);
  }, [metasList]);

  const receitaChartSeries = useMemo(
    () =>
      kpisChart6.map((row) => ({
        mes: row.mes,
        value: kpiReceitaTotal(row),
        meta: kpiMetaReceitaTotal(row),
      })),
    [kpisChart6]
  );

  const receitaChartMax = useMemo(() => {
    const nums = receitaChartSeries.map((p) => p.value).filter((n) => Number.isFinite(n));
    const m = nums.length ? Math.max(...nums) : 0;
    return m > 0 ? m : 1;
  }, [receitaChartSeries]);

  const kpiAccordionCards = useMemo(() => {
    const r = kpiMesAtualRow;
    return KPI_ACCORDION_DEFS.map((def) => {
      let primaryCurr;
      let primaryMeta;
      let primaryKind;
      if (def.primary.type === "receita_total") {
        primaryCurr = kpiReceitaTotal(r);
        primaryMeta = kpiMetaReceitaTotal(r);
        primaryKind = "money";
      } else {
        primaryCurr = getKpiField(r, def.primary.key);
        primaryMeta = getKpiField(r, def.primary.metaKey);
        primaryKind = def.primary.kind;
      }
      const primaryPct = r ? pctMeta(primaryCurr, primaryMeta) : null;
      const details = def.details.map((d) => {
        const curr = getKpiField(r, d.key);
        const meta = getKpiField(r, d.metaKey);
        const pct = r ? pctMeta(curr, meta) : null;
        return {
          label: d.label,
          display: formatKpiMetricValue(curr, d.kind),
          pct,
        };
      });
      return {
        id: def.id,
        title: def.title,
        primaryDisplay: formatKpiMetricValue(primaryCurr, primaryKind),
        primaryPct,
        metaLine: formatKpiMetaLine(primaryMeta, primaryKind),
        details,
      };
    });
  }, [kpiMesAtualRow]);

  const metaMetricaOptions = useMemo(() => {
    if (!metaFunil) return [];
    if (metaFunil === "geral") return GERAL_METRIC_OPTIONS;
    return (FUNNEL_FORMS[metaFunil]?.fields ?? []).map((f) => ({ key: f.key, label: f.label }));
  }, [metaFunil]);

  const addMeta = async () => {
    if (!supabase || !metaFunil || !metaMetrica || !metaResponsavel) return;
    const num = Number(String(metaValor).replace(",", "."));
    if (!Number.isFinite(num)) return;
    const { error } = await supabase.from("metas").insert([
      {
        funil_slug: metaFunil,
        metrica: metaMetrica,
        valor_meta: num,
        periodo: metaPeriodo,
        responsavel: metaResponsavel,
      },
    ]);
    if (error) return;
    setMetaMetrica("");
    setMetaValor("");
    loadMetas();
  };

  const deleteMeta = async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from("metas").delete().eq("id", id);
    if (!error) loadMetas();
  };

  const goTab = (tab) => {
    setFunnelDetailSlug(null);
    setSidebarTab(tab);
    setMobileNavOpen(false);
  };

  const tabNavActive = (tab) => funnelDetailSlug == null && sidebarTab === tab;

  const refWeekDate = useMemo(() => {
    let best = null;
    for (const row of Object.values(rows)) {
      if (!row?.data_semana) continue;
      const s = String(row.data_semana);
      const iso = s.length === 10 ? `${s}T12:00:00` : s;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      if (!best || d > best) best = d;
    }
    return best;
  }, [rows]);

  const weekIndicatorText = useMemo(() => {
    if (!refWeekDate) return "Sem dados da semana";
    return `Semana ${getISOWeek(refWeekDate)}, ${refWeekDate.getFullYear()}`;
  }, [refWeekDate]);

  const { isMobile } = useWindowSize(768);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileNavOpen) {
      document.body.style.overflow = "";
      return undefined;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileNavOpen]);

  const asideStyle = useMemo(() => {
    if (!isMobile) return sidebarShell;
    return {
      ...sidebarShell,
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      width: 260,
      zIndex: 1002,
      transform: mobileNavOpen ? "translateX(0)" : "translateX(-100%)",
      transition: "transform 0.25s ease",
      boxShadow: mobileNavOpen ? "8px 0 32px rgba(0,0,0,0.28)" : "none",
      pointerEvents: mobileNavOpen ? "auto" : "none",
    };
  }, [isMobile, mobileNavOpen]);

  const mainPadding = isMobile ? "56px 14px 28px" : "28px 32px 48px";
  const gridMinKpi = isMobile ? "minmax(140px, 1fr)" : "minmax(200px, 1fr)";
  const gridMinFunnel = isMobile ? "minmax(200px, 1fr)" : "minmax(260px, 1fr)";
  const gridMinForm = isMobile ? "minmax(140px, 1fr)" : "minmax(200px, 1fr)";
  const gridMinMeta = isMobile ? "minmax(140px, 1fr)" : "minmax(180px, 1fr)";
  const pendingRowBase = {
    background: "#f8fafc",
    borderRadius: 10,
    border: "0.5px solid #e8ecf0",
    padding: isMobile ? "12px 12px" : "10px 12px",
    fontFamily: "Inter, sans-serif",
    position: "relative",
  };

  const renderComentariosNaoVistosBadge = (acaoId) => {
    const n = comentariosNaoVistos[acaoId] ?? 0;
    if (!n) return null;
    const label = n === 1 ? "1 comentário não visto" : `${n} comentários não vistos`;
    return (
      <span
        aria-label={label}
        title={label}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          minWidth: 20,
          height: 20,
          padding: "0 6px",
          borderRadius: 999,
          background: C.primary,
          color: C.white,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          zIndex: 1,
          boxSizing: "border-box",
        }}
      >
        {n > 99 ? "99+" : n}
      </span>
    );
  };
  const pendingRowStyle = isMobile
    ? { ...pendingRowBase, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 10 }
    : {
        ...pendingRowBase,
        display: "grid",
        gridTemplateColumns: "24px minmax(180px, 1fr) minmax(200px, 1fr) 160px 170px",
        gap: 10,
        alignItems: "center",
      };
  const sistemaRowStyle = isMobile
    ? { ...pendingRowBase, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 10 }
    : {
        ...pendingRowBase,
        display: "grid",
        gridTemplateColumns: "24px minmax(180px, 1fr) 160px 170px",
        gap: 10,
        alignItems: "center",
      };
  const dateInputCompact = {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    color: C.dark,
    background: C.white,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const inputFieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    color: C.dark,
    background: C.white,
  };

  const selectFieldStyle = {
    ...inputFieldStyle,
    fontSize: 13,
    padding: "10px 12px",
  };

  const taskTextHoverHandlers = {
    onMouseEnter: (e) => {
      e.currentTarget.style.backgroundColor = "rgba(13, 27, 62, 0.07)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.backgroundColor = "transparent";
    },
  };

  const kpiFormInputStep = (kind) => (kind === "num" ? "1" : "any");

  const renderKpiFormSection = (section) => (
    <div
      key={section.id}
      style={{
        marginBottom: 16,
        borderRadius: 12,
        border: "0.5px solid #e8ecf0",
        overflow: "hidden",
        background: C.white,
      }}
    >
      <div
        style={{
          background: C.dark,
          color: C.white,
          padding: "12px 16px",
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {section.title}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {section.pairs.map((pair) => (
          <div
            key={pair.key}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                {pair.label}
              </label>
              <input
                type="number"
                step={kpiFormInputStep(pair.kind)}
                value={kpiForm[pair.key] ?? ""}
                onChange={(e) => setKpiFormField(pair.key, e.target.value)}
                style={inputFieldStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                {pair.metaLabel}
              </label>
              <input
                type="number"
                step={kpiFormInputStep(pair.kind)}
                value={kpiForm[pair.metaKey] ?? ""}
                onChange={(e) => setKpiFormField(pair.metaKey, e.target.value)}
                style={inputFieldStyle}
              />
            </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderNovaTarefaForm = (opts = {}) => {
    const { showCancel } = opts;
    return (
      <div id="form-nova-tarefa-top" style={{ ...cardEnterprise, marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: "Inter, sans-serif",
            color: C.dark,
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Nova tarefa
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, ${gridMinForm})`,
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Descrição
            </label>
            <input
              type="text"
              value={novaTarefaTexto}
              onChange={(e) => setNovaTarefaTexto(e.target.value)}
              placeholder="Descrição da tarefa"
              style={inputFieldStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Funil
            </label>
            <select value={novaTarefaFunil} onChange={(e) => setNovaTarefaFunil(e.target.value)} style={selectFieldStyle}>
              <option value="" disabled>
                Selecione o funil
              </option>
              {Object.entries(FUNNEL_FORMS).map(([slug, cfg]) => (
                <option key={slug} value={slug}>
                  {cfg.title}
                </option>
              ))}
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Prazo
            </label>
            <input type="date" value={novaTarefaPrazo} onChange={(e) => setNovaTarefaPrazo(e.target.value)} style={selectFieldStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Responsável
            </label>
            <select
              value={novaTarefaResponsavel}
              onChange={(e) => setNovaTarefaResponsavel(e.target.value)}
              style={selectFieldStyle}
            >
              <option value="">—</option>
              <option value="Diogo">Diogo</option>
              <option value="Turí">Turí</option>
              <option value="Pedro">Pedro</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={saveNovaTarefa}
            style={{
              background: C.primary,
              color: C.white,
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Salvar
          </button>
          {showCancel && (
            <button
              type="button"
              onClick={cancelNovaTarefa}
              style={{
                background: C.white,
                color: C.dark,
                border: "1px solid #e2e8f0",
                padding: "10px 20px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, sans-serif", background: C.bg, position: "relative" }}>
        {isMobile && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: 52,
              zIndex: 999,
              background: C.dark,
              display: "flex",
              alignItems: "center",
              padding: "0 10px 0 8px",
              gap: 10,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              boxSizing: "border-box",
            }}
          >
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
              style={{
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: C.white,
                cursor: "pointer",
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              <IconMenu />
            </button>
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              Desafio Diabetes
            </span>
          </div>
        )}
        {isMobile && mobileNavOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1001,
              border: "none",
              margin: 0,
              padding: 0,
              background: "rgba(0,0,0,0.45)",
              cursor: "pointer",
            }}
          />
        )}
        <aside style={asideStyle}>
          <div style={{ padding: "0 16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/Logo Vertical (3).png"
                alt="Desafio Diabetes"
                style={{ width: 40, height: 40, objectFit: "contain" }}
              />
              <div>
                <div style={{ color: C.white, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Desafio Diabetes</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "0.08em", marginTop: 4 }}>
                  DASHBOARD CEO
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "16px 16px 20px", marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF0028 0%, #991b1b 100%)",
                  color: C.white,
                  fontSize: 14,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {userInitial}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {userNome}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userEmail || "Administrador"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("dd_user");
                navigate("/login", { replace: true });
              }}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.08)",
                color: C.white,
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Sair
            </button>
          </div>
        </aside>
        <main style={{ flex: 1, padding: isMobile ? "56px 14px 24px" : "28px 32px", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ ...cardEnterprise, maxWidth: 720 }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 8, fontWeight: 700 }}>
              Configuração do Supabase
            </h2>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
              Defina <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>REACT_APP_SUPABASE_URL</code>{" "}
              e{" "}
              <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>REACT_APP_SUPABASE_ANON_KEY</code>{" "}
              no arquivo <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>.env</code>.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        color: C.dark,
        background: C.bg,
        position: "relative",
      }}
    >
      <style>{`
        @keyframes dashPulseGreen {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); }
          50% { opacity: 0.75; box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); }
        }
      `}</style>
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 52,
            zIndex: 999,
            background: C.dark,
            display: "flex",
            alignItems: "center",
            padding: "0 10px 0 8px",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMobileNavOpen(true)}
            style={{
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: C.white,
              cursor: "pointer",
              borderRadius: 8,
              flexShrink: 0,
            }}
          >
            <IconMenu />
          </button>
          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {weekIndicatorText.length > 42 ? `${weekIndicatorText.slice(0, 40)}…` : weekIndicatorText}
          </span>
        </div>
      )}
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1001,
            border: "none",
            margin: 0,
            padding: 0,
            background: "rgba(0,0,0,0.45)",
            cursor: "pointer",
          }}
        />
      )}
      <aside style={asideStyle}>
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/Logo Vertical (3).png"
              alt="Desafio Diabetes"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
            <div>
              <div style={{ color: C.white, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Desafio Diabetes</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "0.08em", marginTop: 4 }}>
                DASHBOARD CEO
              </div>
            </div>
          </div>
        </div>

        <div style={navSectionLabel}>VISÃO GERAL</div>
        <button
          type="button"
          onClick={() => goTab("dashboard")}
          style={{
            margin: "0 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            background: tabNavActive("dashboard") ? "rgba(255,0,40,0.15)" : "transparent",
            borderLeft: tabNavActive("dashboard") ? "2px solid #FF0028" : "2px solid transparent",
            color: tabNavActive("dashboard") ? C.white : "rgba(255,255,255,0.5)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span style={{ display: "flex", color: tabNavActive("dashboard") ? C.white : "rgba(255,255,255,0.45)" }}>
            <IconGrid />
          </span>
          📊 Dashboard
        </button>
        <button
          type="button"
          onClick={() => goTab("tarefas")}
          style={{
            margin: "6px 12px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 12px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            background: tabNavActive("tarefas") ? "rgba(255,0,40,0.15)" : "transparent",
            borderLeft: tabNavActive("tarefas") ? "2px solid #FF0028" : "2px solid transparent",
            color: tabNavActive("tarefas") ? C.white : "rgba(255,255,255,0.5)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", color: tabNavActive("tarefas") ? C.white : "rgba(255,255,255,0.45)" }}>
              <IconCheck />
            </span>
            ✅ Tarefas
          </span>
          {pendingTasksCount > 0 && (
            <span
              style={{
                background: C.primary,
                color: C.white,
                fontSize: 10,
                fontWeight: 700,
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
              }}
            >
              {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => goTab("metas")}
          style={{
            margin: "6px 12px 0",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            width: "calc(100% - 24px)",
            boxSizing: "border-box",
            background: tabNavActive("metas") ? "rgba(255,0,40,0.15)" : "transparent",
            borderLeft: tabNavActive("metas") ? "2px solid #FF0028" : "2px solid transparent",
            color: tabNavActive("metas") ? C.white : "rgba(255,255,255,0.5)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          🎯 Metas
        </button>
        <button
          type="button"
          onClick={() => goTab("melhorias")}
          style={{
            margin: "6px 12px 0",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            width: "calc(100% - 24px)",
            boxSizing: "border-box",
            background: tabNavActive("melhorias") ? "rgba(255,0,40,0.15)" : "transparent",
            borderLeft: tabNavActive("melhorias") ? "2px solid #FF0028" : "2px solid transparent",
            color: tabNavActive("melhorias") ? C.white : "rgba(255,255,255,0.5)",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          🛠️ Melhorias
        </button>

        <div style={navSectionLabel}>FUNIS</div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
          {Object.entries(FUNNEL_FORMS).map(([slug, cfg]) => {
            const row = rows[slug];
            const ev = evaluateFunnelRow(slug, row);
            const light = ev?.light ?? "gray";
            const dotColor = lightToBarColor(light);
            const funnelSelected = funnelDetailSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => {
                  setFunnelDetailSlug(slug);
                  setMobileNavOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 10px",
                  marginBottom: 4,
                  border: "none",
                  borderRadius: 8,
                  background: funnelSelected ? "rgba(255,255,255,0.06)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {cfg.title}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "16px 16px 20px", marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FF0028 0%, #991b1b 100%)",
                color: C.white,
                fontSize: 14,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {userInitial}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: C.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                {userNome}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userEmail || "Administrador"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("dd_user");
              navigate("/login", { replace: true });
            }}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.08)",
              color: C.white,
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: mainPadding, boxSizing: "border-box" }}>
        {funnelDetailSlug && FUNNEL_FORMS[funnelDetailSlug] ? (
          <FunnelSidebarEmbed
            slug={funnelDetailSlug}
            row={rows[funnelDetailSlug]}
            onBack={() => setFunnelDetailSlug(null)}
            isMobile={isMobile}
          />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                flexWrap: "wrap",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isMobile ? 12 : 16,
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 17 : 20,
                    fontWeight: 700,
                    color: C.dark,
                    fontFamily: "Inter, sans-serif",
                    lineHeight: 1.2,
                  }}
                >
                  {sidebarTab === "dashboard"
                    ? "Visão geral"
                    : sidebarTab === "tarefas"
                      ? "Tarefas"
                      : sidebarTab === "metas"
                        ? "Metas"
                        : "Melhorias"}
                </h1>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    flexShrink: 0,
                    animation: "dashPulseGreen 2s ease-in-out infinite",
                  }}
                  aria-hidden
                />
                {!isMobile && (
                  <span style={{ fontSize: 13, color: "#64748b", fontFamily: "Inter, sans-serif" }}>{weekIndicatorText}</span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "stretch",
                  width: isMobile ? "100%" : "auto",
                  justifyContent: isMobile ? "stretch" : "flex-end",
                }}
              >
                {(sidebarTab === "dashboard" || sidebarTab === "metas" || sidebarTab === "melhorias") && (
                  <button
                    type="button"
                    onClick={() => {
                      load();
                      if (sidebarTab === "metas") loadMetas();
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: C.white,
                      color: C.dark,
                      border: "1px solid #e2e8f0",
                      padding: "10px 18px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      ...(isMobile ? { width: "100%", justifyContent: "center", minHeight: 44, boxSizing: "border-box" } : {}),
                    }}
                  >
                    <IconRefresh />
                    Atualizar
                  </button>
                )}
                {sidebarTab === "dashboard" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (novaTarefaOpen) cancelNovaTarefa();
                      else setNovaTarefaOpen(true);
                    }}
                    style={{
                      background: C.primary,
                      color: C.white,
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      fontWeight: 700,
                      ...(isMobile ? { width: "100%", minHeight: 44, boxSizing: "border-box" } : {}),
                    }}
                  >
                    + Nova Tarefa
                  </button>
                )}
                {sidebarTab === "tarefas" && (
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("form-nova-tarefa-top")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    style={{
                      background: C.primary,
                      color: C.white,
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 14,
                      fontWeight: 700,
                      ...(isMobile ? { width: "100%", minHeight: 44, boxSizing: "border-box" } : {}),
                    }}
                  >
                    + Nova Tarefa
                  </button>
                )}
              </div>
            </div>

            {sidebarTab === "dashboard" && novaTarefaOpen && renderNovaTarefaForm({ showCancel: true })}
            {sidebarTab === "tarefas" && renderNovaTarefaForm({ showCancel: false })}

        {err && (
          <div
            style={{
              ...cardEnterprise,
              marginBottom: 24,
              borderColor: "#fecaca",
              background: "#fef2f2",
              fontSize: 14,
              color: C.dark,
            }}
          >
            {err}
          </div>
        )}

        {sidebarTab === "dashboard" && (
          <>
            {loading ? (
              <p style={{ color: "#64748b", fontFamily: "Inter, sans-serif" }}>Carregando…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, ${gridMinKpi})`,
                    gap: 14,
                  }}
                >
                  {kpiAccordionCards.map((card) => {
                    const expanded = expandedKpiCard === card.id;
                    const barW =
                      card.primaryPct != null && Number.isFinite(card.primaryPct)
                        ? `${Math.min(100, Math.max(0, card.primaryPct))}%`
                        : "0%";
                    const barBg = kpiBarColor(card.primaryPct);
                    const pctBadgeText =
                      card.primaryPct != null && Number.isFinite(card.primaryPct)
                        ? `${card.primaryPct.toFixed(1)}%`
                        : "—";
                    const pctBadgeBg =
                      card.primaryPct != null && Number.isFinite(card.primaryPct) ? barBg : "#94a3b8";
                    const toggleCard = () => {
                      setExpandedKpiCard((prev) => (prev === card.id ? null : card.id));
                    };
                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        onClick={toggleCard}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleCard();
                          }
                        }}
                        style={{
                          ...cardEnterprise,
                          border: "0.5px solid #e8ecf0",
                          fontFamily: "Inter, sans-serif",
                          position: "relative",
                          cursor: "pointer",
                          paddingBottom: 36,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ paddingRight: 28 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              fontWeight: 600,
                              letterSpacing: "1px",
                              textTransform: "uppercase",
                              marginBottom: 10,
                            }}
                          >
                            {card.title}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: C.dark,
                                letterSpacing: "-0.02em",
                                lineHeight: 1.15,
                                wordBreak: "break-word",
                              }}
                            >
                              {card.primaryDisplay}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "4px 10px",
                                borderRadius: 20,
                                background: pctBadgeBg,
                                color: C.white,
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              {pctBadgeText}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: "#f1f5f9",
                              borderRadius: 4,
                              overflow: "hidden",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: barW,
                                background: barBg,
                                borderRadius: 4,
                                transition: "width 0.35s ease",
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{card.metaLine}</div>
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            right: 14,
                            bottom: 14,
                            fontSize: 12,
                            color: "#94a3b8",
                            lineHeight: 1,
                            pointerEvents: "none",
                          }}
                          aria-hidden
                        >
                          {expanded ? "▲" : "▼"}
                        </span>
                        <div
                          style={{
                            maxHeight: expanded ? 520 : 0,
                            opacity: expanded ? 1 : 0,
                            overflow: "hidden",
                            transition: "max-height 0.35s ease, opacity 0.28s ease",
                          }}
                        >
                          <div
                            style={{
                              borderTop: "1px solid #e8ecf0",
                              background: "#f8fafc",
                              padding: 16,
                              marginTop: 4,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                                gap: 12,
                              }}
                            >
                              {card.details.map((row) => (
                                <div
                                  key={row.label}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    minWidth: 0,
                                  }}
                                >
                                  <span style={{ fontSize: 12, color: "#64748b", flex: 1, minWidth: 0 }}>
                                    {row.label}
                                  </span>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: kpiBarColor(row.pct),
                                        flexShrink: 0,
                                      }}
                                      aria-hidden
                                    />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{row.display}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </div>

                <section
                  style={{
                    background: C.white,
                    borderRadius: 12,
                    border: "0.5px solid #e8ecf0",
                    padding: 20,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.dark }}>
                    Receita mensal (últimos 6 meses)
                  </h2>
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
                    Faturamento total ou soma de receitas (suplemento, livro, app e AdSense) cadastradas na aba Metas.
                  </p>
                  {receitaChartSeries.length === 0 || receitaChartSeries.every((p) => p.value == null) ? (
                    <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>Sem dados de receita.</p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: isMobile ? 4 : 10,
                        minHeight: isMobile ? 130 : 160,
                        paddingTop: 8,
                      }}
                    >
                      {receitaChartSeries.map((point) => {
                        const v = point.value;
                        const hPct = Number.isFinite(v) && receitaChartMax > 0 ? (v / receitaChartMax) * 100 : 0;
                        const metaLabel =
                          point.meta != null && Number.isFinite(point.meta)
                            ? ` · Meta ${formatMoneyBRL(point.meta)}`
                            : "";
                        return (
                          <div
                            key={point.mes}
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}
                          >
                            <div
                              style={{
                                width: "100%",
                                maxWidth: isMobile ? 36 : 48,
                                height: isMobile ? 100 : 120,
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                title={v == null ? "Sem dado" : `${formatMoneyBRL(v)}${metaLabel}`}
                                style={{
                                  width: "72%",
                                  height: `${Math.max(4, hPct)}%`,
                                  background: C.primary,
                                  borderRadius: "6px 6px 2px 2px",
                                  minHeight: v == null ? 0 : 4,
                                  opacity: v == null ? 0.25 : 1,
                                  transition: "height 0.35s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: isMobile ? 9 : 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textAlign: "center",
                                lineHeight: 1.2,
                                wordBreak: "break-word",
                              }}
                            >
                              {mesLabelChart(point.mes)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </section>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, ${gridMinFunnel})`,
                    gap: 14,
                  }}
                >
                  {Object.entries(FUNNEL_FORMS).map(([slug, cfg]) => {
                    const row = rows[slug];
                    const ev = evaluateFunnelRow(slug, row);
                    const light = ev?.light ?? "gray";
                    const avg = ev?.avg;
                    const pct = avg != null && Number.isFinite(avg) ? Math.min(100, Math.max(0, avg)) : null;
                    const barColor = lightToBarColor(light);
                    const fillPct = pct != null ? `${pct}%` : "0%";
                    const fields = cfg.fields ?? [];
                    const first = fields[0];
                    const rest = fields.slice(1);
                    const primaryText =
                      row && first ? fmtCell(row[first.key]) : "—";
                    const secondaryLine = rest
                      .map((f) => `${f.label}: ${row ? fmtCell(row[f.key]) : "—"}`)
                      .join(" · ");
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => navigate(`/funil/${slug}`)}
                        style={{
                          ...cardEnterprise,
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          border: "0.5px solid #e8ecf0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {cfg.title}
                          </span>
                          {funnelStatusBadge(light, true)}
                        </div>
                        {first && (
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                            {first.label}
                          </div>
                        )}
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 6, letterSpacing: "-0.02em" }}>
                          {first ? primaryText : "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            fontWeight: 500,
                            marginBottom: 10,
                            lineHeight: 1.45,
                            minHeight: 16,
                          }}
                        >
                          {secondaryLine || "\u00a0"}
                        </div>
                        <div style={{ height: 2, background: "#f1f5f9", borderRadius: 1, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{ height: "100%", width: fillPct, background: barColor, borderRadius: 1, transition: "width 0.3s ease" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                          {pct != null ? `${pct.toFixed(1)}% da meta semanal` : "Sem dados da meta semanal"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {sidebarTab === "tarefas" && (
          <>
            <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                Vencendo em Breve
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {["Todos", "Diogo", "Turí", "Pedro"].map((label) => {
                  const active = vencendoResponsavel === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setVencendoResponsavel(label)}
                      style={{
                        background: active ? "#FF0028" : "#FFFFFF",
                        color: active ? "#FFFFFF" : C.dark,
                        border: active ? "none" : "1px solid #e2e8f0",
                        padding: "8px 16px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {vencendoEmBreveList.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma tarefa vencendo nos próximos 7 dias.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {vencendoEmBreveList.map((item) => {
                    const resp = (item.responsavel ?? "").trim() || "—";
                    const softBg =
                      item._prazoColor === "#ef4444"
                        ? "#fff8f8"
                        : item._prazoColor === "#eab308"
                          ? "#fffbeb"
                          : item._prazoColor === "#22c55e"
                            ? "#f0fdf4"
                            : "#f8fafc";
                    return (
                      <li
                        key={`${item.slug}-${item.id}-vencendo`}
                        style={{
                          background: softBg,
                          borderRadius: 10,
                          border: "0.5px solid #e8ecf0",
                          padding: "12px 14px",
                          fontSize: 14,
                          color: C.dark,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          lineHeight: 1.45,
                          fontFamily: "Inter, sans-serif",
                          position: "relative",
                        }}
                      >
                        {renderComentariosNaoVistosBadge(item.id)}
                        <ResponsavelAvatar nome={resp} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <button
                            type="button"
                            {...taskTextHoverHandlers}
                            onClick={() => openCommentsModal(item)}
                            style={{
                              margin: 0,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              font: "inherit",
                              fontWeight: 600,
                              cursor: "pointer",
                              color: C.dark,
                              borderRadius: 6,
                              textAlign: "left",
                              display: "inline",
                            }}
                          >
                            {item.texto}
                          </button>
                          <span style={{ color: "#94a3b8" }}> · </span>
                          <span style={{ color: "#64748b" }}>{item.funnelTitle}</span>
                          <span style={{ color: "#94a3b8" }}> · </span>
                          <span style={{ color: "#64748b" }}>{resp}</span>
                          <span style={{ color: "#94a3b8" }}> · </span>
                          <span style={{ color: item._prazoColor, fontWeight: 600 }}>{formatPrazoDdMmYyyy(item._prazoDate)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                Ações Pendentes
              </h2>
              {mainPendingActions.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma ação pendente.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {mainPendingActions.map((item) => (
                    <li key={`${item.slug}-${item.id}`} style={pendingRowStyle}>
                      {renderComentariosNaoVistosBadge(item.id)}
                      {isMobile ? (
                        <>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <input
                              type="checkbox"
                              onChange={() => completePendingAction(item.id)}
                              style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary, flexShrink: 0, marginTop: 2 }}
                              aria-label={`Concluir ação ${item.texto}`}
                            />
                            <button
                              type="button"
                              {...taskTextHoverHandlers}
                              onClick={() => openCommentsModal(item)}
                              style={{
                                margin: 0,
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                fontFamily: "Inter, sans-serif",
                                fontSize: 14,
                                color: C.dark,
                                flex: 1,
                                minWidth: 0,
                                wordBreak: "break-word",
                                cursor: "pointer",
                                borderRadius: 6,
                                textAlign: "left",
                              }}
                            >
                              {item.texto}
                            </button>
                          </div>
                          <span style={{ fontSize: 13, color: "#64748b" }}>{item.funnelTitle}</span>
                          <input
                            type="date"
                            value={item.prazo}
                            onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                            style={dateInputCompact}
                          />
                          <select
                            value={item.responsavel}
                            onChange={(e) => updatePendingAction(item.id, { responsavel: e.target.value || null })}
                            style={{ ...dateInputCompact, cursor: "pointer" }}
                          >
                            <option value="">Responsável</option>
                            <option value="Diogo">Diogo</option>
                            <option value="Turí">Turí</option>
                            <option value="Pedro">Pedro</option>
                          </select>
                        </>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            onChange={() => completePendingAction(item.id)}
                            style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary }}
                            aria-label={`Concluir ação ${item.texto}`}
                          />
                          <button
                            type="button"
                            {...taskTextHoverHandlers}
                            onClick={() => openCommentsModal(item)}
                            style={{
                              margin: 0,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 14,
                              color: C.dark,
                              cursor: "pointer",
                              borderRadius: 6,
                              textAlign: "left",
                              minWidth: 0,
                            }}
                          >
                            {item.texto}
                          </button>
                          <span style={{ fontSize: 13, color: "#64748b" }}>{item.funnelTitle}</span>
                          <input
                            type="date"
                            value={item.prazo}
                            onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                            style={{ ...dateInputCompact, width: "auto" }}
                          />
                          <select
                            value={item.responsavel}
                            onChange={(e) => updatePendingAction(item.id, { responsavel: e.target.value || null })}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 13,
                              fontFamily: "Inter, sans-serif",
                              color: C.dark,
                              background: C.white,
                            }}
                          >
                            <option value="">Responsável</option>
                            <option value="Diogo">Diogo</option>
                            <option value="Turí">Turí</option>
                            <option value="Pedro">Pedro</option>
                          </select>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {sidebarTab === "metas" && (
          <>
            <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                KPIs mensais
              </h2>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
                Cadastre ou atualize realizados e metas do mês. Um único registro por <strong>mes</strong> (YYYY-MM).
              </p>
              <div style={{ marginBottom: 20, maxWidth: isMobile ? "100%" : 220 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Mês</label>
                <input
                  type="month"
                  value={kpiFormMes}
                  onChange={(e) => setKpiFormMes(e.target.value)}
                  style={inputFieldStyle}
                />
              </div>
              {KPI_FORM_SECTIONS.map(renderKpiFormSection)}
              {kpiFormFeedback && (
                <p
                  style={{
                    fontSize: 13,
                    margin: "0 0 12px",
                    fontFamily: "Inter, sans-serif",
                    color: kpiFormFeedback.ok ? "#166534" : "#b91c1c",
                    fontWeight: 600,
                  }}
                >
                  {kpiFormFeedback.text}
                </p>
              )}
              <button
                type="button"
                disabled={kpiFormSaving || !kpiFormMes || !supabase}
                onClick={saveKpisMensais}
                style={{
                  background: kpiFormSaving || !kpiFormMes ? "#fca5a5" : C.primary,
                  color: C.white,
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  cursor: kpiFormSaving || !kpiFormMes ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {kpiFormSaving ? "Salvando…" : "Salvar KPIs do Mês"}
              </button>
            </section>

            <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                Nova meta
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fill, ${gridMinMeta})`,
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Funil
                  </label>
                  <select
                    value={metaFunil}
                    onChange={(e) => {
                      setMetaFunil(e.target.value);
                      setMetaMetrica("");
                    }}
                    style={selectFieldStyle}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {FUNNEL_SLUGS.map((slug) => (
                      <option key={slug} value={slug}>
                        {FUNNEL_FORMS[slug]?.title ?? slug}
                      </option>
                    ))}
                    <option value="geral">Geral</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Métrica
                  </label>
                  <select
                    value={metaMetrica}
                    onChange={(e) => setMetaMetrica(e.target.value)}
                    disabled={!metaFunil}
                    style={{
                      ...selectFieldStyle,
                      opacity: metaFunil ? 1 : 0.6,
                      cursor: metaFunil ? "pointer" : "not-allowed",
                    }}
                  >
                    <option value="" disabled>
                      Selecione a métrica
                    </option>
                    {metaMetricaOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Valor da meta
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={metaValor}
                    onChange={(e) => setMetaValor(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Período
                  </label>
                  <select value={metaPeriodo} onChange={(e) => setMetaPeriodo(e.target.value)} style={selectFieldStyle}>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Responsável
                  </label>
                  <select value={metaResponsavel} onChange={(e) => setMetaResponsavel(e.target.value)} style={selectFieldStyle}>
                    <option value="" disabled>
                      Selecione
                    </option>
                    <option value="Diogo">Diogo</option>
                    <option value="Turí">Turí</option>
                    <option value="Pedro">Pedro</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addMeta}
                  style={{
                    background: C.primary,
                    color: C.white,
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Cadastrar meta
                </button>
              </div>
            </section>

            <section style={{ ...cardEnterprise, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                Metas cadastradas
              </h2>
              {metasGrouped.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma meta cadastrada.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {metasGrouped.map(([slugKey, lista]) => (
                    <div key={slugKey}>
                      <h3
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#64748b",
                          marginBottom: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {slugKey === "geral" ? "Geral" : FUNNEL_FORMS[slugKey]?.title ?? slugKey}
                      </h3>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                        {lista.map((m) => (
                          <li
                            key={m.id}
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              background: "#f8fafc",
                              borderRadius: 10,
                              border: "0.5px solid #e8ecf0",
                              padding: "12px 14px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: isMobile ? 0 : 200 }}>
                              <span style={{ fontWeight: 600, color: C.dark }}>
                                {metaMetricaDisplayLabel(m.funil_slug, m.metrica)}
                              </span>
                              <span style={{ color: "#94a3b8", margin: "0 8px" }}>·</span>
                              <span style={{ color: "#64748b" }}>
                                Meta: <strong>{Number(m.valor_meta).toLocaleString("pt-BR")}</strong>
                              </span>
                              <span style={{ color: "#94a3b8", margin: "0 8px" }}>·</span>
                              <span style={{ color: "#64748b" }}>{m.periodo === "mensal" ? "Mensal" : "Semanal"}</span>
                              <span style={{ color: "#94a3b8", margin: "0 8px" }}>·</span>
                              <span style={{ color: "#64748b" }}>{m.responsavel ?? "—"}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteMeta(m.id)}
                              style={{
                                background: C.white,
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                padding: "8px 14px",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                                fontSize: 13,
                                fontWeight: 600,
                              }}
                            >
                              Excluir
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {sidebarTab === "melhorias" && (
          <>
            <section style={{ ...cardEnterprise, marginBottom: 24, border: "0.5px solid #e8ecf0" }}>
              <h2 style={{ fontFamily: "Inter, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
                Melhorias do Sistema
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fill, ${gridMinForm})`,
                  gap: 12,
                  alignItems: "end",
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={melhoriaNova.texto}
                    onChange={(e) => setMelhoriaNova((s) => ({ ...s, texto: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addMelhoriaSistema()}
                    placeholder="Descreva a melhoria..."
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Prazo
                  </label>
                  <input
                    type="date"
                    value={melhoriaNova.prazo}
                    onChange={(e) => setMelhoriaNova((s) => ({ ...s, prazo: e.target.value }))}
                    style={selectFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Responsável
                  </label>
                  <select
                    value={melhoriaNova.responsavel}
                    onChange={(e) => setMelhoriaNova((s) => ({ ...s, responsavel: e.target.value }))}
                    style={selectFieldStyle}
                  >
                    <option value="">—</option>
                    <option value="Diogo">Diogo</option>
                    <option value="Turí">Turí</option>
                    <option value="Pedro">Pedro</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addMelhoriaSistema}
                  style={{
                    background: C.primary,
                    color: C.white,
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Adicionar
                </button>
              </div>
              {sistemaPendingActions.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma melhoria pendente.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {sistemaPendingActions.map((item) => (
                    <li key={`sistema-${item.id}`} style={sistemaRowStyle}>
                      {renderComentariosNaoVistosBadge(item.id)}
                      {isMobile ? (
                        <>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <input
                              type="checkbox"
                              onChange={() => completePendingAction(item.id)}
                              style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary, flexShrink: 0, marginTop: 2 }}
                              aria-label={`Concluir melhoria ${item.texto}`}
                            />
                            <button
                              type="button"
                              {...taskTextHoverHandlers}
                              onClick={() => openCommentsModal(item)}
                              style={{
                                margin: 0,
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                fontFamily: "Inter, sans-serif",
                                fontSize: 14,
                                color: C.dark,
                                flex: 1,
                                minWidth: 0,
                                wordBreak: "break-word",
                                cursor: "pointer",
                                borderRadius: 6,
                                textAlign: "left",
                              }}
                            >
                              {item.texto}
                            </button>
                          </div>
                          <input
                            type="date"
                            value={item.prazo}
                            onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                            style={dateInputCompact}
                          />
                          <select
                            value={item.responsavel}
                            onChange={(e) => updatePendingAction(item.id, { responsavel: e.target.value || null })}
                            style={{ ...dateInputCompact, cursor: "pointer" }}
                          >
                            <option value="">Responsável</option>
                            <option value="Diogo">Diogo</option>
                            <option value="Turí">Turí</option>
                            <option value="Pedro">Pedro</option>
                          </select>
                        </>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            onChange={() => completePendingAction(item.id)}
                            style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary }}
                            aria-label={`Concluir melhoria ${item.texto}`}
                          />
                          <button
                            type="button"
                            {...taskTextHoverHandlers}
                            onClick={() => openCommentsModal(item)}
                            style={{
                              margin: 0,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 14,
                              color: C.dark,
                              cursor: "pointer",
                              borderRadius: 6,
                              textAlign: "left",
                              minWidth: 0,
                            }}
                          >
                            {item.texto}
                          </button>
                          <input
                            type="date"
                            value={item.prazo}
                            onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                            style={{ ...dateInputCompact, width: "auto" }}
                          />
                          <select
                            value={item.responsavel}
                            onChange={(e) => updatePendingAction(item.id, { responsavel: e.target.value || null })}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 13,
                              fontFamily: "Inter, sans-serif",
                              color: C.dark,
                              background: C.white,
                            }}
                          >
                            <option value="">Responsável</option>
                            <option value="Diogo">Diogo</option>
                            <option value="Turí">Turí</option>
                            <option value="Pedro">Pedro</option>
                          </select>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
          </>
        )}
      </main>
      {commentsModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(13, 27, 62, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
            boxSizing: "border-box",
          }}
          onClick={closeCommentsModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="comentarios-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isMobile ? "100%" : "min(520px, 92vw)",
              maxWidth: "100%",
              maxHeight: isMobile ? "calc(100vh - 24px)" : "min(85vh, 640px)",
              background: C.bg,
              borderRadius: 12,
              boxShadow: "0 16px 48px rgba(13, 27, 62, 0.18)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: isMobile ? "14px 12px 12px 16px" : "16px 16px 12px 20px",
                borderBottom: "0.5px solid #e8ecf0",
                flexShrink: 0,
                background: C.white,
              }}
            >
              <h2
                id="comentarios-modal-title"
                style={{
                  margin: 0,
                  fontSize: isMobile ? 16 : 18,
                  color: C.dark,
                  fontWeight: 700,
                  flex: 1,
                  lineHeight: 1.35,
                  minWidth: 0,
                }}
              >
                {commentsModal.titulo}
              </h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={closeCommentsModal}
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
                  color: C.dark,
                  fontSize: 28,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                  margin: "-4px -4px 0 0",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 20px",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {comentariosLoading && (
                <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Carregando comentários…</p>
              )}
              {comentariosError && (
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "#b91c1c" }}>{comentariosError}</p>
              )}
              {!comentariosLoading && !comentariosError && comentariosList.length === 0 && (
                <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>Nenhum comentário ainda.</p>
              )}
              {comentariosList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    marginBottom: 14,
                    paddingBottom: 14,
                    borderBottom: "0.5px solid #e8ecf0",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>
                    <strong style={{ color: C.dark }}>{c.autor ?? "—"}</strong>
                    <span style={{ color: "#94a3b8" }}> · </span>
                    <span>{formatComentarioDateTime(c.created_at)}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: C.dark, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {c.texto}
                  </p>
                </div>
              ))}
            </div>
            <div
              style={{
                flexShrink: 0,
                padding: isMobile ? "14px 16px 16px" : "16px 20px",
                borderTop: "0.5px solid #e8ecf0",
                background: C.white,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 10,
                  alignItems: isMobile ? "stretch" : "flex-end",
                }}
              >
                <textarea
                  value={novoComentarioTexto}
                  onChange={(e) => setNovoComentarioTexto(e.target.value)}
                  placeholder="Escreva um comentário…"
                  rows={isMobile ? 3 : 2}
                  style={{
                    ...inputFieldStyle,
                    flex: 1,
                    resize: "vertical",
                    minHeight: isMobile ? 72 : 56,
                    maxWidth: "100%",
                  }}
                />
                <button
                  type="button"
                  disabled={comentarioSubmitting || !novoComentarioTexto.trim()}
                  onClick={submitComentario}
                  style={{
                    background: C.primary,
                    color: C.white,
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: 8,
                    cursor: comentarioSubmitting || !novoComentarioTexto.trim() ? "not-allowed" : "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    opacity: comentarioSubmitting || !novoComentarioTexto.trim() ? 0.55 : 1,
                    flexShrink: 0,
                    alignSelf: isMobile ? "stretch" : "auto",
                  }}
                >
                  {comentarioSubmitting ? "Enviando…" : "Comentar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

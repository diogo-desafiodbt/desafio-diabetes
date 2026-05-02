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
 *   faturamento numeric not null default 0,
 *   meta_faturamento numeric not null default 0,
 *   downloads numeric not null default 0,
 *   meta_downloads numeric not null default 0,
 *   suplementos numeric not null default 0,
 *   meta_suplementos numeric not null default 0,
 *   livros numeric not null default 0,
 *   meta_livros numeric not null default 0,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * ------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function prevMesYYYYMM(mesYYYYMM) {
  const [y, m] = mesYYYYMM.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  const d = new Date(y, m - 2, 1);
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

function variationBadgeParts(prevVal, currVal) {
  const p = Number(prevVal);
  const c = Number(currVal);
  if (!Number.isFinite(c)) return { label: "Sem dados", bg: "#f1f5f9", color: "#64748b" };
  if (!Number.isFinite(p) || p === 0) {
    if (p === 0 && c !== 0) return { label: "Novo", bg: "#e0e7ff", color: "#3730a3" };
    return { label: "Sem dados", bg: "#f1f5f9", color: "#64748b" };
  }
  const v = ((c - p) / Math.abs(p)) * 100;
  const sign = v >= 0 ? "+" : "";
  return {
    label: `${sign}${v.toFixed(1)}%`,
    bg: v >= 0 ? "#dcfce7" : "#fee2e2",
    color: v >= 0 ? "#166534" : "#991b1b",
  };
}

function formatMoneyBRL(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

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

function FunnelSidebarEmbed({ slug, row, onBack }) {
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
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: C.dark, fontFamily: "Inter, sans-serif" }}>{cfg.title}</h1>

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
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#64748b", fontFamily: "Inter, sans-serif" }}>{f.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
  const [kpiMesAnteriorRow, setKpiMesAnteriorRow] = useState(null);
  const [kpisChart6, setKpisChart6] = useState([]);

  const [kpiFormMes, setKpiFormMes] = useState(() => currentMesYYYYMM());
  const [kpiFormFat, setKpiFormFat] = useState("");
  const [kpiFormMetaFat, setKpiFormMetaFat] = useState("");
  const [kpiFormDownloads, setKpiFormDownloads] = useState("");
  const [kpiFormMetaDown, setKpiFormMetaDown] = useState("");
  const [kpiFormSup, setKpiFormSup] = useState("");
  const [kpiFormMetaSup, setKpiFormMetaSup] = useState("");
  const [kpiFormLivros, setKpiFormLivros] = useState("");
  const [kpiFormMetaLivros, setKpiFormMetaLivros] = useState("");
  const [kpiFormSaving, setKpiFormSaving] = useState(false);
  const [kpiFormFeedback, setKpiFormFeedback] = useState(null);

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
  }, []);

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
      const mesPrevStr = prevMesYYYYMM(mesRef);

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

      const [entries, curKpi, prevKpi, sixKpi] = await Promise.all([
        funnelEntriesPromise,
        supabase.from("kpis_mensais").select("*").eq("mes", mesRef).maybeSingle(),
        mesPrevStr
          ? supabase.from("kpis_mensais").select("*").eq("mes", mesPrevStr).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("kpis_mensais").select("*").order("mes", { ascending: false }).limit(6),
      ]);

      setRows(Object.fromEntries(entries));

      if (!curKpi.error) setKpiMesAtualRow(curKpi.data ?? null);
      else setKpiMesAtualRow(null);
      if (!prevKpi.error) setKpiMesAnteriorRow(prevKpi.data ?? null);
      else setKpiMesAnteriorRow(null);
      if (!sixKpi.error && Array.isArray(sixKpi.data)) {
        setKpisChart6([...sixKpi.data].sort((a, b) => String(a.mes).localeCompare(String(b.mes))));
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
      setKpiFormFat("");
      setKpiFormMetaFat("");
      setKpiFormDownloads("");
      setKpiFormMetaDown("");
      setKpiFormSup("");
      setKpiFormMetaSup("");
      setKpiFormLivros("");
      setKpiFormMetaLivros("");
      return;
    }
    setKpiFormFat(String(data.faturamento ?? ""));
    setKpiFormMetaFat(String(data.meta_faturamento ?? ""));
    setKpiFormDownloads(String(data.downloads ?? ""));
    setKpiFormMetaDown(String(data.meta_downloads ?? ""));
    setKpiFormSup(String(data.suplementos ?? ""));
    setKpiFormMetaSup(String(data.meta_suplementos ?? ""));
    setKpiFormLivros(String(data.livros ?? ""));
    setKpiFormMetaLivros(String(data.meta_livros ?? ""));
  }, [kpiFormMes]);

  const saveKpisMensais = async () => {
    if (!supabase) return;
    setKpiFormSaving(true);
    setKpiFormFeedback(null);
    const row = {
      mes: kpiFormMes,
      faturamento: Number(kpiFormFat) || 0,
      meta_faturamento: Number(kpiFormMetaFat) || 0,
      downloads: Number(kpiFormDownloads) || 0,
      meta_downloads: Number(kpiFormMetaDown) || 0,
      suplementos: Number(kpiFormSup) || 0,
      meta_suplementos: Number(kpiFormMetaSup) || 0,
      livros: Number(kpiFormLivros) || 0,
      meta_livros: Number(kpiFormMetaLivros) || 0,
    };
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

  const faturamentoChartMax = useMemo(() => {
    const nums = kpisChart6.map((r) => Number(r.faturamento)).filter((n) => Number.isFinite(n));
    const m = nums.length ? Math.max(...nums) : 0;
    return m > 0 ? m : 1;
  }, [kpisChart6]);

  const kpiExecItems = useMemo(() => {
    const r = kpiMesAtualRow;
    const p = kpiMesAnteriorRow;
    const item = (label, keyCurr, keyMeta, kind) => {
      const pct = r ? pctMeta(r[keyCurr], r[keyMeta]) : null;
      const display =
        !r || r[keyCurr] == null
          ? "—"
          : kind === "money"
            ? formatMoneyBRL(r[keyCurr])
            : fmtCell(r[keyCurr]);
      const varBadge = variationBadgeParts(p ? p[keyCurr] : null, r ? r[keyCurr] : null);
      return { label, display, pct, varBadge };
    };
    return [
      item("Faturamento do mês", "faturamento", "meta_faturamento", "money"),
      item("Downloads do app", "downloads", "meta_downloads", "num"),
      item("Suplementos vendidos", "suplementos", "meta_suplementos", "num"),
      item("Livros vendidos", "livros", "meta_livros", "num"),
    ];
  }, [kpiMesAtualRow, kpiMesAnteriorRow]);

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
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
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
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, sans-serif", background: C.bg }}>
        <aside style={sidebarShell}>
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
        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, sans-serif", color: C.dark, background: C.bg }}>
      <style>{`
        @keyframes dashPulseGreen {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); }
          50% { opacity: 0.75; box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); }
        }
      `}</style>
      <aside style={sidebarShell}>
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
                onClick={() => setFunnelDetailSlug(slug)}
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

      <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px 32px 48px" }}>
        {funnelDetailSlug && FUNNEL_FORMS[funnelDetailSlug] ? (
          <FunnelSidebarEmbed
            slug={funnelDetailSlug}
            row={rows[funnelDetailSlug]}
            onBack={() => setFunnelDetailSlug(null)}
          />
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.dark, fontFamily: "Inter, sans-serif" }}>
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
                <span style={{ fontSize: 13, color: "#64748b", fontFamily: "Inter, sans-serif" }}>{weekIndicatorText}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
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
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  {kpiExecItems.map((kpi) => {
                    const barW = kpi.pct != null && Number.isFinite(kpi.pct) ? `${Math.min(100, Math.max(0, kpi.pct))}%` : "0%";
                    const barBg = kpiBarColor(kpi.pct);
                    const pctLabel =
                      kpi.pct != null && Number.isFinite(kpi.pct) ? `${kpi.pct.toFixed(1)}% da meta` : "Sem dados da meta";
                    return (
                      <div
                        key={kpi.label}
                        style={{
                          ...cardEnterprise,
                          border: "0.5px solid #e8ecf0",
                          fontFamily: "Inter, sans-serif",
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              fontWeight: 700,
                              lineHeight: 1.3,
                            }}
                          >
                            {kpi.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 20,
                              background: kpi.varBadge.bg,
                              color: kpi.varBadge.color,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {kpi.varBadge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.dark, marginBottom: 12, letterSpacing: "-0.02em" }}>
                          {kpi.display}
                        </div>
                        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
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
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{pctLabel}</div>
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
                  <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.dark }}>Faturamento mensal (últimos 6 meses)</h2>
                  {kpisChart6.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>Sem dados de faturamento.</p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, minHeight: 160, paddingTop: 8 }}>
                      {kpisChart6.map((row) => {
                        const v = Number(row.faturamento);
                        const hPct = Number.isFinite(v) && faturamentoChartMax > 0 ? (v / faturamentoChartMax) * 100 : 0;
                        return (
                          <div
                            key={row.mes}
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}
                          >
                            <div
                              style={{
                                width: "100%",
                                maxWidth: 48,
                                height: 120,
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                title={`${formatMoneyBRL(v)}`}
                                style={{
                                  width: "72%",
                                  height: `${Math.max(4, hPct)}%`,
                                  background: C.primary,
                                  borderRadius: "6px 6px 2px 2px",
                                  minHeight: 4,
                                  transition: "height 0.35s ease",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textAlign: "center" }}>
                              {mesLabelChart(row.mes)}
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
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
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
                        }}
                      >
                        <ResponsavelAvatar nome={resp} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>{item.texto}</span>
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
                    <li
                      key={`${item.slug}-${item.id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px minmax(180px, 1fr) minmax(200px, 1fr) 160px 170px",
                        gap: 10,
                        alignItems: "center",
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "0.5px solid #e8ecf0",
                        padding: "10px 12px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        onChange={() => completePendingAction(item.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary }}
                        aria-label={`Concluir ação ${item.texto}`}
                      />
                      <span style={{ fontSize: 14, color: C.dark }}>{item.texto}</span>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{item.funnelTitle}</span>
                      <input
                        type="date"
                        value={item.prazo}
                        onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontFamily: "Inter, sans-serif",
                          color: C.dark,
                          background: C.white,
                        }}
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                  marginBottom: 14,
                }}
              >
                <div style={{ gridColumn: "1 / -1", maxWidth: 220 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Mês</label>
                  <input
                    type="month"
                    value={kpiFormMes}
                    onChange={(e) => setKpiFormMes(e.target.value)}
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Faturamento realizado (R$)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={kpiFormFat}
                    onChange={(e) => setKpiFormFat(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Meta faturamento (R$)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={kpiFormMetaFat}
                    onChange={(e) => setKpiFormMetaFat(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Downloads realizados
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormDownloads}
                    onChange={(e) => setKpiFormDownloads(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Meta downloads
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormMetaDown}
                    onChange={(e) => setKpiFormMetaDown(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Suplementos vendidos
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormSup}
                    onChange={(e) => setKpiFormSup(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Meta suplementos
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormMetaSup}
                    onChange={(e) => setKpiFormMetaSup(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Livros vendidos
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormLivros}
                    onChange={(e) => setKpiFormLivros(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                    Meta livros
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={kpiFormMetaLivros}
                    onChange={(e) => setKpiFormMetaLivros(e.target.value)}
                    placeholder="0"
                    style={inputFieldStyle}
                  />
                </div>
              </div>
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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
                            <div style={{ flex: 1, minWidth: 200 }}>
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
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
                    <li
                      key={`sistema-${item.id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px minmax(180px, 1fr) 160px 170px",
                        gap: 10,
                        alignItems: "center",
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "0.5px solid #e8ecf0",
                        padding: "10px 12px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        onChange={() => completePendingAction(item.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary }}
                        aria-label={`Concluir melhoria ${item.texto}`}
                      />
                      <span style={{ fontSize: 14, color: C.dark }}>{item.texto}</span>
                      <input
                        type="date"
                        value={item.prazo}
                        onChange={(e) => updatePendingAction(item.id, { prazo: e.target.value || null })}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontFamily: "Inter, sans-serif",
                          color: C.dark,
                          background: C.white,
                        }}
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
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FUNNEL_FORMS } from "../data/funnelForms";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { FUNNEL_EVALUATORS } from "../utils/semaphores";
import { getFormAbsoluteUrl } from "../utils/formUrls";

const C = {
  bg: "#EBEBEB",
  primary: "#FF0028",
  dark: "#0D1B3E",
  white: "#FFFFFF",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function formatWeekDate(isoDate) {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(isoDate);
  }
}

function badgeStyle(light) {
  const base = {
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    color: C.white,
    display: "inline-block",
    fontFamily: "Inter, sans-serif",
  };
  if (light === "green") return { ...base, backgroundColor: "#22c55e" };
  if (light === "yellow") return { ...base, backgroundColor: "#eab308" };
  if (light === "red") return { ...base, backgroundColor: "#ef4444" };
  return { ...base, backgroundColor: "#94a3b8" };
}

function badgeLabel(light) {
  if (light === "green") return "No objetivo";
  if (light === "yellow") return "Atenção";
  if (light === "red") return "Abaixo da meta";
  return "Sem dados";
}

function FormLinksSection() {
  const [copiedSlug, setCopiedSlug] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (slug) => {
    const url = getFormAbsoluteUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCopiedSlug(slug);
      timeoutRef.current = setTimeout(() => setCopiedSlug(null), 2000);
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
        setCopiedSlug(slug);
        timeoutRef.current = setTimeout(() => setCopiedSlug(null), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <section style={{ marginTop: 40 }} aria-labelledby="links-preenchimento">
      <h2
        id="links-preenchimento"
        style={{
          fontFamily: "Oswald, sans-serif",
          color: C.dark,
          fontSize: 22,
          marginBottom: 16,
          fontWeight: 700,
        }}
      >
        Links de Preenchimento
      </h2>
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {Object.entries(FUNNEL_FORMS).map(([slug, cfg]) => {
          const url = getFormAbsoluteUrl(slug);
          const copied = copiedSlug === slug;
          return (
            <li
              key={slug}
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 16,
                border: `1px solid ${C.primary}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <h4
                style={{
                  fontFamily: "Oswald, sans-serif",
                  color: C.dark,
                  marginBottom: 6,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {cfg.title}
              </h4>
              <p
                style={{
                  fontSize: 12,
                  color: "#555555",
                  marginBottom: 10,
                  wordBreak: "break-all",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {url}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(slug)}
                style={{
                  background: copied ? "#16a34a" : C.primary,
                  color: C.white,
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "Oswald, sans-serif",
                  fontSize: 14,
                  letterSpacing: 1,
                  fontWeight: 700,
                }}
              >
                {copied ? "Copiado!" : "Copiar Link"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const entries = await Promise.all(
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
      setRows(Object.fromEntries(entries));
    } catch (e) {
      setErr(e?.message ?? "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const headerStyle = {
    background: C.dark,
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const titleStyle = {
    fontFamily: "Oswald, sans-serif",
    color: C.primary,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 2,
    margin: 0,
  };

  const subtitleStyle = {
    color: C.white,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
  };

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>DESAFIO DIABETES</h1>
          <span style={subtitleStyle}>Dashboard CEO</span>
        </header>
        <div style={{ maxWidth: 1200, margin: "32px auto", padding: "0 24px" }}>
          <div
            style={{
              background: C.white,
              padding: 24,
              borderRadius: 8,
              border: `1px solid ${C.primary}`,
            }}
          >
            <h2 style={{ fontFamily: "Oswald, sans-serif", color: C.dark, fontSize: 18, marginBottom: 8 }}>
              Configuração do Supabase
            </h2>
            <p style={{ color: "#555555", fontSize: 14, lineHeight: 1.5 }}>
              Defina <code style={{ background: C.bg, padding: "2px 6px" }}>REACT_APP_SUPABASE_URL</code> e{" "}
              <code style={{ background: C.bg, padding: "2px 6px" }}>REACT_APP_SUPABASE_ANON_KEY</code> no
              arquivo <code style={{ background: C.bg, padding: "2px 6px" }}>.env</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.dark }}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>DESAFIO DIABETES</h1>
        <span style={subtitleStyle}>Dashboard CEO</span>
      </header>

      <div style={{ maxWidth: 1200, margin: "32px auto", padding: "0 24px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#555555", maxWidth: 640, lineHeight: 1.5 }}>
            Visão dos sete funis. Verde ≥ 100% da meta, amarelo 70–99%, vermelho abaixo de 70%. Índice geral =
            média das etapas.
          </p>
          <button
            type="button"
            onClick={load}
            style={{
              background: C.dark,
              color: C.white,
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "Oswald, sans-serif",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Atualizar
          </button>
        </div>

        {err && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              background: "#fef2f2",
              border: `1px solid ${C.primary}`,
              borderRadius: 8,
              color: C.dark,
              fontSize: 14,
            }}
          >
            {err}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#555555" }}>Carregando…</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
              margin: "24px 0",
            }}
          >
            {Object.entries(FUNNEL_FORMS).map(([slug, cfg]) => {
              const row = rows[slug];
              const ev = row && FUNNEL_EVALUATORS[slug] ? FUNNEL_EVALUATORS[slug].evaluate(row) : null;
              const light = ev?.light ?? "gray";
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => navigate(`/funil/${slug}`)}
                  style={{
                    position: "relative",
                    textAlign: "left",
                    cursor: "pointer",
                    background: C.white,
                    borderRadius: 8,
                    padding: 20,
                    border: "none",
                    borderLeft: `4px solid ${C.primary}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ position: "absolute", top: 16, right: 16, ...badgeStyle(light) }}>
                    {badgeLabel(light)}
                  </span>
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 16,
                      color: C.dark,
                      marginBottom: 8,
                      paddingRight: 100,
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    {cfg.title}
                  </h3>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "#555555" }}>
                    Semana:{" "}
                    <strong style={{ color: C.dark, fontWeight: 600 }}>
                      {row ? formatWeekDate(row.data_semana) : "—"}
                    </strong>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#555555" }}>
                    Última atualização:{" "}
                    <strong style={{ color: C.dark, fontWeight: 600 }}>
                      {row ? formatDate(row.created_at) : "Sem lançamentos"}
                    </strong>
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <FormLinksSection />
      </div>
    </div>
  );
}

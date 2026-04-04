import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FUNNEL_FORMS } from "../data/funnelForms";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { mondayFromWeekValue } from "../utils/week";

const C = {
  bg: "#EBEBEB",
  primary: "#FF0028",
  dark: "#0D1B3E",
  white: "#FFFFFF",
};

function parseNumber(raw) {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, error: "Número inválido" };
  if (n < 0) return { ok: false, error: "Use valores ≥ 0" };
  return { ok: true, value: n };
}

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

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontFamily: "Oswald, sans-serif",
  color: C.dark,
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 4,
  marginTop: 16,
};

export function FormPage() {
  const { slug } = useParams();
  const cfg = slug ? FUNNEL_FORMS[slug] : null;

  const initialValues = useMemo(() => {
    const o = {};
    cfg?.fields.forEach((f) => {
      o[f.key] = "";
    });
    return o;
  }, [cfg]);

  const [week, setWeek] = useState("");
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = slug ? FUNNEL_FORMS[slug] : null;
    if (!c) return;
    const o = {};
    c.fields.forEach((f) => {
      o[f.key] = "";
    });
    setValues(o);
    setWeek("");
    setErrors({});
    setSuccess(false);
    setSubmitError(null);
  }, [slug]);

  const onChangeField = (key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSuccess(false);
  };

  const validate = () => {
    const e = {};
    if (!week) e.week = "Selecione a semana de referência.";
    const dataSemana = mondayFromWeekValue(week);
    if (week && !dataSemana) e.week = "Semana inválida.";

    cfg?.fields.forEach((f) => {
      const raw = values[f.key];
      if (raw === "" || raw == null) {
        e[f.key] = "Obrigatório.";
        return;
      }
      const p = parseNumber(raw);
      if (!p.ok) e[f.key] = p.error;
    });
    return { e, dataSemana: mondayFromWeekValue(week) };
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!cfg || !supabase) return;
    setSubmitError(null);
    setSuccess(false);
    const { e, dataSemana } = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = { data_semana: dataSemana };
    cfg.fields.forEach((f) => {
      const p = parseNumber(values[f.key]);
      if (p.ok) payload[f.key] = p.value;
    });

    setLoading(true);
    const { error } = await supabase.from(cfg.table).insert([payload]);
    setLoading(false);

    if (error) {
      setSubmitError(error.message ?? "Erro ao salvar.");
      return;
    }

    setSuccess(true);
    setWeek("");
    const cleared = {};
    cfg.fields.forEach((f) => {
      cleared[f.key] = "";
    });
    setValues(cleared);
  };

  const linkBackStyle = {
    color: C.white,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    textDecoration: "none",
    marginLeft: "auto",
  };

  if (!cfg) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>DESAFIO DIABETES</h1>
          <Link to="/dashboard" style={linkBackStyle}>
            ← Voltar ao dashboard
          </Link>
        </header>
        <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px", textAlign: "center" }}>
          <p style={{ color: "#555555" }}>Funil não encontrado.</p>
          <Link
            to="/dashboard"
            style={{ color: C.primary, fontWeight: 700, fontFamily: "Oswald, sans-serif", marginTop: 16, display: "inline-block" }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured() || !supabase) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>DESAFIO DIABETES</h1>
          <Link to="/dashboard" style={linkBackStyle}>
            ← Voltar ao dashboard
          </Link>
        </header>
        <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
          <div style={{ background: C.white, padding: 24, borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
            <p style={{ color: "#555555", fontSize: 14, margin: 0 }}>
              Configure o Supabase no arquivo <code style={{ background: C.bg, padding: "2px 6px" }}>.env</code>.
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
        <span style={{ color: C.white, fontSize: 14, fontFamily: "Inter, sans-serif" }}>{cfg.title}</span>
        <Link to="/dashboard" style={linkBackStyle}>
          ← Voltar
        </Link>
      </header>

      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
        <form
          onSubmit={onSubmit}
          style={{
            background: C.white,
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            boxSizing: "border-box",
          }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              color: C.dark,
              fontSize: 24,
              marginBottom: 24,
              marginTop: 0,
              fontWeight: 700,
            }}
          >
            {cfg.title}
          </h2>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555555", lineHeight: 1.5 }}>
            Envio sem login. Preencha a semana e os números do período. Percentuais em escala 0–100.
          </p>

          <label htmlFor="data_semana" style={{ ...labelStyle, marginTop: 8 }}>
            Semana (obrigatório)
          </label>
          <input
            id="data_semana"
            type="week"
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              setErrors((prev) => ({ ...prev, week: undefined }));
              setSuccess(false);
            }}
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.outline = "none";
              e.target.style.borderColor = C.primary;
              e.target.style.boxShadow = "0 0 0 2px rgba(255,0,40,0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#ddd";
              e.target.style.boxShadow = "none";
            }}
          />
          {errors.week && (
            <p style={{ color: C.primary, fontSize: 13, margin: "4px 0 0" }}>{errors.week}</p>
          )}
          <p style={{ fontSize: 12, color: "#555555", margin: "6px 0 0" }}>
            Segunda-feira da semana ISO é salva no banco.
          </p>

          {cfg.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} style={labelStyle}>
                {f.label}
              </label>
              <input
                id={f.key}
                type="number"
                inputMode="decimal"
                min={0}
                step={f.step ?? "1"}
                value={values[f.key] ?? ""}
                onChange={(e) => onChangeField(f.key, e.target.value)}
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.outline = "none";
                  e.target.style.borderColor = C.primary;
                  e.target.style.boxShadow = "0 0 0 2px rgba(255,0,40,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#ddd";
                  e.target.style.boxShadow = "none";
                }}
              />
              {f.hint && <p style={{ fontSize: 12, color: "#555555", margin: "4px 0 0" }}>{f.hint}</p>}
              {errors[f.key] && (
                <p style={{ color: C.primary, fontSize: 13, margin: "4px 0 0" }}>{errors[f.key]}</p>
              )}
            </div>
          ))}

          {submitError && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#fef2f2",
                border: `1px solid ${C.primary}`,
                borderRadius: 8,
                fontSize: 14,
                color: C.dark,
              }}
            >
              {submitError}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#dcfce7",
                border: "1px solid #22c55e",
                color: "#166534",
                padding: 16,
                borderRadius: 8,
                marginTop: 16,
                textAlign: "center",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              ✓ Registro salvo com sucesso.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: C.primary,
              color: C.white,
              border: "none",
              padding: 14,
              borderRadius: 8,
              fontFamily: "Oswald, sans-serif",
              fontSize: 18,
              letterSpacing: 2,
              cursor: loading ? "wait" : "pointer",
              marginTop: 24,
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.background = "#8B0000";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = C.primary;
            }}
          >
            {loading ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}

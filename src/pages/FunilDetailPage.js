import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FUNNEL_FORMS } from "../data/funnelForms";
import { supabase } from "../lib/supabase";
import { FUNNEL_EVALUATORS } from "../utils/semaphores";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const C = { bg: "#EBEBEB", primary: "#FF0028", dark: "#0D1B3E", white: "#FFFFFF" };

function fmt(v) { if (v == null) return "—"; return typeof v === "number" ? v.toLocaleString("pt-BR") : String(v); }

function fmtDataSemanaDDMM(value) {
  if (value == null || value === "") return "—";
  const s = String(value);
  const iso = s.length === 10 ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function Semaforo({ pct }) {
  const cor = pct == null ? "#94a3b8" : pct >= 100 ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444";
  const label = pct == null ? "s/d" : `${pct.toFixed(1)}%`;
  return <span style={{ background: cor, color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{label}</span>;
}

function CardSemana({ title, row, slug }) {
  const cfg = FUNNEL_FORMS[slug];
  const ev = row && FUNNEL_EVALUATORS[slug] ? FUNNEL_EVALUATORS[slug].evaluate(row) : null;
  const stageMap = {};
  (ev?.stages ?? []).forEach(s => { stageMap[s.label] = s.ratioPct; });
  return (
    <div style={{ flex: 1, minWidth: 260, background: C.white, borderRadius: 8, padding: 20, borderLeft: `4px solid ${C.primary}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <h3 style={{ fontFamily: "Oswald, sans-serif", color: C.dark, fontSize: 16, marginBottom: 12, fontWeight: 700 }}>{title}</h3>
      {!row ? <p style={{ color: "#94a3b8", fontSize: 14 }}>Sem dados</p> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {cfg.fields.map(f => {
            const pct = stageMap[f.label];
            return (
              <li key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 13, color: "#555" }}>{f.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{fmt(row[f.key])}</span>
                  {pct !== undefined && <Semaforo pct={pct} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FunilDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const cfg = FUNNEL_FORMS[slug];
  const [rows, setRows] = useState([]);
  const [chartRows, setChartRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acoes, setAcoes] = useState(() => JSON.parse(localStorage.getItem(`acoes-${slug}`) ?? "[]"));
  const [novaAcao, setNovaAcao] = useState("");

  useEffect(() => {
    if (!cfg || !supabase) {
      setRows([]);
      setChartRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from(cfg.table).select("*").order("data_semana", { ascending: false }).limit(2),
      supabase.from(cfg.table).select("*").order("data_semana", { ascending: false }).limit(8),
    ]).then(([{ data: d2 }, { data: d8 }]) => {
      setRows(d2 ?? []);
      const list = d8 ?? [];
      list.sort((a, b) => String(a.data_semana).localeCompare(String(b.data_semana)));
      setChartRows(list);
      setLoading(false);
    });
  }, [cfg, slug]);

  useEffect(() => {
    localStorage.setItem(`acoes-${slug}`, JSON.stringify(acoes));
  }, [acoes, slug]);

  const ev0 = rows[0] && FUNNEL_EVALUATORS[slug] ? FUNNEL_EVALUATORS[slug].evaluate(rows[0]) : null;
  const abaixo = (ev0?.stages ?? []).filter(s => s.ratioPct != null && s.ratioPct < 70);
  const nocaminho = (ev0?.stages ?? []).filter(s => s.ratioPct != null && s.ratioPct >= 100);

  const addAcao = () => {
    const txt = novaAcao.trim();
    if (!txt) return;
    setAcoes(prev => [...prev, { id: Date.now(), texto: txt }]);
    setNovaAcao("");
  };

  const removeAcao = (id) => setAcoes(prev => prev.filter(a => a.id !== id));

  const chartValueKey = slug === "pago-meta" ? "valor_investido" : "vendas";
  const chartData = chartRows.map(row => ({
    semana: fmtDataSemanaDDMM(row.data_semana),
    [chartValueKey]: row[chartValueKey] == null ? 0 : Number(row[chartValueKey]),
  }));

  if (!cfg) return <div style={{ padding: 32 }}>Funil não encontrado.</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.dark }}>
      <header style={{ background: C.dark, padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate("/dashboard")} style={{ background: "transparent", border: `1px solid ${C.white}`, color: C.white, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif" }}>← Voltar</button>
        <h1 style={{ fontFamily: "Oswald, sans-serif", color: C.primary, fontSize: 22, fontWeight: 700, margin: 0 }}>DESAFIO DIABETES</h1>
        <span style={{ color: C.white, fontSize: 14 }}>{cfg.title}</span>
      </header>

      <div style={{ maxWidth: 1100, margin: "32px auto", padding: "0 24px" }}>
        {loading ? <p>Carregando…</p> : (
          <>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              <CardSemana title="Semana atual" row={rows[0]} slug={slug} />
              <CardSemana title="Semana anterior" row={rows[1]} slug={slug} />
            </div>

            <div
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 24,
                marginBottom: 24,
                borderLeft: "4px solid #FF0028",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <h2 style={{ fontFamily: "Oswald, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>Evolução Semanal</h2>
              {!supabase ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Supabase não configurado.</p>
              ) : chartRows.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Sem dados para o gráfico.</p>
              ) : (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <XAxis dataKey="semana" tick={{ fontSize: 12, fill: "#555" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#555" }} />
                      <Tooltip />
                      <Bar dataKey={chartValueKey} fill="#FF0028" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={{ background: C.white, borderRadius: 8, padding: 24, marginBottom: 24, borderLeft: `4px solid ${C.primary}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h2 style={{ fontFamily: "Oswald, sans-serif", color: C.dark, fontSize: 18, marginBottom: 12, fontWeight: 700 }}>Análise</h2>
              {!rows[0] ? <p style={{ color: "#94a3b8" }}>Sem dados para analisar.</p> : (
                <>
                  {abaixo.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontWeight: 600, color: "#ef4444", marginBottom: 6 }}>⚠️ Abaixo da meta:</p>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {abaixo.map(s => <li key={s.label} style={{ fontSize: 14, color: "#555", marginBottom: 4 }}>{s.label} — {s.ratioPct.toFixed(1)}% da meta</li>)}
                      </ul>
                    </div>
                  )}
                  {nocaminho.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, color: "#22c55e", marginBottom: 6 }}>✅ No caminho:</p>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {nocaminho.map(s => <li key={s.label} style={{ fontSize: 14, color: "#555", marginBottom: 4 }}>{s.label} — {s.ratioPct.toFixed(1)}% da meta</li>)}
                      </ul>
                    </div>
                  )}
                  {abaixo.length === 0 && nocaminho.length === 0 && <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma etapa com meta definida ainda.</p>}
                </>
              )}
            </div>

            <div style={{ background: C.white, borderRadius: 8, padding: 24, borderLeft: `4px solid ${C.primary}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <h2 style={{ fontFamily: "Oswald, sans-serif", color: C.dark, fontSize: 18, marginBottom: 16, fontWeight: 700 }}>Plano de Ação</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={novaAcao} onChange={e => setNovaAcao(e.target.value)} onKeyDown={e => e.key === "Enter" && addAcao()} placeholder="Descreva uma ação..." style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "Inter, sans-serif" }} />
                <button onClick={addAcao} style={{ background: C.primary, color: C.white, border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 14 }}>Adicionar</button>
              </div>
              {acoes.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma ação pendente.</p> : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {acoes.map(a => (
                    <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: C.bg, borderRadius: 6, marginBottom: 8 }}>
                      <input type="checkbox" onChange={() => removeAcao(a.id)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.primary }} />
                      <span style={{ fontSize: 14, color: C.dark }}>{a.texto}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BG = "#F4F6FA";
const PRIMARY = "#FF0028";
const DARK = "#0D1B3E";

const USERS = [
  { email: "diogo@desafiodiabetes.com", password: "DiogoDesafio123", nome: "Diogo" },
  { email: "turionline@gmail.com", password: "Nutry1987", nome: "Turí" },
  { email: "suporte@desafiodiabetes.com", password: "Suporte1234", nome: "Pedro" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("dd_user")) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro("");
    const em = email.trim().toLowerCase();
    const pw = senha;
    const found = USERS.find((u) => u.email.toLowerCase() === em && u.password === pw);
    if (!found) {
      setErro("E-mail ou senha incorretos.");
      return;
    }
    sessionStorage.setItem("dd_user", JSON.stringify({ nome: found.nome, email: found.email }));
    navigate("/dashboard", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 12,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          border: "0.5px solid #e8ecf0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <img
            src="/Logo Vertical (3).png"
            alt="Desafio Diabetes"
            style={{ width: 60, height: 60, objectFit: "contain" }}
          />
          <div>
            <div style={{ color: DARK, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Desafio Diabetes</div>
            <div style={{ color: "rgba(13,27,62,0.45)", fontSize: 10, letterSpacing: "0.1em", marginTop: 4, fontWeight: 600 }}>
              DASHBOARD CEO
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="login-email"
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}
            >
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 15,
                color: DARK,
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="login-senha"
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}
            >
              Senha
            </label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 15,
                color: DARK,
                fontFamily: "inherit",
              }}
            />
          </div>
          {erro ? (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 16, marginTop: 0 }}>{erro}</p>
          ) : null}
          <button
            type="submit"
            style={{
              width: "100%",
              background: PRIMARY,
              color: "#fff",
              border: "none",
              padding: "14px 16px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

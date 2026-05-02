import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWindowSize } from "../hooks/useWindowSize";

const PRIMARY = "#FF0028";
const DARK = "#0D1B3E";

const USERS = [
  { email: "diogo@desafiodiabetes.com", password: "DiogoDesafio123", nome: "Diogo" },
  { email: "turionline@gmail.com", password: "Nutry1987", nome: "Turí" },
  { email: "suporte@desafiodiabetes.com", password: "Suporte1234", nome: "Pedro" },
];

const inputBase = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 8,
  fontSize: 16,
  color: "#FFFFFF",
  fontFamily: "inherit",
  background: "rgba(255,255,255,0.08)",
  outline: "none",
};

export function LoginPage() {
  const navigate = useNavigate();
  const { isMobile } = useWindowSize(768);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

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

  const inputBorder = (focused) =>
    focused ? `1px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.2)";

  const horizontalPad = isMobile ? 20 : 32;
  const logoMax = isMobile ? 160 : 220;

  return (
    <div
      id="login-page-root"
      style={{
        minHeight: "100vh",
        height: "100%",
        background: DARK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${isMobile ? 28 : 40}px ${horizontalPad}px`,
        fontFamily: "Inter, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        #login-page-root input::placeholder { color: rgba(255, 255, 255, 0.45); }
        #login-page-root input::-webkit-input-placeholder { color: rgba(255, 255, 255, 0.45); }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img
          src="/Logo Vertical (3).png"
          alt="Desafio Diabetes"
          style={{
            width: "100%",
            maxWidth: logoMax,
            height: "auto",
            objectFit: "contain",
            display: "block",
            marginBottom: isMobile ? 40 : 56,
          }}
        />

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.72)",
                marginBottom: 8,
                letterSpacing: "0.02em",
              }}
            >
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="seu@email.com"
              style={{
                ...inputBase,
                border: inputBorder(emailFocused),
              }}
            />
          </div>
          <div style={{ marginBottom: erro ? 14 : 8 }}>
            <label
              htmlFor="login-senha"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.72)",
                marginBottom: 8,
                letterSpacing: "0.02em",
              }}
            >
              Senha
            </label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onFocus={() => setSenhaFocused(true)}
              onBlur={() => setSenhaFocused(false)}
              placeholder="••••••••"
              style={{
                ...inputBase,
                border: inputBorder(senhaFocused),
              }}
            />
          </div>
          {erro ? (
            <p
              role="alert"
              style={{
                color: "#fecaca",
                fontSize: 14,
                marginBottom: 16,
                marginTop: 0,
                lineHeight: 1.45,
              }}
            >
              {erro}
            </p>
          ) : null}
          <button
            type="submit"
            style={{
              width: "100%",
              background: PRIMARY,
              color: "#FFFFFF",
              border: "none",
              padding: "14px 16px",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              minHeight: 48,
              boxSizing: "border-box",
              marginTop: erro ? 0 : 8,
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

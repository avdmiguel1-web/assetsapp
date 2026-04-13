import { useState } from "react";
import { useAuth } from "../stores/AuthContext";
import { useLang } from "../i18n/index.jsx";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, Loader, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import LOGO from "../assets/logo.js";

export default function AuthPage() {
  const { signIn, signUp, authError, clearError } = useAuth();
  const { lang, switchLang } = useLang();
  const [mode,     setMode]     = useState("login"); // login | register | reset
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState("");

  const es = lang === "es";

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true); clearError(); setSuccess("");

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setLoading(false);
      if (error) { /* authError will be set */ return; }
      setSuccess(es
        ? "¡Listo! Revisa tu correo para restablecer tu contraseña."
        : "Done! Check your email to reset your password.");
      return;
    }

    if (!password) { setLoading(false); return; }

    if (mode === "login") {
      await signIn(email, password);
    } else {
      const res = await signUp(email, password, name);
      if (res === "confirm") {
        setSuccess(es
          ? "¡Cuenta creada! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión."
          : "Account created! Check your email to confirm your account before signing in.");
        setMode("login");
      }
    }
    setLoading(false);
  };

  const switchMode = (m) => { setMode(m); clearError(); setSuccess(""); };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      {/* Lang toggle */}
      <div style={{ position:"fixed", top:20, right:20, display:"flex", gap:4 }}>
        {["es","en"].map(l => (
          <button key={l} onClick={() => switchLang(l)}
            style={{ padding:"4px 10px", borderRadius:"var(--radius-md)", border:"1.5px solid var(--border-default)", background:lang===l?"var(--accent-blue)":"var(--bg-card)", color:lang===l?"#fff":"var(--text-muted)", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {l === "es" ? "🇪🇸 ES" : "🇺🇸 EN"}
          </button>
        ))}
      </div>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <img src={LOGO} alt="FleetCore" style={{ height:60, width:"auto", objectFit:"contain", marginBottom:12 }} />
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>
            {es ? "Sistema de Gestión de Activos" : "Asset Management System"}
          </div>
        </div>

        <div className="card" style={{ padding:"32px 36px" }}>

          {/* ── RESET PASSWORD MODE ── */}
          {mode === "reset" ? (
            <div>
              <button onClick={() => switchMode("login")}
                style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:13, marginBottom:20, padding:0 }}>
                <ArrowLeft size={14} /> {es ? "Volver al inicio de sesión" : "Back to sign in"}
              </button>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:17, marginBottom:6 }}>
                  {es ? "Restablecer contraseña" : "Reset password"}
                </div>
                <div style={{ fontSize:13, color:"var(--text-muted)" }}>
                  {es
                    ? "Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña."
                    : "Enter your email and we'll send you a link to reset your password."}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom:16 }}>
                <label className="form-label">{es ? "Correo electrónico" : "Email"}</label>
                <input className="form-input" type="email" placeholder="email@empresa.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
              {authError && <ErrorBox msg={authError} />}
              {success   && <SuccessBox msg={success} />}
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !email}
                style={{ width:"100%", justifyContent:"center", padding:"11px", marginTop:4 }}>
                {loading
                  ? <><Loader size={15} style={{ animation:"spin 0.8s linear infinite" }} /> {es?"Enviando...":"Sending..."}</>
                  : (es ? "Enviar enlace" : "Send link")}
              </button>
            </div>
          ) : (
            /* ── LOGIN / REGISTER MODE ── */
            <div>
              {/* Tabs */}
              <div style={{ display:"flex", gap:2, marginBottom:24, background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", padding:3 }}>
                {[
                  { key:"login",    label: es ? "Iniciar Sesión" : "Sign In" },
                  { key:"register", label: es ? "Registrarse"   : "Register" },
                ].map(tab => (
                  <button key={tab.key} onClick={() => switchMode(tab.key)}
                    style={{ flex:1, padding:"8px 12px", border:"none", borderRadius:"var(--radius-sm)", cursor:"pointer", fontWeight:600, fontSize:13, transition:"var(--transition)",
                      background: mode===tab.key ? "var(--bg-card)"     : "transparent",
                      color:      mode===tab.key ? "var(--text-primary)" : "var(--text-muted)",
                      boxShadow:  mode===tab.key ? "var(--shadow-sm)"   : "none" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {mode === "register" && (
                  <div className="form-group">
                    <label className="form-label">{es ? "Nombre completo" : "Full name"}</label>
                    <input className="form-input" placeholder={es ? "Tu nombre" : "Your name"}
                      value={name} onChange={e => setName(e.target.value)} />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">{es ? "Correo electrónico" : "Email"}</label>
                  <input className="form-input" type="email" placeholder="email@empresa.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                </div>

                <div className="form-group">
                  <label className="form-label">{es ? "Contraseña" : "Password"}</label>
                  <div style={{ position:"relative" }}>
                    <input className="form-input" type={showPass?"text":"password"}
                      placeholder={es ? "Contraseña" : "Password"}
                      style={{ paddingRight:40 }}
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)" }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === "register" && (
                    <span style={{ fontSize:10, color:"var(--text-muted)" }}>
                      {es ? "Mínimo 6 caracteres" : "Minimum 6 characters"}
                    </span>
                  )}
                </div>

                {authError && <ErrorBox msg={authError} />}
                {success   && <SuccessBox msg={success} />}

                <button className="btn btn-primary" onClick={handleSubmit}
                  disabled={loading || !email || !password}
                  style={{ width:"100%", justifyContent:"center", padding:"11px", marginTop:4 }}>
                  {loading
                    ? <><Loader size={15} style={{ animation:"spin 0.8s linear infinite" }} /> {es?"Cargando...":"Loading..."}</>
                    : mode === "login"
                      ? (es ? "Iniciar Sesión" : "Sign In")
                      : (es ? "Crear Cuenta"  : "Create Account")}
                </button>

                {/* Forgot password link */}
                {mode === "login" && (
                  <button onClick={() => switchMode("reset")}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"var(--accent-blue)", fontSize:12, textAlign:"center", marginTop:-4 }}>
                    {es ? "¿Olvidaste tu contraseña?" : "Forgot your password?"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:11, color:"var(--text-muted)" }}>
          {es
            ? "El primer usuario registrado será Administrador."
            : "The first registered user will be Administrator."}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 14px", background:"var(--accent-red-light)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:"var(--radius-md)", color:"var(--accent-red)", fontSize:13 }}>
      <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} /> {msg}
    </div>
  );
}

function SuccessBox({ msg }) {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 14px", background:"var(--accent-green-light)", border:"1px solid rgba(15,158,106,0.2)", borderRadius:"var(--radius-md)", color:"var(--accent-green)", fontSize:13 }}>
      <CheckCircle size={15} style={{ flexShrink:0, marginTop:1 }} /> {msg}
    </div>
  );
}

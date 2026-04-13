import { useLang } from "../../i18n/index.jsx";

export default function LangSwitcher() {
  const { lang, switchLang } = useLang();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, background:"var(--bg-elevated)", border:"1.5px solid var(--border-default)", borderRadius:"var(--radius-md)", padding:"2px 3px", height:32 }}>
      {[
        { code:"es", flag:"🇪🇸", label:"ES" },
        { code:"en", flag:"🇺🇸", label:"EN" },
      ].map(({ code, flag, label }) => (
        <button key={code} onClick={() => switchLang(code)}
          title={code === "es" ? "Español" : "English"}
          style={{
            display:"flex", alignItems:"center", gap:4,
            padding:"3px 8px", borderRadius:"var(--radius-sm)",
            border:"none", cursor:"pointer",
            fontWeight: lang === code ? 700 : 500,
            fontSize: 11,
            background: lang === code ? "var(--accent-blue)" : "transparent",
            color:       lang === code ? "#fff" : "var(--text-muted)",
            transition: "var(--transition)",
          }}>
          <span style={{ fontSize:13 }}>{flag}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

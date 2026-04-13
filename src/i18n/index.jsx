/**
 * i18n — Internationalization system
 * Usage: import { useT, useLang } from '../i18n'
 *   const t = useT();
 *   t.dashboard.title  → "Dashboard" | "Dashboard"
 *   t.nav.locations    → "Ubicaciones" | "Locations"
 */
import { createContext, useContext, useState, useEffect } from "react";
import es from "./es.js";
import en from "./en.js";

const TRANSLATIONS = { es, en };
const STORAGE_KEY  = "fleetcore_lang";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "es"; } catch { return "es"; }
  });

  const switchLang = (l) => {
    setLang(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const t = TRANSLATIONS[lang] || TRANSLATIONS.es;

  return (
    <LangContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT()    { const ctx = useContext(LangContext); return ctx ? { ...ctx.t, lang: ctx.lang } : { ...TRANSLATIONS.es, lang:'es' }; }
export function useLang() { return useContext(LangContext) || { lang:"es", switchLang:()=>{}, t:TRANSLATIONS.es }; }

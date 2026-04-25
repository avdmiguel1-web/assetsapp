import { useState, useEffect } from "react";
import { testConnection } from "../../lib/supabase";
import { useApp } from "../../stores/AppContext";
import { CheckCircle, XCircle, Loader, Database, X } from "lucide-react";

export default function SyncBanner() {
  const { syncError, clearSyncError } = useApp();
  const [status, setStatus] = useState("checking"); // checking | ok | error
  const [msg,    setMsg]    = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    testConnection().then(res => {
      if (res.ok) {
        setStatus("ok");
        setMsg("Supabase conectado correctamente");
        // Auto-hide after 4s if OK
        setTimeout(() => setVisible(false), 4000);
      } else {
        setStatus("error");
        setMsg(res.error);
      }
    });
  }, []);

  useEffect(() => {
    if (!syncError) return;
    setStatus("error");
    setMsg(syncError);
    setVisible(true);
  }, [syncError]);

  if (!visible) return null;

  const styles = {
    checking: { bg:"#f0f9ff", border:"#bae6fd", color:"#0369a1", icon:<Loader size={15} style={{ animation:"spin 1s linear infinite" }} /> },
    ok:       { bg:"#f0fdf4", border:"#bbf7d0", color:"#15803d", icon:<CheckCircle size={15} /> },
    error:    { bg:"#fef2f2", border:"#fecaca", color:"#dc2626", icon:<XCircle size={15} /> },
  }[status];

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"10px 16px", margin:"0 0 16px 0",
      background: styles.bg, border:`1px solid ${styles.border}`,
      borderRadius:"var(--radius-md)", fontSize:13, color: styles.color,
    }}>
      <Database size={15} />
      {styles.icon}
      <span style={{ flex:1 }}>
        <strong>Supabase:</strong> {msg || "Verificando conexión..."}
      </span>
      {status === "error" && (
        <details style={{ fontSize:11, cursor:"pointer" }}>
          <summary>¿Cómo solucionarlo?</summary>
          <div style={{ marginTop:6, lineHeight:1.6 }}>
            1. Verifica que el archivo <code>.env</code> esté en la raíz del proyecto<br/>
            2. Que contenga exactamente:<br/>
            <code>VITE_SUPABASE_PROJECT_ID=wnihkxryphhypnfjwyre</code><br/>
            <code>VITE_SUPABASE_URL=https://wnihkxryphhypnfjwyre.supabase.co</code><br/>
            <code>VITE_SUPABASE_ANON_KEY=sb_publishable_WZkWHgiiWwI7TGvctKhSEA_cn6TfvZE</code><br/>
            3. Reinicia el servidor: <code>npm run dev</code><br/>
            4. Abre DevTools → Console para ver el error exacto
          </div>
        </details>
      )}
      <button onClick={() => { setVisible(false); if (status === "error") clearSyncError(); }}
        style={{ background:"none", border:"none", cursor:"pointer", color:styles.color, padding:2 }}>
        <X size={14} />
      </button>
    </div>
  );
}

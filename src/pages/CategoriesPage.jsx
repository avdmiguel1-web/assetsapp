import { useEffect, useState } from "react";
import { useApp } from "../stores/AppContext";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import { Plus, Pencil, Trash2, X, AlertCircle, Search, Tag } from "lucide-react";

const PRESET_COLORS = [
  "#1d6fef","#0f9e6a","#d97706","#dc2626","#7c3aed",
  "#0891b2","#ea580c","#be185d","#065f46","#1e40af",
];

function CategoryModal({ open, onClose, editCat = null }) {
  const { addCategory, updateCategory, categories } = useApp();
  const t = useT();
  const isEdit = !!editCat;
  const [name,  setName]  = useState(editCat?.name  || "");
  const [color, setColor] = useState(editCat?.color || "#1d6fef");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editCat?.name || "");
    setColor(editCat?.color || "#1d6fef");
    setError("");
    setSaving(false);
  }, [open, editCat]);

  const save = async () => {
    if (!name.trim()) { setError(t.categories.required); return; }
    const dup = categories.find(c =>
      c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id !== editCat?.id
    );
    if (dup) { setError(t.categories.duplicate); return; }
    setSaving(true);
    try {
      await (isEdit
        ? updateCategory({ ...editCat, name: name.trim(), color })
        : addCategory({ name: name.trim(), color }));
      onClose();
    } catch (e) {
      setError(e.message || "No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? t.categories.modalTitleEdit : t.categories.modalTitleNew}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="form-group">
            <label className="form-label">{t.categories.nameLabel}</label>
            <input className="form-input" placeholder={t.categories.namePlaceholder}
              value={name} onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && save()}
              autoFocus
            />
            {error && <span style={{ fontSize:10, color:"var(--accent-red)" }}>{error}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">{t.categories.colorLabel}</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ width:28, height:28, borderRadius:"50%", background:c, border:color===c?"3px solid var(--text-primary)":"2px solid transparent", cursor:"pointer", flexShrink:0, transition:"var(--transition)" }} />
              ))}
              {/* Custom color picker */}
              <label style={{ position:"relative", cursor:"pointer" }} title="Color personalizado">
                <div style={{ width:28, height:28, borderRadius:"50%", background:!PRESET_COLORS.includes(color)?color:"var(--bg-elevated)", border:`2px solid var(--border-default)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🎨</div>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ position:"absolute", opacity:0, width:0, height:0 }} />
              </label>
              <div style={{ marginLeft:4, fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"var(--text-muted)" }}>{color}</div>
            </div>
            {/* Preview */}
            <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:20, background:`${color}22`, color, fontWeight:600, fontSize:12, border:`1px solid ${color}44` }}>
              <Tag size={12} /> {name || t.categories.namePlaceholder}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>{t.categories.cancel}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Plus size={14} /> {saving ? "Guardando..." : isEdit ? t.categories.save : t.categories.register}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { categories, assets, deleteCategory } = useApp();
  const { canDo } = useAuth();
  const t = useT();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat,   setEditCat]   = useState(null);
  const [search,    setSearch]    = useState("");

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const assetCount = (cat) => assets.filter(a => a.category === cat.name).length;

  const confirmDelete = (cat) => {
    const n = assetCount(cat);
    if (n > 0) { alert(t.categories.deleteBlocked(cat.name, n)); return; }
    if (window.confirm(t.categories.deleteConfirm(cat.name))) deleteCategory(cat.id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.categories.title}</h1>
          <p className="page-subtitle">{t.categories.subtitle(categories.length)}</p>
        </div>
        {canDo("category_create") && (
          <button className="btn btn-primary" onClick={() => { setEditCat(null); setModalOpen(true); }}>
            <Plus size={14} /> {t.categories.newBtn}
          </button>
        )}
      </div>

      {/* Search */}
      {categories.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="search-bar">
            <Search size={14} color="var(--text-muted)" />
            <input placeholder={t.categories.searchPlaceholder}
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}><X size={12} /></button>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 ? (
        <div className="card" style={{ border:"2px dashed var(--border-default)", boxShadow:"none" }}>
          <div className="empty-state" style={{ padding:"60px 24px" }}>
            <Tag size={48} color="var(--accent-blue)" style={{ opacity:0.25 }} />
            <p style={{ fontSize:15, fontWeight:600, color:"var(--text-secondary)" }}>{t.categories.noCategories}</p>
            <p style={{ maxWidth:340 }}>{t.categories.noCategoriesSub}</p>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> {t.categories.addFirst}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:12 }}>
          {filtered.map(cat => {
            const count = assetCount(cat);
            return (
              <div key={cat.id} className="card"
                style={{ borderLeft:`4px solid ${cat.color || "var(--accent-blue)"}`, transition:"var(--transition)" }}
                onMouseOver={e => e.currentTarget.style.boxShadow="var(--shadow-md)"}
                onMouseOut={e => e.currentTarget.style.boxShadow="var(--shadow-sm)"}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {/* Color dot */}
                  <div style={{ width:40, height:40, borderRadius:"var(--radius-md)", background:`${cat.color || "#1d6fef"}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Tag size={18} color={cat.color || "var(--accent-blue)"} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.name}</div>
                    <span className="badge" style={{ fontSize:10, marginTop:4, background:`${cat.color || "#1d6fef"}18`, color:cat.color || "var(--accent-blue)", border:`1px solid ${cat.color || "#1d6fef"}33` }}>
                      {t.categories.inUse(count)}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                    {canDo("category_edit") && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditCat(cat); setModalOpen(true); }}><Pencil size={13} /></button>}
                    {canDo("category_delete") && <button className="btn btn-ghost btn-icon btn-sm" style={{ color:"var(--accent-red)" }} onClick={() => confirmDelete(cat)}><Trash2 size={13} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CategoryModal open={modalOpen} onClose={() => { setModalOpen(false); setEditCat(null); }} editCat={editCat} />
    </div>
  );
}

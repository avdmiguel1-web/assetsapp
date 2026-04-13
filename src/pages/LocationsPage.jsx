import { useEffect, useMemo, useState } from "react";
import { useApp } from "../stores/AppContext";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import { Plus, Pencil, Trash2, MapPin, X, Search } from "lucide-react";
import { COUNTRY_PRESETS, findCountryPreset, flagFromCountryCode } from "../lib/countries";

const EMPTY_LOCATION = { name: "", country: "", address: "", description: "" };
const EMPTY_COUNTRY = { name: "", flag: "" };

function LocationModal({ open, onClose, editLocation = null }) {
  const { addLocation, updateLocation, locations, countryOptions, FLAG_MAP } = useApp();
  const t = useT();
  const isEdit = !!editLocation;
  const [form, setForm] = useState(editLocation ?? EMPTY_LOCATION);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(editLocation ?? EMPTY_LOCATION);
    setErrors({});
  }, [editLocation, open]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = t.common.required;
    if (!form.country.trim()) nextErrors.country = t.common.required;

    if (form.name.trim() && form.country.trim()) {
      const duplicate = locations.find((location) =>
        location.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
        location.country.toLowerCase() === form.country.toLowerCase() &&
        location.id !== form.id
      );
      if (duplicate) nextErrors.name = `Ya existe una ubicacion con este nombre en ${form.country}`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    isEdit ? updateLocation(form) : addLocation(form);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? t.locations.modalTitleEdit : t.locations.modalTitleNew}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{t.locations.modalSub}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{t.locations.nameLabel}</label>
            <input className="form-input" placeholder={t.locations.namePlaceholder} value={form.name} onChange={(event) => setField("name", event.target.value)} />
            {errors.name && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">{t.locations.countryLabel}</label>
            <select className="form-select" value={form.country} onChange={(event) => setField("country", event.target.value)}>
              <option value="">{t.locations.selectCountry}</option>
              {countryOptions.map((country) => (
                <option key={country.id} value={country.name}>{country.flag} {country.name}</option>
              ))}
            </select>
            {!!form.country && <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{FLAG_MAP[form.country] || "🏳"} {form.country}</span>}
            {errors.country && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.country}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">{t.locations.addressLabel}</label>
            <input className="form-input" placeholder={t.locations.addressPlaceholder} value={form.address} onChange={(event) => setField("address", event.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{t.locations.descLabel}</label>
            <textarea className="form-textarea" rows={3} placeholder={t.locations.descPlaceholder} value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.locations.cancel}</button>
          <button className="btn btn-primary" onClick={save}><Plus size={14} />{isEdit ? t.locations.save : t.locations.register}</button>
        </div>
      </div>
    </div>
  );
}

function CountryModal({ open, onClose, editCountry = null }) {
  const { addCountry, updateCountry, countryOptions } = useApp();
  const isEdit = !!editCountry;
  const [form, setForm] = useState(editCountry ?? EMPTY_COUNTRY);
  const [countryCode, setCountryCode] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(editCountry ?? EMPTY_COUNTRY);
    setCountryCode(findCountryPreset(editCountry?.name)?.code || "");
    setErrors({});
  }, [editCountry, open]);

  const setField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name") {
        const preset = findCountryPreset(value);
        if (preset) {
          setCountryCode(preset.code);
          next.name = preset.name;
          next.flag = preset.flag;
        }
      }
      return next;
    });
  };

  const handlePresetChange = (value) => {
    const preset = COUNTRY_PRESETS.find((country) => country.name === value);
    if (!preset) return;
    setCountryCode(preset.code);
    setForm((current) => ({ ...current, name: preset.name, flag: preset.flag }));
  };

  const handleCountryCodeChange = (value) => {
    const nextCode = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    setCountryCode(nextCode);
    setForm((current) => ({ ...current, flag: nextCode.length === 2 ? flagFromCountryCode(nextCode) : current.flag }));
  };

  const save = async () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Nombre requerido";
    if (!form.flag.trim()) nextErrors.flag = "Bandera requerida";

    const duplicate = countryOptions.find((country) =>
      country.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      country.id !== form.id
    );
    if (duplicate) nextErrors.name = "Ya existe un pais con este nombre";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (isEdit) await updateCountry({ ...editCountry, ...form, name: form.name.trim(), flag: form.flag.trim() });
    else await addCountry({ ...form, name: form.name.trim(), flag: form.flag.trim() });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Pais" : "Nuevo Pais"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Administra paises y banderas disponibles en el sistema.</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Seleccionar de la lista</label>
            <select className="form-select" value={findCountryPreset(form.name)?.name || ""} onChange={(event) => handlePresetChange(event.target.value)}>
              <option value="">Selecciona un pais sugerido</option>
              {COUNTRY_PRESETS
                .filter((country) => country.name === editCountry?.name || !countryOptions.some((item) => item.name.toLowerCase() === country.name.toLowerCase()))
                .map((country) => (
                  <option key={country.code} value={country.name}>{country.flag} {country.name}</option>
                ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              Al seleccionarlo se cargan automaticamente el nombre y la bandera.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del pais</label>
            <input className="form-input" placeholder="Ej: Venezuela" value={form.name} onChange={(event) => setField("name", event.target.value)} />
            {errors.name && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Codigo ISO del pais</label>
            <input className="form-input" placeholder="Ej: VE" value={countryCode} onChange={(event) => handleCountryCodeChange(event.target.value)} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              Si escribes el codigo de 2 letras, la bandera se genera automaticamente.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bandera detectada</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, padding: "0 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
              <span style={{ fontSize: 24 }}>{form.flag || "🏳"}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{form.name || "Sin pais seleccionado"}</span>
            </div>
            {errors.flag && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.flag}</span>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}><Plus size={14} />{isEdit ? "Guardar cambios" : "Registrar pais"}</button>
        </div>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const { locations, assets, FLAG_MAP, deleteLocation } = useApp();
  const t = useT();
  const { canDo } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const usedCountries = useMemo(
    () => [...new Set(locations.map((location) => location.country))].sort(),
    [locations]
  );

  const filtered = locations.filter((location) => {
    if (filterCountry && location.country !== filterCountry) return false;
    const query = search.toLowerCase();
    return !query || `${location.name} ${location.country} ${location.address}`.toLowerCase().includes(query);
  });

  const assetCount = (location) => assets.filter((asset) => asset.locationId === location.id || asset.location === location.name).length;

  const confirmDeleteLocation = (location) => {
    const count = assetCount(location);
    if (count > 0) {
      alert(t.locations.deleteBlocked(location.name, count));
      return;
    }
    if (window.confirm(t.locations.deleteConfirm(location.name))) deleteLocation(location.id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.locations.title}</h1>
          <p className="page-subtitle">{t.locations.subtitle(locations.length)}</p>
        </div>
        {canDo("location_create") && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => setCountryOpen(true)}>
              <Plus size={14} /> Nuevo pais
            </button>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> {t.locations.newBtn}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={14} color="var(--text-muted)" />
            <input placeholder={t.locations.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}><X size={12} /></button>}
          </div>
          {usedCountries.length > 1 && (
            <select className="form-select" style={{ width: "auto" }} value={filterCountry} onChange={(event) => setFilterCountry(event.target.value)}>
              <option value="">{t.locations.allCountries}</option>
              {usedCountries.map((country) => <option key={country}>{FLAG_MAP[country] || ""} {country}</option>)}
            </select>
          )}
          {(search || filterCountry) && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--accent-red)" }} onClick={() => { setSearch(""); setFilterCountry(""); }}>
              <X size={13} /> {t.locations.clear}
            </button>
          )}
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="card" style={{ border: "2px dashed var(--border-default)", boxShadow: "none" }}>
          <div className="empty-state" style={{ padding: "60px 24px" }}>
            <MapPin size={48} color="var(--accent-blue)" style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{t.locations.noLocations}</p>
            <p style={{ maxWidth: 340 }}>{t.locations.noLocationsSub}</p>
            {canDo("location_create") && <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> {t.locations.registerFirst}</button>}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><Search size={28} /><p>Sin resultados.</p></div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
          {filtered.map((location) => {
            const count = assetCount(location);
            const flag = FLAG_MAP[location.country] || "🏳";
            return (
              <div key={location.id} className="card" style={{ transition: "var(--transition)" }} onMouseOver={(event) => { event.currentTarget.style.boxShadow = "var(--shadow-md)"; }} onMouseOut={(event) => { event.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", background: "var(--accent-blue-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                      {flag}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{location.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{flag} {location.country}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {canDo("location_edit") && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditLoc(location)}><Pencil size={13} /></button>}
                    {canDo("location_delete") && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-red)" }} onClick={() => confirmDeleteLocation(location)}><Trash2 size={13} /></button>}
                  </div>
                </div>
                {location.address && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, display: "flex", gap: 5, alignItems: "flex-start" }}>
                    <MapPin size={11} color="var(--text-muted)" style={{ marginTop: 1, flexShrink: 0 }} />{location.address}
                  </div>
                )}
                {location.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{location.description}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                  <span className={`badge ${count > 0 ? "badge-blue" : "badge-muted"}`}>{t.locations.assets(count)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LocationModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editLoc && <LocationModal open onClose={() => setEditLoc(null)} editLocation={editLoc} />}
      <CountryModal open={countryOpen} onClose={() => setCountryOpen(false)} />
    </div>
  );
}

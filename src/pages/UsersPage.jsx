import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import { supabase } from "../lib/supabase";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, defaultPermissions } from "../lib/permissions";
import { dbInsertAuditLog } from "../lib/db";
import {
  Shield, ShieldOff, Save, ChevronDown, ChevronUp,
  X, Loader, CheckCircle, UserX, Search,
  Pencil, Eye, EyeOff, AlertCircle
} from "lucide-react";

async function fetchAllUsers() {
  if (!supabase) return [];
  const { data: profiles } = await supabase.from("user_profiles").select("*").order("created_at");
  const { data: perms } = await supabase.from("user_permissions").select("*");
  return (profiles || []).map((profile) => ({
    ...profile,
    permissions: perms?.find((item) => item.user_id === profile.id)?.permissions ?? null,
  }));
}

async function saveUserPermissions(userId, permissions) {
  if (!supabase) return;
  await supabase.from("user_permissions").upsert(
    [{ id: `perm-${userId}`, user_id: userId, permissions, updated_at: new Date().toISOString() }],
    { onConflict: "user_id" }
  );
}

async function setUserRole(userId, role) {
  if (!supabase) return;
  await supabase.from("user_profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", userId);
}

async function deleteUserAccount(userId) {
  if (!supabase) throw new Error("No hay conexion con Supabase.");
  const rpcResponse = await supabase.rpc("admin_delete_user", { target_user_id: userId });

  if (!rpcResponse.error) {
    if (rpcResponse.data?.error) throw new Error(rpcResponse.data.error);
    return rpcResponse.data || { ok: true };
  }

  const rpcMessage = rpcResponse.error.message || "";
  const rpcMissing =
    /Could not find the function/i.test(rpcMessage) ||
    /admin_delete_user/i.test(rpcMessage);

  if (!rpcMissing) {
    throw new Error(rpcMessage);
  }

  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { userId },
  });

  if (error) {
    throw new Error(
      `No se pudo eliminar el usuario. Ejecuta el SQL 'supabase-delete-user-rpc.sql' en Supabase o despliega la funcion 'delete-user'. Detalle: ${error.message}`
    );
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

async function manageUserAccount({ userId, fullName, email, password }) {
  if (!supabase) throw new Error("No hay conexion con Supabase.");
  const { data, error } = await supabase.rpc("manage_user_account", {
    target_user_id: userId,
    new_full_name: fullName?.trim() || null,
    new_email: email?.trim() || null,
    new_password: password?.trim() || null,
  });

  if (error) {
    const detail = error.message || "";
    if (/gen_salt|crypt/i.test(detail)) {
      throw new Error(
        "No se pudo actualizar el usuario. Ejecuta nuevamente el SQL 'supabase-manage-user-rpc.sql' actualizado en Supabase para habilitar pgcrypto correctamente."
      );
    }
    throw new Error(
      `No se pudo actualizar el usuario. Ejecuta el SQL 'supabase-manage-user-rpc.sql' en Supabase. Detalle: ${detail}`
    );
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

function PermissionEditor({ user, onSaved }) {
  const t = useT();
  const lang = t.lang;
  const [perms, setPerms] = useState(() => user.permissions ?? defaultPermissions());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => setPerms((current) => ({ ...current, [key]: !current[key] }));
  const toggleGroup = (groupId) => {
    const keys = Object.entries(ALL_PERMISSIONS).filter(([, value]) => value.group === groupId).map(([key]) => key);
    const allOn = keys.every((key) => perms[key]);
    setPerms((current) => {
      const next = { ...current };
      keys.forEach((key) => { next[key] = !allOn; });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveUserPermissions(user.id, perms);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved?.();
  };

  const groups = Object.entries(PERMISSION_GROUPS);

  return (
    <div style={{ marginTop: 16 }}>
      {groups.map(([groupId, groupMeta]) => {
        const groupPerms = Object.entries(ALL_PERMISSIONS).filter(([, value]) => value.group === groupId);
        if (!groupPerms.length) return null;
        const isExpanded = expanded[groupId] !== false;
        const allOn = groupPerms.every(([key]) => perms[key]);
        const someOn = groupPerms.some(([key]) => perms[key]);

        return (
          <div key={groupId} style={{ marginBottom: 8, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-elevated)", cursor: "pointer" }}
              onClick={() => setExpanded((current) => ({ ...current, [groupId]: !isExpanded }))}
            >
              <input
                type="checkbox"
                checked={allOn}
                ref={(element) => { if (element) element.indeterminate = !allOn && someOn; }}
                onChange={() => toggleGroup(groupId)}
                onClick={(event) => event.stopPropagation()}
                style={{ width: 15, height: 15, accentColor: "var(--accent-blue)", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 700, fontSize: 12, flex: 1, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                {lang === "en" ? groupMeta.labelEn : groupMeta.label}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {groupPerms.filter(([key]) => perms[key]).length}/{groupPerms.length}
              </span>
              {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
            </div>
            {isExpanded && groupPerms.map(([key, meta]) => (
              <label
                key={key}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 22px", cursor: "pointer", borderTop: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
                onMouseOver={(event) => { event.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseOut={(event) => { event.currentTarget.style.background = ""; }}
              >
                <input
                  type="checkbox"
                  checked={!!perms[key]}
                  onChange={() => toggle(key)}
                  style={{ width: 14, height: 14, accentColor: "var(--accent-blue)", cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
                  {lang === "en" ? meta.labelEn : meta.label}
                </span>
                <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "var(--text-muted)" }}>{key}</span>
              </label>
            ))}
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 8 }}>
          {saving ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {lang === "en" ? "Saving..." : "Guardando..."}</>
            : saved ? <><CheckCircle size={14} /> {lang === "en" ? "Saved!" : "Guardado!"}</>
            : <><Save size={14} /> {lang === "en" ? "Save permissions" : "Guardar permisos"}</>}
        </button>
      </div>
    </div>
  );
}

function EditUserModal({ open, onClose, user, isSelf, onSaved, actor }) {
  const t = useT();
  const lang = t.lang;
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.full_name || "");
    setEmail(user.email || "");
    setNewPassword("");
    setConfirmPass("");
    setError("");
    setSuccess("");
  }, [open, user]);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError(lang === "en" ? "Full name is required." : "El nombre completo es obligatorio.");
      return;
    }

    if (!email.trim()) {
      setError(lang === "en" ? "Email is required." : "El correo es obligatorio.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError(lang === "en" ? "Password must be at least 6 characters." : "La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword && newPassword !== confirmPass) {
      setError(lang === "en" ? "Passwords do not match." : "Las contrasenas no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const normalizedCurrentName = (user.full_name || "").trim();
      const normalizedCurrentEmail = (user.email || "").trim().toLowerCase();
      const normalizedNextName = fullName.trim();
      const normalizedNextEmail = email.trim().toLowerCase();

      const result = await manageUserAccount({
        userId: user.id,
        fullName: normalizedNextName !== normalizedCurrentName ? fullName : null,
        email: normalizedNextEmail !== normalizedCurrentEmail ? email : null,
        password: newPassword.trim() ? newPassword : null,
      });

      await dbInsertAuditLog({
        id: crypto.randomUUID(),
        userId: actor?.id ?? null,
        userEmail: actor?.email ?? null,
        userName: actor?.full_name ?? null,
        action: "update",
        entityType: "user",
        entityId: user.id,
        entityLabel: normalizedNextEmail || normalizedNextName || user.email,
        details: {
          changedFields: [
            ...(normalizedNextName !== normalizedCurrentName ? ["full_name"] : []),
            ...(normalizedNextEmail !== normalizedCurrentEmail ? ["email"] : []),
            ...(newPassword.trim() ? ["password"] : []),
          ],
          before: {
            fullName: user.full_name || "",
            email: user.email || "",
          },
          after: {
            fullName: normalizedNextName,
            email: normalizedNextEmail,
          },
        },
        createdAt: new Date().toISOString(),
      });

      setSaving(false);
      setSuccess(result?.message || (lang === "en" ? "Changes saved!" : "Cambios guardados!"));
      await onSaved?.();
      if (isSelf) refreshProfile?.();
      setTimeout(() => onClose(), 1200);
    } catch (saveError) {
      setSaving(false);
      setError(saveError.message || (lang === "en" ? "Could not save changes." : "No se pudieron guardar los cambios."));
    }
  };

  if (!open || !user) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{lang === "en" ? "Edit User" : "Editar Usuario"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{user.email}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{lang === "en" ? "Full name" : "Nombre completo"}</label>
            <input
              className="form-input"
              placeholder={lang === "en" ? "Full name" : "Nombre completo"}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{lang === "en" ? "Email" : "Correo"}</label>
            <input
              className="form-input"
              type="email"
              placeholder={lang === "en" ? "Email" : "Correo"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {lang === "en" ? "Change password" : "Cambiar contrasena"}
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">{lang === "en" ? "New password" : "Nueva contrasena"}</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showPass ? "text" : "password"}
                  placeholder={lang === "en" ? "Minimum 6 characters" : "Minimo 6 caracteres"}
                  style={{ paddingRight: 40 }}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((current) => !current)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {newPassword && (
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Confirm password" : "Confirmar contrasena"}</label>
                <input
                  className="form-input"
                  type={showPass ? "text" : "password"}
                  placeholder={lang === "en" ? "Repeat password" : "Repite la contrasena"}
                  value={confirmPass}
                  onChange={(event) => setConfirmPass(event.target.value)}
                />
              </div>
            )}
          </div>

          {error && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", background: "var(--accent-red-light)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--radius-md)", color: "var(--accent-red)", fontSize: 13 }}><AlertCircle size={15} />{error}</div>}
          {success && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", background: "var(--accent-green-light)", border: "1px solid rgba(15,158,106,0.2)", borderRadius: "var(--radius-md)", color: "var(--accent-green)", fontSize: 13 }}><CheckCircle size={15} />{success}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{lang === "en" ? "Cancel" : "Cancelar"}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} /> {lang === "en" ? "Saving..." : "Guardando..."}</>
              : <><Save size={13} /> {lang === "en" ? "Save changes" : "Guardar cambios"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { profile: me } = useAuth();
  const t = useT();
  const lang = t.lang;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPerm, setExpandedPerm] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const logUserAction = async ({ action, targetUser, details = {} }) => {
    if (!me?.id) return;
    await dbInsertAuditLog({
      id: crypto.randomUUID(),
      userId: me.id,
      userEmail: me.email ?? null,
      userName: me.full_name ?? null,
      action,
      entityType: "user",
      entityId: targetUser?.id ?? null,
      entityLabel: targetUser?.email || targetUser?.full_name || targetUser?.id || null,
      details,
      createdAt: new Date().toISOString(),
    });
  };

  const handleRoleToggle = async (user) => {
    setActionError("");
    setActionSuccess("");
    const newRole = user.role === "admin" ? "user" : "admin";
    if (user.id === me?.id && newRole !== "admin") {
      alert(lang === "en" ? "You cannot remove your own admin role." : "No puedes quitarte el rol de administrador.");
      return;
    }
    await setUserRole(user.id, newRole);
    await logUserAction({
      action: "update",
      targetUser: user,
      details: {
        changedFields: ["role"],
        before: { role: user.role },
        after: { role: newRole },
      },
    });
    load();
  };

  const handleDeleteUser = async (user) => {
    setActionError("");
    setActionSuccess("");

    if (user.role === "admin") {
      alert(lang === "en" ? "Administrators cannot be deleted from this screen." : "Los administradores no se pueden eliminar desde esta pantalla.");
      return;
    }

    if (user.id === me?.id) {
      alert(lang === "en" ? "You cannot delete your own account." : "No puedes eliminar tu propia cuenta.");
      return;
    }

    const message = lang === "en"
      ? `Delete "${user.full_name || user.email}" permanently? This will remove the account from Auth and from the users table.`
      : `Eliminar definitivamente a "${user.full_name || user.email}"? Esto borrara la cuenta de Auth y de la tabla de usuarios.`;

    if (!window.confirm(message)) return;

    try {
      setDeletingUserId(user.id);
      const result = await deleteUserAccount(user.id);
      setActionSuccess(result?.message || (lang === "en" ? "User deleted successfully." : "Usuario eliminado correctamente."));
      if (editUser?.id === user.id) setEditUser(null);
      await load();
    } catch (error) {
      setActionError(error.message || (lang === "en" ? "The user could not be deleted." : "No se pudo eliminar el usuario."));
    } finally {
      setDeletingUserId("");
    }
  };

  const filtered = users.filter((user) =>
    `${user.full_name} ${user.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === "en" ? "Users" : "Usuarios"}</h1>
          <p className="page-subtitle">
            {lang === "en"
              ? `${users.length} registered user${users.length !== 1 ? "s" : ""}`
              : `${users.length} usuario${users.length !== 1 ? "s" : ""} registrado${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input
            placeholder={lang === "en" ? "Search by name or email..." : "Buscar por nombre o email..."}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}><X size={12} /></button>}
        </div>
      </div>

      {actionError && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", marginBottom: 16, background: "var(--accent-red-light)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--radius-md)", color: "var(--accent-red)", fontSize: 13 }}>
          <AlertCircle size={15} />
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", marginBottom: 16, background: "var(--accent-green-light)", border: "1px solid rgba(15,158,106,0.2)", borderRadius: "var(--radius-md)", color: "var(--accent-green)", fontSize: 13 }}>
          <CheckCircle size={15} />
          {actionSuccess}
        </div>
      )}

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>{lang === "en" ? "Loading..." : "Cargando..."}</span></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((user) => {
            const isMe = user.id === me?.id;
            const isPermOpen = expandedPerm === user.id;
            const canDelete = user.role !== "admin";

            return (
              <div key={user.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: user.role === "admin" ? "var(--accent-blue-light)" : "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20, border: `2px solid ${user.role === "admin" ? "var(--accent-blue-mid)" : "var(--border-default)"}` }}>
                    {user.role === "admin" ? "👑" : "👤"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{user.full_name || user.email}</span>
                      {isMe && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--border-default)" }}>
                          {lang === "en" ? "(you)" : "(tu)"}
                        </span>
                      )}
                      <span className={`badge ${user.role === "admin" ? "badge-blue" : "badge-muted"}`}>
                        {user.role === "admin" ? (lang === "en" ? "Administrator" : "Administrador") : (lang === "en" ? "User" : "Usuario")}
                      </span>
                      <span className={`badge ${user.is_active ? "badge-green" : "badge-red"}`}>
                        {user.is_active ? (lang === "en" ? "Active" : "Activo") : (lang === "en" ? "Inactive" : "Inactivo")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{user.email}</div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(user)} style={{ gap: 5 }}>
                      <Pencil size={13} />
                      {lang === "en" ? "Edit" : "Editar"}
                    </button>

                    <button className="btn btn-secondary btn-sm" onClick={() => handleRoleToggle(user)} style={{ gap: 5 }}>
                      {user.role === "admin" ? <ShieldOff size={13} /> : <Shield size={13} />}
                      {user.role === "admin" ? (lang === "en" ? "Make User" : "Usuario") : (lang === "en" ? "Make Admin" : "Admin")}
                    </button>

                    {canDelete && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ gap: 5, color: "var(--accent-red)" }}
                        onClick={() => handleDeleteUser(user)}
                        disabled={deletingUserId === user.id}
                      >
                        {deletingUserId === user.id
                          ? <Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                          : <UserX size={13} />}
                        {deletingUserId === user.id
                          ? (lang === "en" ? "Deleting..." : "Eliminando...")
                          : (lang === "en" ? "Delete" : "Eliminar")}
                      </button>
                    )}

                    {user.role !== "admin" && (
                      <button className={`btn btn-sm ${isPermOpen ? "btn-primary" : "btn-secondary"}`} onClick={() => setExpandedPerm(isPermOpen ? null : user.id)} style={{ gap: 5 }}>
                        {isPermOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {lang === "en" ? "Permissions" : "Permisos"}
                      </button>
                    )}
                  </div>
                </div>

                {isPermOpen && user.role !== "admin" && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "10px 0 4px" }}>
                      {lang === "en"
                        ? `Configuring permissions for: ${user.full_name || user.email}`
                        : `Configurando permisos para: ${user.full_name || user.email}`}
                    </div>
                    <PermissionEditor user={user} onSaved={load} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editUser && (
        <EditUserModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          isSelf={editUser.id === me?.id}
          actor={me}
          onSaved={load}
        />
      )}
    </div>
  );
}

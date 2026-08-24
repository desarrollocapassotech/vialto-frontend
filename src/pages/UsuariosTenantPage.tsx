import { useAuth, useUser } from "@clerk/clerk-react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { apiFetch, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { PlatformUser } from "@/types/api";

type TenantUser = Pick<
  PlatformUser,
  "userId" | "firstName" | "lastName" | "email" | "role" | "createdAt"
>;

type ModalState =
  | { mode: "view"; user: TenantUser }
  | {
      mode: "edit-role";
      user: TenantUser;
      selectedRole: "admin" | "member" | "stock_viewer" | "stock_operator";
    }
  | { mode: "invite" };

function formatRole(role: string) {
  if (role === "org:admin") return "Administrador";
  if (role === "org:stock_viewer") return "Consulta de stock";
  if (role === "org:stock_operator") return "Operador de stock";
  return "Miembro";
}

function formatDate(value: number | string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function toApiRole(role: string): "admin" | "member" | "stock_viewer" | "stock_operator" {
  if (role === "org:admin") return "admin";
  if (role === "org:stock_viewer") return "stock_viewer";
  if (role === "org:stock_operator") return "stock_operator";
  return "member";
}

function getFullName(u: TenantUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

// ─── Modal de usuario (ver / editar rol) ────────────────────────────────────

function UsuarioModal({
  modal,
  currentUserId,
  busy,
  tieneModuloStock,
  onClose,
  onStartEditRole,
  onSaveRole,
  onSetSelectedRole,
  onDelete,
}: {
  modal: Extract<ModalState, { mode: "view" | "edit-role" }>;
  currentUserId: string | null | undefined;
  busy: boolean;
  tieneModuloStock: boolean;
  onClose: () => void;
  onStartEditRole: () => void;
  onSaveRole: () => void;
  onSetSelectedRole: (
    role: "admin" | "member" | "stock_viewer" | "stock_operator",
  ) => void;
  onDelete: () => void;
}) {
  const user = modal.user;
  const nombre = getFullName(user);
  const esMismoUsuario = user.userId === currentUserId;

  if (modal.mode === "edit-role") {
    return (
      <ViewModalShell
        title={nombre}
        onClose={onClose}
        maxWidthClass="sm:max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className={viewModalBtnGhost}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveRole}
              disabled={busy}
              className={viewModalBtnPrimary}
            >
              {busy ? "Guardando…" : "Guardar rol"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-vialto-steel">
            Elegí el nuevo rol para{" "}
            <strong className="text-vialto-charcoal">{nombre}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            {(["admin", "member", "stock_viewer", "stock_operator"] as const)
              .filter((r) => (r !== "stock_viewer" && r !== "stock_operator") || tieneModuloStock)
              .map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-4 py-3 hover:bg-vialto-mist"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={modal.selectedRole === r}
                    onChange={() => onSetSelectedRole(r)}
                    className="accent-vialto-fire"
                  />
                  <span className="text-sm font-medium text-vialto-charcoal">
                    {r === "admin"
                      ? "Administrador"
                      : r === "stock_viewer"
                        ? "Consulta de stock"
                        : r === "stock_operator"
                          ? "Operador de stock"
                          : "Miembro"}
                  </span>
                </label>
              ))}
          </div>
        </div>
      </ViewModalShell>
    );
  }

  return (
    <ViewModalShell
      title={nombre}
      onClose={onClose}
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {!esMismoUsuario && (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-wider border border-red-200 text-red-800 bg-white hover:bg-red-50 md:min-h-0"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={onStartEditRole}
                className={viewModalBtnPrimary}
              >
                Editar rol
              </button>
            </>
          )}
        </>
      }
    >
      <div className={viewModalGridClass}>
        {[
          { label: "Nombre", value: nombre },
          { label: "Email", value: user.email ?? "—" },
          { label: "Rol", value: formatRole(user.role) },
          { label: "Alta", value: formatDate(user.createdAt) },
        ].map((c) => (
          <div key={c.label}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
              {c.label}
            </p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>
      {esMismoUsuario && (
        <p className="mt-4 text-xs text-vialto-steel">
          No podés modificar tu propio rol ni eliminarte de la organización.
        </p>
      )}
    </ViewModalShell>
  );
}

// ─── Modal de creación de usuario ───────────────────────────────────────────

function CreateUserModal({
  busy,
  error,
  tieneModuloStock,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  tieneModuloStock: boolean;
  onClose: () => void;
  onSubmit: (
    name: string,
    email: string,
    password: string,
    role: "admin" | "member" | "stock_viewer" | "stock_operator",
  ) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<
    "admin" | "member" | "stock_viewer" | "stock_operator"
  >("member");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Ingresá el nombre del usuario.";
    if (!email.trim()) errors.email = "Ingresá el email del usuario.";
    if (!password || password.length < 8)
      errors.password = "La contraseña debe tener al menos 8 caracteres.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(name, email, password, role);
  }

  const inputClass = (field: string) =>
    `mt-1 w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-fire ${fieldErrors[field] ? "border-red-400" : "border-black/15"}`;

  return (
    <ViewModalShell
      title="Crear usuario"
      onClose={onClose}
      maxWidthClass="sm:max-w-sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={viewModalBtnGhost}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={viewModalBtnPrimary}
          >
            {busy ? "Creando…" : "Crear usuario"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            className="text-xs uppercase tracking-[0.08em] text-vialto-steel"
            htmlFor="cu-name"
          >
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="cu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Pérez"
            className={inputClass("name")}
            disabled={busy}
          />
          <CrudFieldError message={fieldErrors.name} />
        </div>
        <div>
          <label
            className="text-xs uppercase tracking-[0.08em] text-vialto-steel"
            htmlFor="cu-email"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="cu-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            className={inputClass("email")}
            disabled={busy}
          />
          <CrudFieldError message={fieldErrors.email} />
        </div>
        <div>
          <label
            className="text-xs uppercase tracking-[0.08em] text-vialto-steel"
            htmlFor="cu-password"
          >
            Contraseña <span className="text-red-500">*</span>
          </label>
          <input
            id="cu-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={inputClass("password")}
            disabled={busy}
          />
          <CrudFieldError message={fieldErrors.password} />
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Rol
          </p>
          <div className="flex flex-col gap-2">
            {(["member", "admin", "stock_viewer", "stock_operator"] as const)
              .filter((r) => (r !== "stock_viewer" && r !== "stock_operator") || tieneModuloStock)
              .map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-4 py-3 hover:bg-vialto-mist"
                >
                  <input
                    type="radio"
                    name="cu-role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="accent-vialto-fire"
                  />
                  <span className="text-sm font-medium text-vialto-charcoal">
                    {r === "admin"
                      ? "Administrador"
                      : r === "stock_viewer"
                        ? "Consulta de stock"
                        : r === "stock_operator"
                          ? "Operador de stock"
                          : "Miembro"}
                  </span>
                </label>
              ))}
          </div>
        </div>
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </ViewModalShell>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function UsuariosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const { tenant } = useCurrentTenant();
  const tieneModuloStock = tenant?.modules?.includes("stock") ?? false;

  const [allRows, setAllRows] = useState<TenantUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TenantUser | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEmail, setFiltroEmail] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroEmail("");
    setFiltroRol("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroEmail || !!filtroRol;

  // Extracción de opciones únicas
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (allRows || [])
            .map(getFullName)
            .filter((v): v is string => !!v && v !== "—"),
        ),
      ).sort(),
    [allRows],
  );
  const opcionesEmail = useMemo(
    () =>
      Array.from(
        new Set(
          (allRows || []).map((r) => r.email).filter((v): v is string => !!v),
        ),
      ).sort(),
    [allRows],
  );
  const opcionesRol = useMemo(
    () =>
      Array.from(
        new Set(
          (allRows || []).map((r) => r.role).filter((v): v is string => !!v),
        ),
      ).sort(),
    [allRows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!allRows) return [];
    return allRows.filter((r) => {
      if (filtroNombre && getFullName(r) !== filtroNombre) return false;
      if (filtroEmail && r.email !== filtroEmail) return false;
      if (filtroRol && r.role !== filtroRol) return false;
      return true;
    });
  }, [allRows, filtroNombre, filtroEmail, filtroRol]);

  const load = useCallback(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setAllRows(null);
    (async () => {
      try {
        const data = await apiJson<TenantUser[]>("/api/users", () =>
          getToken(),
        );
        if (!cancelled) {
          setAllRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setAllRows(null);
          setError(friendlyError(e, "usuarios"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  async function handleSaveRole() {
    if (!modal || modal.mode !== "edit-role" || !modal.user.userId) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiJson(`/api/users/${modal.user.userId}/role`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ role: modal.selectedRole }),
      });
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, "usuarios"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete?.userId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/users/${confirmDelete.userId}`, () => getToken(), {
        method: "DELETE",
      });
      setConfirmDelete(null);
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, "usuarios"));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(
    name: string,
    email: string,
    password: string,
    role: "admin" | "member" | "stock_viewer" | "stock_operator",
  ) {
    setBusy(true);
    setActionError(null);
    try {
      await apiJson("/api/users", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      setModal(null);
      load();
    } catch (e) {
      setActionError(friendlyError(e, "usuarios"));
    } finally {
      setBusy(false);
    }
  }

  const meta = useMemo(() => {
    if (!rowsFiltradas) return null;
    const total = rowsFiltradas.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      total,
      page,
      pageSize,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }, [rowsFiltradas, page, pageSize]);

  const paginatedRows = useMemo(() => {
    if (!rowsFiltradas) return null;
    const start = (page - 1) * pageSize;
    return rowsFiltradas.slice(start, start + pageSize);
  }, [rowsFiltradas, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
        Usuarios
      </h1>
      <p className="mt-2 text-vialto-steel">
        Miembros de tu organización y sus roles de acceso.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        {anyFiltroActivo && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setModal({ mode: "invite" });
          }}
          className="inline-flex min-h-11 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite md:min-h-0 md:h-10"
        >
          Crear usuario
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {actionError && !modal && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={5}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Nombre"
                filterActive={!!filtroNombre}
                filterSignature={filtroNombre}
              >
                <select
                  value={filtroNombre}
                  onChange={(e) => {
                    setFiltroNombre(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroNombre ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Nombre"
                >
                  <option value="">Todos</option>
                  {opcionesNombre.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Email"
                filterActive={!!filtroEmail}
                filterSignature={filtroEmail}
              >
                <select
                  value={filtroEmail}
                  onChange={(e) => {
                    setFiltroEmail(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroEmail ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Email"
                >
                  <option value="">Todos</option>
                  {opcionesEmail.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Rol"
                filterActive={!!filtroRol}
                filterSignature={filtroRol}
              >
                <select
                  value={filtroRol}
                  onChange={(e) => {
                    setFiltroRol(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroRol ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Rol"
                >
                  <option value="">Todos</option>
                  {opcionesRol.map((o) => (
                    <option key={o} value={o}>
                      {formatRole(o)}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Alta
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (u) => getFullName(u),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "email",
            header: "Email",
            cell: (u) => u.email ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "rol",
            header: "Rol",
            cell: (u) => formatRole(u.role),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "alta",
            header: "Alta",
            cell: (u) => formatDate(u.createdAt),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : paginatedRows}
        rowKey={(u) => u.userId ?? u.email ?? `${u.firstName}-${u.lastName}`}
        emptyMessage={
          anyFiltroActivo
            ? "No hay usuarios que coincidan con los filtros aplicados."
            : "No hay usuarios en esta organización."
        }
        loadingMessage="Cargando…"
        renderActions={(u) =>
          u.userId ? (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setModal({ mode: "view", user: u });
              }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          ) : (
            <span className="text-xs text-vialto-steel">—</span>
          )
        }
      />

      {meta && (rowsFiltradas?.length ?? 0) > 0 && (
        <div className="mt-4">
          <ListadoPagination
            meta={meta}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {modal && modal.mode !== "invite" && (
        <UsuarioModal
          modal={modal}
          currentUserId={user?.id}
          busy={busy}
          tieneModuloStock={tieneModuloStock}
          onClose={() => setModal(null)}
          onStartEditRole={() =>
            setModal({
              mode: "edit-role",
              user: modal.user,
              selectedRole: toApiRole(modal.user.role),
            })
          }
          onSaveRole={handleSaveRole}
          onSetSelectedRole={(r) =>
            setModal({ mode: "edit-role", user: modal.user, selectedRole: r })
          }
          onDelete={() => setConfirmDelete(modal.user)}
        />
      )}

      {modal?.mode === "invite" && (
        <CreateUserModal
          busy={busy}
          error={actionError}
          tieneModuloStock={tieneModuloStock}
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar usuario"
        message={
          confirmDelete
            ? `¿Eliminás a ${getFullName(confirmDelete)} de la organización? Perderá acceso de inmediato.`
            : ""
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

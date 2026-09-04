import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { CrudDangerZone } from "@/components/crud/CrudDangerZone";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import {
  CrudFieldLabel,
  CrudInput,
  CrudSelect,
} from "@/components/crud/CrudFields";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { CrudSubmitButton } from "@/components/crud/CrudSubmitButton";
import { PaisUbicacionSelect } from "@/components/forms/PaisUbicacionSelect";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useMaestroData } from "@/hooks/useMaestroData";
import {
  paisCodigoDesdeTexto,
  idFiscalPorPais,
  validarIdFiscal,
  condicionTributariaPorPais,
} from "@/lib/ciudades";
import type { PaisCodigo } from "@/lib/ciudades";
import type { Cliente } from "@/types/api";
import { useFieldConfig } from "@/hooks/useFieldConfig";

export function ClienteEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const { isVisible } = useFieldConfig("clientes");

  const [nombre, setNombre] = useState("");
  const [idFiscal, setIdFiscal] = useState("");
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [pais, setPais] = useState<PaisCodigo | "">("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [confirmarSinDatosFiscales, setConfirmarSinDatosFiscales] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const paisVisible = isVisible("edicion_cliente", "pais");
  const idFiscalVisible = isVisible("edicion_cliente", "idFiscal");
  const condicionVisible = isVisible("edicion_cliente", "condicionIvaTributaria");
  const direccionVisible = isVisible("edicion_cliente", "direccion");
  const emailVisible = isVisible("edicion_cliente", "email");
  const telefonoVisible = isVisible("edicion_cliente", "telefono");

  const faltanPais = paisVisible && !pais;
  const faltanIdFiscal = idFiscalVisible && !idFiscal.trim();
  const faltanDatosFiscales = faltanPais || faltanIdFiscal;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
          : `/api/clientes/${encodeURIComponent(id)}`;
        const row = await apiJson<Cliente>(path, () => getToken());
        if (!cancelled) {
          setNombre(row.nombre);
          setPais(paisCodigoDesdeTexto(row.pais ?? ""));
          setIdFiscal(row.idFiscal ?? "");
          setCondicionIva(row.condicionIva ?? null);
          setCondicionTributaria(row.condicionTributaria ?? "");
          setEmail(row.email ?? "");
          setTelefono(row.telefono ?? "");
          setDireccion(row.direccion ?? "");
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "clientes"));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  function handlePaisChange(newPais: PaisCodigo | "") {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria("");
  }

  async function onSave() {
    if (!id) return;
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "Ingresá el nombre del cliente.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    const errorFiscal = idFiscalVisible && idFiscal.trim()
      ? validarIdFiscal(pais, idFiscal.trim())
      : null;
    if (errorFiscal) {
      setFieldErrors({ idFiscal: errorFiscal });
      return;
    }
    // No aplica cuando se edita para otro tenant desde superadmin: maestro.clientes
    // refleja la organización activa de Clerk, no el tenant elegido por query param.
    if (!tenantId && idFiscal.trim()) {
      const yaExiste = maestro.clientes.some(
        (c) => c.id !== id && (c.idFiscal ?? "").trim() === idFiscal.trim(),
      );
      if (yaExiste) {
        setFieldErrors({ idFiscal: "Ya existe un cliente con ese ID Fiscal." });
        return;
      }
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/clientes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais: pais || "",
          idFiscal: idFiscal.trim(),
          condicionIva: pais === "AR" ? condicionIva : null,
          condicionTributaria:
            pais !== "AR" ? condicionTributaria.trim() : null,
          email: email.trim() || null,
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          confirmarSinDatosFiscales: faltanDatosFiscales
            ? confirmarSinDatosFiscales
            : undefined,
        }),
      });
      if (!tenantId) void maestro.refreshClientes();
      showToast("Cliente guardado exitosamente", "success");
      navigate(
        `/base-de-datos?tab=clientes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "clientes"));
      showToast("No se pudo guardar el cliente", "error");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || confirmDelete.trim() !== nombre.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/clientes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/clientes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), { method: "DELETE" });
      if (!tenantId) void maestro.refreshClientes();
      showToast("Cliente eliminado correctamente", "success");
      navigate(
        `/base-de-datos?tab=clientes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "clientes"));
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  const labelClass =
    "font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel";
  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscalVisible && idFiscal.trim()
    ? validarIdFiscal(pais, idFiscal.trim())
    : null;
  const idFiscalError = fieldErrors.idFiscal ?? errorFiscal;

  return (
    <CrudPageLayout
      title="Editar cliente"
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <CrudInput
                value={nombre}
                placeholder="Ej: Transportes del Norte SA"
                error={fieldErrors.nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <CrudFieldError message={fieldErrors.nombre} />
            </label>
            {paisVisible && (
              <label className="grid gap-1.5">
                <CrudFieldLabel>País (recomendado)</CrudFieldLabel>
                <PaisUbicacionSelect
                  value={pais}
                  onChange={handlePaisChange}
                  placeholder="Seleccioná un país"
                />
                <CrudFieldError message={fieldErrors.pais} />
              </label>
            )}
            {(idFiscalVisible || condicionVisible) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {idFiscalVisible && (
                  <label className="grid gap-1.5">
                    <CrudFieldLabel>
                      {idFiscalPorPais(pais).label} (recomendado)
                    </CrudFieldLabel>
                    <CrudInput
                      value={idFiscal}
                      placeholder={idFiscalPorPais(pais).placeholder}
                      error={idFiscalError || undefined}
                      onChange={(e) => setIdFiscal(e.target.value)}
                    />
                    <CrudFieldError message={idFiscalError} />
                  </label>
                )}
                {condicionVisible && (
                  <label className="grid gap-1.5">
                    <span className={labelClass}>{condInfo.label}</span>
                    {condInfo.type === "select" ? (
                      <CrudSelect
                        value={condicionIva ?? ""}
                        onChange={(e) =>
                          setCondicionIva(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Seleccioná una opción</option>
                        {condInfo.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </CrudSelect>
                    ) : (
                      <CrudInput
                        value={condicionTributaria}
                        placeholder={condInfo.placeholder}
                        onChange={(e) => setCondicionTributaria(e.target.value)}
                      />
                    )}
                  </label>
                )}
              </div>
            )}
            {faltanDatosFiscales && (
              <div className="space-y-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>
                  Estás guardando el cliente sin{" "}
                  {faltanPais && faltanIdFiscal
                    ? `país y/o ${idFiscalPorPais(pais).label.toLowerCase()}`
                    : faltanPais
                      ? "país"
                      : idFiscalPorPais(pais).label.toLowerCase()}
                  {" "}— esto puede afectar la facturación más adelante si no se completa.
                </p>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={confirmarSinDatosFiscales}
                    onChange={(e) =>
                      setConfirmarSinDatosFiscales(e.target.checked)
                    }
                    className="h-4 w-4 accent-vialto-charcoal"
                  />
                  Entiendo, guardar igual
                </label>
              </div>
            )}
            {direccionVisible && (
              <label className="grid gap-1.5">
                <span className={labelClass}>Dirección</span>
                <CrudInput
                  value={direccion}
                  placeholder="Ej: Av. Corrientes 1234"
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </label>
            )}
            {emailVisible && (
              <label className="grid gap-1.5">
                <span className={labelClass}>Email</span>
                <CrudInput
                  value={email}
                  placeholder="Ej: contacto@empresa.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {telefonoVisible && (
              <label className="grid gap-1.5">
                <span className={labelClass}>Teléfono</span>
                <CrudInput
                  value={telefono}
                  placeholder="Ej: +54 9 11 1234-5678"
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </label>
            )}
            <CrudFormErrorAlert message={error} />
            <CrudSubmitButton
              loading={loading}
              label="Guardar cambios"
              disabled={
                !!errorFiscal ||
                (faltanDatosFiscales && !confirmarSinDatosFiscales)
              }
            />
          </form>
          <CrudDangerZone
            message="Para eliminar este cliente, escribí su nombre exacto."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar cliente"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

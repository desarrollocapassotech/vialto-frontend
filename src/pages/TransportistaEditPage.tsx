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
import { TransportistaPautHelperNotice } from "@/components/transportistas/TransportistaPautHelperNotice";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useMaestroData } from "@/hooks/useMaestroData";
import {
  esPaisSoportado,
  idFiscalPorPais,
  validarIdFiscal,
  condicionTributariaPorPais,
} from "@/lib/ciudades";
import type { PaisCodigo } from "@/lib/ciudades";
import type { Transportista } from "@/types/api";
import { VencimientoPermisoInput } from "@/components/forms/VencimientoPermisoInput";
import { TelefonoInput } from "@/components/forms/TelefonoInput";
import { isValidPhoneNumber } from "libphonenumber-js";

export function TransportistaEditPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState<PaisCodigo | "">("");
  const [idFiscal, setIdFiscal] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState("");
  const [paut, setPaut] = useState("");
  const [permisoInternacional, setPermisoInternacional] = useState("");
  const [fechaVencimientoPermiso, setFechaVencimientoPermiso] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [confirmarSinDatosFiscales, setConfirmarSinDatosFiscales] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const faltanDatosFiscales = !pais || !idFiscal.trim();

  useEffect(() => {
    if (!id) return;
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setError(
              "No hay sesión con el servidor. Recargá la página o volvé a iniciar sesión.",
            );
            setInitialLoading(false);
          }
          return;
        }
        const withToken = async () => token;
        const detailPath = tenantId
          ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
          : `/api/transportistas/${encodeURIComponent(id)}`;
        const row = await apiJson<Transportista>(detailPath, withToken);
        if (!cancelled) {
          setNombre(row.nombre);
          setPais(
            esPaisSoportado(row.pais ?? "") ? (row.pais as PaisCodigo) : "",
          );
          setIdFiscal(row.idFiscal ?? "");
          setEmail(row.email ?? "");
          setTelefono(row.telefono ?? "");
          setDomicilio(row.domicilio ?? "");
          setCondicionIva(row.condicionIva ?? null);
          setCondicionTributaria(row.condicionTributaria ?? "");
          setPaut(row.paut ?? "");
          setPermisoInternacional(row.permisoInternacional ?? "");
          setFechaVencimientoPermiso(
            row.fechaVencimientoPermiso
              ? row.fechaVencimientoPermiso.slice(0, 10)
              : "",
          );
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "transportistas"));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId, isLoaded, isSignedIn]);

  function handlePaisChange(newPais: PaisCodigo | "") {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria("");
  }

  async function onSave() {
    if (!id) return;
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "Ingresá el nombre del transportista.";
    if (telefono.trim() && !isValidPhoneNumber(telefono)) {
      errs.telefono = "Ingresá un teléfono válido para el país seleccionado.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    const errorFiscal = idFiscal.trim()
      ? validarIdFiscal(pais, idFiscal.trim())
      : null;
    if (errorFiscal) {
      setFieldErrors({ idFiscal: errorFiscal });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais: pais || "",
          idFiscal: idFiscal.trim(),
          email: email.trim(),
          telefono: telefono,
          domicilio: domicilio.trim(),
          condicionIva: pais === "AR" ? condicionIva : null,
          condicionTributaria:
            pais !== "AR" ? condicionTributaria.trim() : null,
          paut: paut.trim(),
          permisoInternacional: permisoInternacional.trim(),
          fechaVencimientoPermiso: fechaVencimientoPermiso || null,
          confirmarSinDatosFiscales: faltanDatosFiscales
            ? confirmarSinDatosFiscales
            : undefined,
        }),
      });
      if (!tenantId) void maestro.refreshTransportistas();
      showToast("Transportista guardado exitosamente", "success");
      navigate(
        `/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "transportistas"));
      showToast("No se pudo guardar el transportista", "error");
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
        ? `/api/platform/transportistas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/transportistas/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), { method: "DELETE" });
      if (!tenantId) void maestro.refreshTransportistas();
      showToast("Transportista eliminado correctamente", "success");
      navigate(
        `/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "transportistas"));
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  const labelClass =
    "font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel";
  const sectionClass = "mt-2 border-t border-black/10 pt-4";
  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscal.trim()
    ? validarIdFiscal(pais, idFiscal.trim())
    : null;
  const idFiscalError = fieldErrors.idFiscal ?? errorFiscal;

  return (
    <CrudPageLayout
      title="Editar transportista"
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
            <label className="grid gap-1.5">
              <CrudFieldLabel>País (recomendado)</CrudFieldLabel>
              <PaisUbicacionSelect
                value={pais}
                onChange={handlePaisChange}
                placeholder="Seleccioná un país"
              />
              <CrudFieldError message={fieldErrors.pais} />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
            {faltanDatosFiscales && (
              <div className="space-y-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>
                  Estás guardando el transportista sin país y/o{" "}
                  {idFiscalPorPais(pais).label.toLowerCase()} — esto puede
                  afectar la facturación/liquidaciones más adelante si no se
                  completa.
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
            <label className="grid gap-1.5">
              <span className={labelClass}>Domicilio</span>
              <CrudInput
                value={domicilio}
                placeholder="Ej: Av. Libertador 1234, Buenos Aires"
                onChange={(e) => setDomicilio(e.target.value)}
              />
            </label>
            <TransportistaPautHelperNotice />
            <label className="grid gap-1.5">
              <span className={labelClass}>Email</span>
              <CrudInput
                value={email}
                placeholder="Ej: contacto@empresa.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Teléfono</span>
              <TelefonoInput
                pais={pais}
                value={telefono}
                onChange={setTelefono}
                error={fieldErrors.telefono}
              />
              <CrudFieldError message={fieldErrors.telefono} />
            </label>

            <div className={sectionClass}>
              <p className={`${labelClass} mb-3`}>Datos para Nómina</p>
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className={labelClass}>N° PAUT</span>
                  <CrudInput
                    placeholder="Ej: 17597"
                    value={paut}
                    onChange={(e) => setPaut(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Permiso Internacional</span>
                  <CrudInput
                    placeholder="Ej: 20113C19113"
                    value={permisoInternacional}
                    onChange={(e) => setPermisoInternacional(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>
                    Vencimiento Permiso Internacional
                  </span>
                  <VencimientoPermisoInput
                    value={fechaVencimientoPermiso}
                    onChange={setFechaVencimientoPermiso}
                  />
                </label>
              </div>
            </div>

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
            message="Para eliminar este transportista, escribí su nombre exacto."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === nombre.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar transportista"
          />
        </>
      )}
    </CrudPageLayout>
  );
}

import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
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
  idFiscalPorPais,
  validarIdFiscal,
  condicionTributariaPorPais,
} from "@/lib/ciudades";
import type { PaisCodigo } from "@/lib/ciudades";
import { VencimientoPermisoInput } from "@/components/forms/VencimientoPermisoInput";
import { TelefonoInput } from "@/components/forms/TelefonoInput";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useFieldConfig } from "@/hooks/useFieldConfig";

export function TransportistaCreatePage() {
  const { getToken } = useAuth();
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
  const [confirmarSinDatosFiscales, setConfirmarSinDatosFiscales] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { isVisible } = useFieldConfig("transportistas");
  const paisVisible = isVisible("alta_transportista", "pais");
  const idFiscalVisible = isVisible("alta_transportista", "idFiscal");
  const condicionVisible = isVisible("alta_transportista", "condicionIvaTributaria");
  const domicilioVisible = isVisible("alta_transportista", "domicilio");
  const emailVisible = isVisible("alta_transportista", "email");
  const telefonoVisible = isVisible("alta_transportista", "telefono");
  const pautVisible = isVisible("alta_transportista", "paut");
  const permisoInternacionalVisible = isVisible("alta_transportista", "permisoInternacional");
  const fechaVencimientoPermisoVisible = isVisible("alta_transportista", "fechaVencimientoPermiso");

  const faltanPais = paisVisible && !pais;
  const faltanIdFiscal = idFiscalVisible && !idFiscal.trim();
  const faltanDatosFiscales = faltanPais || faltanIdFiscal;

  function handlePaisChange(newPais: PaisCodigo | "") {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria("");
    setTelefono("");
  }

  async function onSubmit() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "Ingresá el nombre del transportista.";
    if (telefono.trim() && !isValidPhoneNumber(telefono)) {
      errs.telefono = "Ingresá un teléfono válido para el país seleccionado.";
    }
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
    // No aplica cuando se crea para otro tenant desde superadmin: maestro.transportistas
    // refleja la organización activa de Clerk, no el tenant elegido por query param.
    if (!tenantId && idFiscal.trim()) {
      const yaExiste = maestro.transportistas.some(
        (t) => (t.idFiscal ?? "").trim() === idFiscal.trim(),
      );
      if (yaExiste) {
        setFieldErrors({
          idFiscal: "Ya existe un transportista con ese ID Fiscal.",
        });
        return;
      }
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/transportistas?tenantId=${encodeURIComponent(tenantId)}`
        : "/api/transportistas";
      await apiJson(path, () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais: pais || undefined,
          idFiscal: idFiscal.trim() || undefined,
          email: email.trim() || undefined,
          telefono: telefono || undefined,
          domicilio: domicilio.trim() || undefined,
          condicionIva: pais === "AR" ? (condicionIva ?? undefined) : undefined,
          condicionTributaria:
            pais !== "AR" ? condicionTributaria.trim() || undefined : undefined,
          paut: paut.trim() || undefined,
          permisoInternacional: permisoInternacional.trim() || undefined,
          fechaVencimientoPermiso: fechaVencimientoPermiso || undefined,
          confirmarSinDatosFiscales: faltanDatosFiscales
            ? confirmarSinDatosFiscales
            : undefined,
        }),
      });
      if (!tenantId) void maestro.refreshTransportistas();
      showToast("Transportista creado exitosamente", "success");
      navigate(
        `/base-de-datos?tab=transportistas${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "transportistas"));
      showToast("No se pudo crear el transportista", "error");
    } finally {
      setLoading(false);
    }
  }

  const labelClass =
    "font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel";
  const sectionClass = "mt-2 border-t border-black/10 pt-4";
  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscalVisible && idFiscal.trim()
    ? validarIdFiscal(pais, idFiscal.trim())
    : null;
  const idFiscalError = fieldErrors.idFiscal ?? errorFiscal;

  const warningParts = [];
  if (faltanPais) warningParts.push("país");
  if (faltanIdFiscal) warningParts.push(idFiscalPorPais(pais).label.toLowerCase());
  const warningText = warningParts.join(" y/o ");

  return (
    <CrudPageLayout
      title="Crear transportista"
    >
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Nombre</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: Transportes del Norte SA"
            value={nombre}
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
                  placeholder={idFiscalPorPais(pais).placeholder}
                  value={idFiscal}
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
                    placeholder={condInfo.placeholder}
                    value={condicionTributaria}
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
              Estás guardando el transportista sin {warningText} — esto puede
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
        {domicilioVisible && (
          <label className="grid gap-1.5">
            <span className={labelClass}>Domicilio</span>
            <CrudInput
              placeholder="Ej: Av. Libertador 1234, Buenos Aires"
              value={domicilio}
              onChange={(e) => setDomicilio(e.target.value)}
            />
          </label>
        )}
        {emailVisible && (
          <label className="grid gap-1.5">
            <span className={labelClass}>Email</span>
            <CrudInput
              placeholder="Ej: contacto@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {telefonoVisible && (
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
        )}

        {(pautVisible || permisoInternacionalVisible || fechaVencimientoPermisoVisible) && (
          <div className={sectionClass}>
            <p className={`${labelClass} mb-3`}>Datos para Nómina</p>
            <div className="grid gap-4">
              {pautVisible && (
                <label className="grid gap-1.5">
                  <span className={labelClass}>N° PAUT</span>
                  <CrudInput
                    placeholder="Ej: 17597"
                    value={paut}
                    onChange={(e) => setPaut(e.target.value)}
                  />
                </label>
              )}
              {permisoInternacionalVisible && (
                <label className="grid gap-1.5">
                  <span className={labelClass}>Permiso Internacional</span>
                  <CrudInput
                    placeholder="Ej: 20113C19113"
                    value={permisoInternacional}
                    onChange={(e) => setPermisoInternacional(e.target.value)}
                  />
                </label>
              )}
              {fechaVencimientoPermisoVisible && (
                <label className="grid gap-1.5">
                  <span className={labelClass}>
                    Vencimiento Permiso Internacional
                  </span>
                  <VencimientoPermisoInput
                    value={fechaVencimientoPermiso}
                    onChange={setFechaVencimientoPermiso}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton
          loading={loading}
          label="Crear transportista"
          disabled={
            !!errorFiscal ||
            (faltanDatosFiscales && !confirmarSinDatosFiscales)
          }
        />
      </form>
    </CrudPageLayout>
  );
}

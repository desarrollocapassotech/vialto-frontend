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
import { useFieldConfig } from "@/hooks/useFieldConfig";

export function ClienteCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const { isVisible } = useFieldConfig("clientes");

  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState<PaisCodigo | "">("");
  const [idFiscal, setIdFiscal] = useState("");
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [confirmarSinDatosFiscales, setConfirmarSinDatosFiscales] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const paisVisible = isVisible("alta_cliente", "pais");
  const idFiscalVisible = isVisible("alta_cliente", "idFiscal");
  const condicionVisible = isVisible("alta_cliente", "condicionIvaTributaria");
  const direccionVisible = isVisible("alta_cliente", "direccion");
  const emailVisible = isVisible("alta_cliente", "email");
  const telefonoVisible = isVisible("alta_cliente", "telefono");

  const faltanPais = paisVisible && !pais;
  const faltanIdFiscal = idFiscalVisible && !idFiscal.trim();
  const faltanDatosFiscales = faltanPais || faltanIdFiscal;

  function handlePaisChange(newPais: PaisCodigo | "") {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria("");
  }

  async function onSubmit() {
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
    // No aplica cuando se crea para otro tenant desde superadmin: maestro.clientes
    // refleja la organización activa de Clerk, no el tenant elegido por query param.
    if (!tenantId && idFiscal.trim()) {
      const yaExiste = maestro.clientes.some(
        (c) => (c.idFiscal ?? "").trim() === idFiscal.trim(),
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
        ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
        : "/api/clientes";
      await apiJson(path, () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais: pais || undefined,
          idFiscal: idFiscal.trim() || undefined,
          condicionIva: pais === "AR" ? (condicionIva ?? undefined) : undefined,
          condicionTributaria:
            pais !== "AR" ? condicionTributaria.trim() || undefined : undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          confirmarSinDatosFiscales: faltanDatosFiscales
            ? confirmarSinDatosFiscales
            : undefined,
        }),
      });
      if (!tenantId) void maestro.refreshClientes();
      showToast("Cliente creado exitosamente", "success");
      navigate(
        `/base-de-datos?tab=clientes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "clientes"));
      showToast("No se pudo crear el cliente", "error");
    } finally {
      setLoading(false);
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
      title="Crear cliente"
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
              placeholder="Ej: Av. Corrientes 1234"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
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
            <CrudInput
              placeholder="Ej: +54 9 11 1234-5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </label>
        )}
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton
          loading={loading}
          label="Crear cliente"
          disabled={
            !!errorFiscal ||
            (faltanDatosFiscales && !confirmarSinDatosFiscales)
          }
        />
      </form>
    </CrudPageLayout>
  );
}

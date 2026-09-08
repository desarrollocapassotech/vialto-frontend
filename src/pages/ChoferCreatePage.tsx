import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { CrudSubmitButton } from "@/components/crud/CrudSubmitButton";
import {
  TransportistaAsignacionFields,
  type AsignacionModo,
} from "@/components/crud/TransportistaAsignacionFields";
import { apiJson } from "@/lib/api";
import {
  choferWritePayloadFromForm,
  validarDniForm,
  validarPinForm,
  type ChoferFormState,
} from "@/lib/choferForm";
import { friendlyError } from "@/lib/friendlyError";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useTransportistasList } from "@/hooks/useTransportistasList";
import { canAccessCombustible } from "@/lib/tenantModules";

const emptyForm = (): ChoferFormState => ({
  nombre: "",
  dni: "",
  cuit: "",
  telefono: "",
  licencia: "",
  licenciaVence: "",
  transportistaId: "",
});

export function ChoferCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const transportistasPlatform = useTransportistasList(
    tenantId || undefined,
    !tenantId,
  );
  const transportistas = tenantId
    ? (transportistasPlatform ?? [])
    : maestro.transportistas;
  const loadingTransportistas = tenantId
    ? transportistasPlatform === null
    : maestro.loading;

  const { showToast } = useToast();

  // Superadmin (tenantId en URL) siempre puede configurar PIN; tenant solo si tiene módulo combustible.
  const showPinField =
    !!tenantId || canAccessCombustible(maestro.tenant?.modules ?? []);
  const [form, setForm] = useState<ChoferFormState>(emptyForm);
  const [asignacionModo, setAsignacionModo] = useState<AsignacionModo>("propio");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function patch(p: Partial<ChoferFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function applyAsignacionModo(modo: AsignacionModo) {
    setAsignacionModo(modo);
    if (modo === "propio") patch({ transportistaId: "" });
  }

  async function onSubmit() {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = "Ingresá el nombre del chofer.";
    const dniError = validarDniForm(form.dni);
    if (dniError) errs.dni = dniError;
    if (asignacionModo === "externo" && !form.transportistaId.trim()) {
      errs.transportistaId = "Seleccioná un transportista o elegí flota propia.";
    }
    const pinError = showPinField ? validarPinForm(form.pin) : null;
    if (pinError) errs.pin = pinError;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    // No aplica cuando se crea para otro tenant desde superadmin: maestro.choferes
    // refleja la organización activa de Clerk, no el tenant elegido por query param.
    if (!tenantId && form.dni.trim()) {
      const yaExiste = maestro.choferes.some(
        (c) => (c.dni ?? "").trim() === form.dni.trim(),
      );
      if (yaExiste) {
        setFieldErrors({ dni: "Ya existe un chofer con ese DNI." });
        return;
      }
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`
        : "/api/choferes";
      await apiJson(path, () => getToken(), {
        method: "POST",
        body: JSON.stringify(choferWritePayloadFromForm(form)),
      });
      if (!tenantId) void maestro.refreshChoferes();

      showToast("Chofer creado exitosamente", "success");

      navigate(
        `/base-de-datos?tab=choferes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "choferes"));

      showToast("No se pudo crear el chofer", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear chofer"
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
            placeholder="Ej: Juan Perez"
            value={form.nombre}
            error={fieldErrors.nombre}
            onChange={(e) => patch({ nombre: e.target.value })}
          />
          <CrudFieldError message={fieldErrors.nombre} />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>DNI</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: 30123456"
            value={form.dni}
            error={fieldErrors.dni}
            onChange={(e) => patch({ dni: e.target.value })}
          />
          <CrudFieldError message={fieldErrors.dni} />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>CUIT</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: 20-30123456-7"
            value={form.cuit}
            onChange={(e) => patch({ cuit: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>Teléfono</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: +54 9 11 1234-5678"
            value={form.telefono}
            onChange={(e) => patch({ telefono: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>N.° licencia</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: B1234567"
            value={form.licencia}
            onChange={(e) => patch({ licencia: e.target.value })}
          />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel>Vencimiento de licencia</CrudFieldLabel>
          <CrudInput
            type="date"
            value={form.licenciaVence}
            onChange={(e) => patch({ licenciaVence: e.target.value })}
          />
        </label>
        <TransportistaAsignacionFields
          modo={asignacionModo}
          onModoChange={applyAsignacionModo}
          transportistaId={form.transportistaId}
          onTransportistaIdChange={(id) => {
            patch({ transportistaId: id });
            if (id) setFieldErrors((p) => ({ ...p, transportistaId: "" }));
          }}
          transportistas={transportistas}
          loadingTransportistas={loadingTransportistas}
        />
        <CrudFieldError message={fieldErrors.transportistaId} />
        {showPinField && (
          <label className="grid gap-1.5">
            <CrudFieldLabel>PIN app combustible</CrudFieldLabel>
            <CrudInput
              type="text"
              inputMode="numeric"
              placeholder="4 dígitos (opcional)"
              value={form.pin ?? ""}
              error={fieldErrors.pin}
              maxLength={4}
              onChange={(e) =>
                patch({ pin: e.target.value.replace(/\D/g, "") })
              }
            />
            <CrudFieldError message={fieldErrors.pin} />
          </label>
        )}
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear chofer" />
      </form>
    </CrudPageLayout>
  );
}

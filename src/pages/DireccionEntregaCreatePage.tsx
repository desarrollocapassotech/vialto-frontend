import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { CrudSubmitButton } from "@/components/crud/CrudSubmitButton";
import { ApiError, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useToast } from "@/lib/toast";
import type { DireccionEntrega } from "@/types/api";

export function DireccionEntregaCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const [direccion, setDireccion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit() {
    // 1. Validaciones locales
    const errs: Record<string, string> = {};
    if (!direccion.trim())
      errs.direccion = "Ingresá la dirección o ruta de entrega.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError(null);

    try {
      const path = tenantId
        ? `/api/platform/direcciones-entrega?tenantId=${encodeURIComponent(tenantId)}`
        : "/api/direcciones-entrega";

      await apiJson<DireccionEntrega>(path, () => getToken(), {
        method: "POST",
        body: JSON.stringify({ direccion: direccion.trim() }),
      });

      if (!tenantId) await maestro.refreshDireccionesEntrega();

      showToast("Dirección creada exitosamente", "success");

      navigate(
        `/base-de-datos?tab=direcciones-entrega${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "Ya existe esa dirección o ruta de entrega."
          : friendlyError(e, "direccionesEntrega"),
      );

      showToast("No se pudo crear la dirección", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear dirección / ruta"
    >
      <form
        className="max-w-lg grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Dirección / Ruta de entrega</CrudFieldLabel>
          <CrudInput
            value={direccion}
            error={fieldErrors.direccion}
            placeholder="Ej: Pampa 1087, San Fernando…"
            maxLength={300}
            onChange={(e) => setDireccion(e.target.value)}
          />
          <CrudFieldError message={fieldErrors.direccion} />
        </label>
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear dirección" />
      </form>
    </CrudPageLayout>
  );
}

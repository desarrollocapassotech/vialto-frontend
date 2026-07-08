import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CrudDangerZone } from "@/components/crud/CrudDangerZone";
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

function direccionEntregaDetailUrl(id: string, tenantId: string): string {
  if (tenantId) {
    return `/api/platform/direcciones-entrega/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `/api/direcciones-entrega/${encodeURIComponent(id)}`;
}

export function DireccionEntregaEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const [direccion, setDireccion] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const row = await apiJson<DireccionEntrega>(
          direccionEntregaDetailUrl(id, tenantId),
          () => getToken(),
        );
        if (!cancelled) {
          setDireccion(row.direccion);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "direccionesEntrega"));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  async function onSave() {
    if (!id) return;

    // 1. Validaciones previas
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
      await apiJson<DireccionEntrega>(
        direccionEntregaDetailUrl(id, tenantId),
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify({ direccion: direccion.trim() }),
        },
      );

      if (!tenantId) await maestro.refreshDireccionesEntrega();

      showToast("Dirección actualizada exitosamente", "success");

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

      showToast("No se pudo actualizar la dirección", "error");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || confirmDelete !== direccion) return;
    setDeleting(true);
    setError(null);

    try {
      await apiJson(direccionEntregaDetailUrl(id, tenantId), () => getToken(), {
        method: "DELETE",
      });

      if (!tenantId) await maestro.refreshDireccionesEntrega();

      showToast("Dirección eliminada correctamente", "success");

      navigate(
        `/base-de-datos?tab=direcciones-entrega${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`,
        { replace: true },
      );
    } catch (e) {
      setError(friendlyError(e, "direccionesEntrega"));
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }

  const backTo = `/base-de-datos?tab=direcciones-entrega${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`;

  return (
    <CrudPageLayout
      title="Editar dirección / ruta"
      backTo={backTo}
      backLabel="← Volver a direcciones"
    >
      {initialLoading ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : (
        <form
          className="max-w-lg grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <label className="grid gap-1.5">
            <CrudFieldLabel required>
              Dirección / Ruta de entrega
            </CrudFieldLabel>
            <CrudInput
              value={direccion}
              error={fieldErrors.direccion}
              maxLength={300}
              onChange={(e) => setDireccion(e.target.value)}
            />
            <CrudFieldError message={fieldErrors.direccion} />
          </label>
          <CrudFormErrorAlert message={error} />
          <CrudSubmitButton loading={loading} label="Guardar cambios" />
          <CrudDangerZone
            message="Escribí la dirección exacta para eliminarla."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === direccion.trim()}
            deleting={deleting}
            onDelete={() => void onDelete()}
            deleteLabel="Eliminar dirección"
          />
        </form>
      )}
    </CrudPageLayout>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Columns3 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { ViajesColumnasOrdenModal } from "@/components/viajes/ViajesColumnasOrdenModal";
import {
  columnasViajesHabilitadas,
  type ViajeColumnaId,
} from "@/lib/viajesColumnasOrden";
import type { Tenant } from "@/types/api";

/** Mismo orden de precedencia que `useFieldConfig("viajes").isVisible`. */
const FORMULARIOS_VIAJES = ["alta_viaje", "edicion_viaje", "detalle_viaje"] as const;

type Props = {
  tenantId: string;
  ordenInicial: readonly string[] | undefined;
  /** Flags actuales de la empresa que definen qué columnas ve (IDs, tipo de flota, productos). */
  tenant: Pick<
    Tenant,
    | "idSistemaHabilitado"
    | "idPropio1Habilitado"
    | "idPropio2Habilitado"
    | "tipoFlota"
    | "viajesColumnaProductosHabilitada"
    | "viajesObservaciones"
  >;
  /** Labels propios de la empresa (ej. ID propio 1 = "CTG"). */
  labels?: Partial<Record<ViajeColumnaId, string>>;
  /** Para que el host actualice su copia del tenant (si no, al reabrir vuelve al orden viejo). */
  onGuardado?: (viajesColumnasOrden: string[]) => void;
};

/**
 * Superadmin: botón "Ordenar columnas" + `ViajesColumnasOrdenModal` para la
 * empresa elegida. Las columnas habilitadas salen de la config de campos de
 * esa empresa (endpoint de plataforma).
 */
export function ViajesColumnasOrdenConfig(props: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex shrink-0 items-center gap-2 border border-black/20 bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
      >
        <Columns3 className="h-3.5 w-3.5" aria-hidden />
        Ordenar columnas
      </button>
      {abierto && <ModalSuperadmin {...props} onClose={() => setAbierto(false)} />}
    </>
  );
}

function ModalSuperadmin({
  tenantId,
  ordenInicial,
  tenant,
  labels,
  onGuardado,
  onClose,
}: Props & { onClose: () => void }) {
  const { getToken } = useAuth();
  const [habilitadas, setHabilitadas] = useState<Set<ViajeColumnaId> | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Chofer, Etapa y Productos dependen de la config de campos de Viajes de la empresa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configs = await Promise.all(
          FORMULARIOS_VIAJES.map((formulario) =>
            apiJson<{ campo: string; visible: boolean }[]>(
              `/api/platform/field-config/${encodeURIComponent(tenantId)}?modulo=viajes&formulario=${formulario}`,
              () => getToken(),
            ),
          ),
        );
        const campoVisible = (campo: string) => {
          for (const config of configs) {
            const c = config.find((x) => x.campo === campo);
            if (c) return c.visible;
          }
          return true;
        };
        if (!cancelled) setHabilitadas(columnasViajesHabilitadas(tenant, campoVisible));
      } catch (e) {
        if (!cancelled) setErrorCarga(friendlyError(e, "camposEmpresa"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, tenant, getToken]);

  return (
    <ViajesColumnasOrdenModal
      ordenInicial={ordenInicial}
      habilitadas={habilitadas}
      errorCarga={errorCarga}
      labels={labels}
      onClose={onClose}
      guardar={async (viajesColumnasOrden) => {
        await apiJson(`/api/tenants/${encodeURIComponent(tenantId)}`, () => getToken(), {
          method: "PATCH",
          body: JSON.stringify({ viajesColumnasOrden }),
        });
        onGuardado?.(viajesColumnasOrden);
      }}
    />
  );
}

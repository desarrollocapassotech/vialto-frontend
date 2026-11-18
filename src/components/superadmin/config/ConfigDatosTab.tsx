import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { BotonCopiar } from "@/components/ui/BotonCopiar";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type { Tenant } from "@/types/api";
import {
  ConfigControl,
  ConfigFila,
  ConfigSeccion,
  ConfigTextoInput,
  configInputClass,
  configSelectClass,
} from "./ConfigUi";

type Props = {
  orgId: string;
  config: TenantConfigEmpresa & { tenant: Tenant };
};

const ESTADOS = [
  { value: "trial", label: "En prueba" },
  { value: "active", label: "Al día" },
  { value: "suspended", label: "Suspendido" },
  { value: "expired", label: "Vencido" },
] as const;

/** Datos de la empresa y suscripción (antes "Editar empresa"). Guarda al tocar. */
export function ConfigDatosTab({ orgId, config }: Props) {
  const { tenant, guardar, estaGuardando } = config;

  return (
    <>
      <ConfigSeccion titulo="Datos de la empresa">
        <ConfigFila label="Nombre">
          <ConfigControl>
            <ConfigTextoInput
              valor={tenant.name}
              onGuardar={(v) => void guardar({ name: v })}
              validar={(v) => (v ? null : "Ingresá el nombre de la empresa.")}
              disabled={estaGuardando("name")}
              ariaLabel="Nombre de la empresa"
            />
          </ConfigControl>
        </ConfigFila>
        <ConfigFila label="ID Fiscal" palabrasClave="cuit">
          <ConfigControl>
            <ConfigTextoInput
              valor={tenant.idFiscal ?? ""}
              onGuardar={(v) => void guardar({ idFiscal: v || null })}
              disabled={estaGuardando("idFiscal")}
              placeholder="Solo números"
              ariaLabel="ID Fiscal"
            />
          </ConfigControl>
        </ConfigFila>
        <ConfigFila
          label="Org ID de Clerk"
          ayuda="Identificador de la organización en Clerk. No se puede cambiar."
          palabrasClave="clerk organizacion"
        >
          <span className="flex items-center gap-2 font-mono text-xs text-vialto-steel">
            {tenant.clerkOrgId}
            <BotonCopiar texto={tenant.clerkOrgId} label="Copiar Org ID" />
          </span>
        </ConfigFila>
      </ConfigSeccion>

      <ConfigSeccion titulo="Suscripción">
        <ConfigFila
          label="Estado"
          palabrasClave="billing prueba suspendido vencido"
        >
          <ConfigControl>
            <select
              value={tenant.billingStatus.toLowerCase()}
              disabled={estaGuardando("billingStatus")}
              onChange={(e) => void guardar({ billingStatus: e.target.value })}
              className={configSelectClass}
            >
              {ESTADOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </ConfigControl>
        </ConfigFila>
        <ConfigFila label="Máximo de usuarios">
          <ConfigControl>
            <ConfigTextoInput
              type="number"
              valor={String(tenant.maxUsers)}
              onGuardar={(v) => void guardar({ maxUsers: Number(v) })}
              validar={(v) =>
                Number.isInteger(Number(v)) && Number(v) >= 1
                  ? null
                  : "El máximo de usuarios tiene que ser un número entero mayor a 0."
              }
              disabled={estaGuardando("maxUsers")}
              ariaLabel="Máximo de usuarios"
            />
          </ConfigControl>
        </ConfigFila>
        <ConfigFila label="Renovación" palabrasClave="vencimiento fecha">
          <ConfigControl>
            <input
              type="date"
              value={tenant.billingRenewsAt?.slice(0, 10) ?? ""}
              disabled={estaGuardando("billingRenewsAt")}
              onChange={(e) =>
                void guardar({ billingRenewsAt: e.target.value || null })
              }
              className={configInputClass}
            />
          </ConfigControl>
        </ConfigFila>
      </ConfigSeccion>

      <EliminarEmpresaSeccion orgId={orgId} nombre={tenant.name} />
    </>
  );
}

function EliminarEmpresaSeccion({
  orgId,
  nombre,
}: {
  orgId: string;
  nombre: string;
}) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const puede = nombre.trim().length > 0 && confirmacion.trim() === nombre;

  async function eliminar() {
    if (!puede) return;
    setEliminando(true);
    try {
      await apiJson(
        `/api/tenants/${encodeURIComponent(orgId)}`,
        () => getToken(),
        {
          method: "DELETE",
        },
      );
      showToast("Empresa eliminada correctamente", "success");
      navigate("/superadmin/empresas", { replace: true });
    } catch (e) {
      showToast(friendlyError(e, "plataforma"), "error");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <ConfigSeccion titulo="Eliminar empresa">
      <ConfigFila
        label="Eliminar la empresa y sus datos"
        ayuda="Borra la empresa y todos sus datos asociados en la plataforma. No se puede deshacer."
        palabrasClave="borrar danger"
        apilado
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={`Escribí “${nombre}” para confirmar`}
            aria-label={`Escribí ${nombre} para confirmar`}
            className={`${configInputClass} sm:max-w-sm`}
          />
          <button
            type="button"
            disabled={!puede || eliminando}
            onClick={() => void eliminar()}
            className="h-9 shrink-0 border border-red-300 bg-white px-4 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {eliminando ? "Eliminando…" : "Eliminar empresa"}
          </button>
        </div>
      </ConfigFila>
    </ConfigSeccion>
  );
}

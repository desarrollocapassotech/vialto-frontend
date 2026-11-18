import { useState } from "react";
import { X } from "lucide-react";
import {
  LIQUIDACION_ANULACION_METODO_OPCIONES,
  type LiquidacionAnulacionMetodo,
} from "@/components/superadmin/LiquidacionAnulacionMetodoFields";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import { useToast } from "@/lib/toast";
import { canAccessEmisionLiquidoProductoArca } from "@/lib/tenantModules";
import type { Tenant } from "@/types/api";
import {
  ConfigControl,
  ConfigFila,
  ConfigSeccion,
  configInputClass,
  configSelectClass,
} from "./ConfigUi";

type Props = { config: TenantConfigEmpresa & { tenant: Tenant } };

const AYUDA_ANULACION = LIQUIDACION_ANULACION_METODO_OPCIONES.map(
  (o) => `${o.label}: ${o.desc}`,
).join("\n\n");

/** Pestaña Liquidaciones: lo que va arriba de "Campos visibles". */
export function ConfigLiquidacionesSecciones({ config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const metodo: LiquidacionAnulacionMetodo =
    tenant.liquidacionAnulacionMetodo === "manual"
      ? "manual"
      : "nota_credito_debito";

  return (
    <>
      <ConfigSeccion titulo="Contrato de liquidación (PDF)">
        <ProveedoresContratoFila config={config} />
      </ConfigSeccion>

      {canAccessEmisionLiquidoProductoArca(tenant.modules) && (
        <ConfigSeccion titulo="Anulación (CVLP 060)">
          <ConfigFila
            label="Cómo se anula un comprobante emitido"
            ayuda={AYUDA_ANULACION}
            palabrasClave="nota de credito debito manual arca"
          >
            <ConfigControl>
              <select
                value={metodo}
                disabled={estaGuardando("liquidacionAnulacionMetodo")}
                onChange={(e) =>
                  void guardar(
                    { liquidacionAnulacionMetodo: e.target.value },
                    { mensaje: "Método de anulación actualizado" },
                  )
                }
                className={configSelectClass}
              >
                {LIQUIDACION_ANULACION_METODO_OPCIONES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </ConfigControl>
          </ConfigFila>
        </ConfigSeccion>
      )}
    </>
  );
}

function ProveedoresContratoFila({ config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const { showToast } = useToast();
  const [nueva, setNueva] = useState("");
  const opciones = tenant.opcionesProveedorLiquidacion ?? [];
  const saving = estaGuardando("opcionesProveedorLiquidacion");
  const mensaje = "Opciones de proveedor actualizadas";

  async function agregar() {
    const valor = nueva.trim();
    if (!valor) return;
    if (opciones.some((o) => o.toLowerCase() === valor.toLowerCase())) {
      showToast("Esa opción ya existe", "error");
      return;
    }
    const ok = await guardar(
      { opcionesProveedorLiquidacion: [...opciones, valor] },
      { mensaje },
    );
    if (ok) setNueva("");
  }

  return (
    <ConfigFila
      label="Entidades contratantes"
      ayuda="Al liquidar se elige cuál figura en el título del PDF del contrato (ej. “EMPRESA S.A. (ARGENTINA)”, “EMPRESA S.A. (URUGUAY)”)."
      palabrasClave="proveedor contrato"
      apilado
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 sm:max-w-md">
          <input
            type="text"
            value={nueva}
            disabled={saving}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void agregar();
              }
            }}
            placeholder="Ej: EMPRESA LOGÍSTICA S.A. (PAÍS)"
            className={configInputClass}
          />
          <button
            type="button"
            disabled={saving || !nueva.trim()}
            onClick={() => void agregar()}
            className="h-9 shrink-0 border border-black/20 bg-white px-3 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
        {opciones.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opciones.map((opcion) => (
              <span
                key={opcion}
                className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-vialto-mist px-2 py-1 text-xs text-vialto-charcoal"
              >
                {opcion}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void guardar(
                      {
                        opcionesProveedorLiquidacion: opciones.filter(
                          (o) => o !== opcion,
                        ),
                      },
                      { mensaje },
                    )
                  }
                  className="text-vialto-steel hover:text-red-600"
                  aria-label={`Quitar ${opcion}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </ConfigFila>
  );
}

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import type { AvailableModuleCode } from "@/lib/moduleCatalog";
import { labelModulo } from "@/lib/platformLabels";
import type { Tenant } from "@/types/api";
import { ConfigFila, ConfigSeccion, ToggleSwitch } from "./ConfigUi";

/** Mismos módulos que `AVAILABLE_MODULES`, agrupados para la pantalla. */
const GRUPOS: {
  titulo: string;
  modulos: { code: AvailableModuleCode; ayuda?: string }[];
}[] = [
  {
    titulo: "Operación",
    modulos: [
      { code: "viajes" },
      { code: "stock" },
      { code: "combustible" },
      { code: "mantenimiento" },
    ],
  },
  {
    titulo: "Facturación y cobranzas",
    modulos: [
      {
        code: "facturacion",
        ayuda: "Registro de facturas a clientes, sin emitirlas en ARCA.",
      },
      {
        code: "emision-facturas-arca",
        ayuda:
          "Emite las facturas electrónicas en ARCA. Requiere configurar el certificado.",
      },
      {
        code: "liquidaciones",
        ayuda:
          "Registro de liquidaciones a transportistas, sin emitirlas en ARCA.",
      },
      {
        code: "emision-liquido-producto-arca",
        ayuda:
          "Emite el Líquido Producto (CVLP) en ARCA. Requiere configurar el certificado.",
      },
      { code: "cuenta-corriente" },
    ],
  },
];

type Props = { config: TenantConfigEmpresa & { tenant: Tenant } };

/**
 * Módulos contratados (`Tenant.modules`): definen qué ve la empresa en el menú y
 * qué endpoints puede usar. Se guarda al tocar; apagar uno pide confirmación
 * porque la empresa deja de verlo en el momento.
 */
export function ConfigModulosTab({ config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const [aApagar, setAApagar] = useState<AvailableModuleCode | null>(null);
  const saving = estaGuardando("modules");

  function cambiar(code: AvailableModuleCode, prender: boolean) {
    const actuales = tenant.modules ?? [];
    const modules = prender
      ? [...actuales.filter((m) => m !== code), code]
      : actuales.filter((m) => m !== code);
    return guardar(
      { modules },
      {
        mensaje: `${labelModulo(code)} ${prender ? "habilitado" : "deshabilitado"}`,
      },
    );
  }

  return (
    <>
      {GRUPOS.map((grupo) => (
        <ConfigSeccion key={grupo.titulo} titulo={grupo.titulo}>
          {grupo.modulos.map(({ code, ayuda }) => {
            const on = tenant.modules.includes(code);
            const label = labelModulo(code);
            return (
              <ConfigFila
                key={code}
                label={label}
                ayuda={ayuda}
                palabrasClave={code}
              >
                <ToggleSwitch
                  checked={on}
                  disabled={saving}
                  onChange={() =>
                    on ? setAApagar(code) : void cambiar(code, true)
                  }
                  label={`${on ? "Deshabilitar" : "Habilitar"} ${label}`}
                />
              </ConfigFila>
            );
          })}
        </ConfigSeccion>
      ))}

      <ConfirmDialog
        open={aApagar !== null}
        title={`¿Deshabilitar ${aApagar ? labelModulo(aApagar) : ""}?`}
        message={`${tenant.name} deja de ver el módulo en el menú y no puede usarlo. Los datos cargados no se borran: si se vuelve a habilitar, siguen ahí.`}
        confirmLabel="Deshabilitar"
        tone="danger"
        busy={saving}
        onCancel={() => setAApagar(null)}
        onConfirm={async () => {
          if (!aApagar) return;
          await cambiar(aApagar, false);
          setAApagar(null);
        }}
      />
    </>
  );
}

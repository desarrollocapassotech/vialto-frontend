import { useMemo } from "react";
import { ViajesColumnasOrdenConfig } from "@/components/superadmin/ViajesColumnasOrdenConfig";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import type { Tenant } from "@/types/api";
import { Switch } from "./ConfigGeneralTab";
import {
  ConfigControl,
  ConfigFila,
  ConfigSeccion,
  ConfigTextoInput,
  ToggleSwitch,
  configSelectClass,
} from "./ConfigUi";

type Props = { orgId: string; config: TenantConfigEmpresa & { tenant: Tenant } };

/** Pestaña Viajes: lo que va arriba de "Campos visibles". */
export function ConfigViajesSecciones({ orgId, config }: Props) {
  const { tenant, guardar, estaGuardando, actualizarLocal } = config;
  const idSistema = tenant.idSistemaHabilitado ?? true;
  const idPropio1 = tenant.idPropio1Habilitado ?? true;
  const idPropio2 = tenant.idPropio2Habilitado ?? false;
  const productosPlural = tenant.productoLabelPlural || tenant.productoLabel || "productos";

  // Flags que definen qué columnas de Viajes ve la empresa.
  const flagsColumnas = useMemo(
    () => ({
      idSistemaHabilitado: tenant.idSistemaHabilitado,
      idPropio1Habilitado: tenant.idPropio1Habilitado,
      idPropio2Habilitado: tenant.idPropio2Habilitado,
      tipoFlota: tenant.tipoFlota,
      viajesColumnaProductosHabilitada: tenant.viajesColumnaProductosHabilitada,
      viajesObservaciones: tenant.viajesObservaciones,
    }),
    [
      tenant.idSistemaHabilitado,
      tenant.idPropio1Habilitado,
      tenant.idPropio2Habilitado,
      tenant.tipoFlota,
      tenant.viajesColumnaProductosHabilitada,
      tenant.viajesObservaciones,
    ],
  );

  return (
    <>
      <ConfigSeccion titulo="Identificación del viaje">
        {/* ID Sistema e ID Propio 1 nunca pueden quedar apagados a la vez. */}
        <ConfigFila
          label="ID Sistema"
          aviso={idSistema && !idPropio1 ? "No se puede apagar: ID Propio 1 está apagado." : null}
        >
          <ToggleSwitch
            checked={idSistema}
            disabled={estaGuardando("idSistemaHabilitado") || (idSistema && !idPropio1)}
            onChange={() => void guardar({ idSistemaHabilitado: !idSistema })}
            label={idSistema ? "Deshabilitar ID Sistema" : "Habilitar ID Sistema"}
          />
        </ConfigFila>
        <ConfigFila
          label="ID Propio 1"
          ayuda="Escribí cómo lo llama la empresa (ej. “Nro de CTG”)."
          aviso={idPropio1 && !idSistema ? "No se puede apagar: ID Sistema está apagado." : null}
        >
          <ConfigControl>
            <ConfigTextoInput
              valor={tenant.labelIdentificacionPersonalizadaViajes ?? ""}
              onGuardar={(v) =>
                void guardar(
                  { labelIdentificacionPersonalizadaViajes: v || null },
                  { mensaje: "Nombre actualizado" },
                )
              }
              disabled={estaGuardando("labelIdentificacionPersonalizadaViajes")}
              placeholder="ID propio"
              ariaLabel="Nombre de ID Propio 1"
            />
          </ConfigControl>
          <ToggleSwitch
            checked={idPropio1}
            disabled={estaGuardando("idPropio1Habilitado") || (idPropio1 && !idSistema)}
            // Apagarlo apaga también ID Propio 2 (cascada del backend).
            onChange={() =>
              void guardar(
                { idPropio1Habilitado: !idPropio1 },
                { desdeRespuesta: ["idPropio2Habilitado"] },
              )
            }
            label={idPropio1 ? "Deshabilitar ID Propio 1" : "Habilitar ID Propio 1"}
          />
        </ConfigFila>
        <ConfigFila
          label="ID Propio 2"
          ayuda="Texto libre, no único (ej. “CPE”, “Referencia cliente”)."
          aviso={!idPropio2 && !idPropio1 ? "Para prenderlo, primero prendé ID Propio 1." : null}
        >
          <ConfigControl>
            <ConfigTextoInput
              valor={tenant.idPropio2Label ?? ""}
              onGuardar={(v) =>
                void guardar({ idPropio2Label: v || null }, { mensaje: "Nombre actualizado" })
              }
              disabled={estaGuardando("idPropio2Label")}
              placeholder="ID Propio 2"
              ariaLabel="Nombre de ID Propio 2"
            />
          </ConfigControl>
          <ToggleSwitch
            checked={idPropio2}
            disabled={estaGuardando("idPropio2Habilitado") || (!idPropio2 && !idPropio1)}
            onChange={() => void guardar({ idPropio2Habilitado: !idPropio2 })}
            label={idPropio2 ? "Deshabilitar ID Propio 2" : "Habilitar ID Propio 2"}
          />
        </ConfigFila>
      </ConfigSeccion>

      <ConfigSeccion titulo="Carga del viaje">
        <ConfigFila
          label="Unidad de cantidad"
          ayuda="Unidad del campo “Cantidad” en Viajes y en los PDF de Factura A/B, Liquidación (CVLP) y Contrato de liquidación."
          palabrasClave="toneladas unidades flete"
        >
          <ConfigControl>
            <select
              value={tenant.unidadCantidadViajes === "UD" ? "UD" : "TN"}
              disabled={estaGuardando("unidadCantidadViajes")}
              onChange={(e) => void guardar({ unidadCantidadViajes: e.target.value })}
              className={configSelectClass}
            >
              <option value="TN">Toneladas (TN)</option>
              <option value="UD">Unidades (Ud)</option>
            </select>
          </ConfigControl>
        </ConfigFila>
        <ConfigFila
          label="Recomendación de ciudades"
          ayuda="Prendido: origen y destino se eligen de un buscador y la importación valida las ciudades del Excel. Apagado: texto libre."
          palabrasClave="origen destino"
        >
          <Switch
            config={config}
            campo="recomendacionCiudadesHabilitada"
            valorDefault
            label="recomendación de ciudades"
          />
        </ConfigFila>
      </ConfigSeccion>

      <ConfigSeccion titulo="Grilla de viajes">
        <ConfigFila
          label="Orden de columnas"
          ayuda="Orden en que la empresa ve las columnas del listado de Viajes."
        >
          <ViajesColumnasOrdenConfig
            tenantId={orgId}
            ordenInicial={tenant.viajesColumnasOrden}
            tenant={flagsColumnas}
            labels={{
              idPropio1: tenant.labelIdentificacionPersonalizadaViajes ?? "",
              idPropio2: tenant.idPropio2Label ?? "",
              productos: tenant.productoLabel ? productosPlural : undefined,
            }}
            onGuardado={(viajesColumnasOrden) => actualizarLocal({ viajesColumnasOrden })}
          />
        </ConfigFila>
        <ConfigFila
          label={`Columna de ${productosPlural.toLowerCase()}`}
          ayuda="Requiere que el campo esté visible en los formularios de Viajes."
          palabrasClave="productos"
        >
          <Switch
            config={config}
            campo="viajesColumnaProductosHabilitada"
            label="columna de productos"
          />
        </ConfigFila>
        <ConfigFila label="Columna de observaciones">
          <Switch
            config={config}
            campo="viajesObservaciones"
            label="columna de observaciones"
          />
        </ConfigFila>
      </ConfigSeccion>

      <ConfigSeccion titulo="Acciones">
        <ConfigFila
          label="Exportar PAUT / MIC-CRT"
          ayuda="Habilita la exportación del reporte PAUT y del MIC/CRT desde la grilla de Viajes."
          palabrasClave="exportacion reporte nomina"
        >
          <Switch
            config={config}
            campo="habilitarExportacionPautMicCrt"
            label="exportación PAUT / MIC-CRT"
          />
        </ConfigFila>
      </ConfigSeccion>
    </>
  );
}

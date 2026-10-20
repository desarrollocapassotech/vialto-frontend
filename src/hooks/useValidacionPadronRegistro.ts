import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import type { PadronConsulta } from "@/hooks/useArcaPadron";

/** Respuesta de `POST /api/padron/validar/:entidad/:id` (backend `core/padron`). */
export type PadronValidacionResultado =
  | { resultado: "no_aplica" }
  | { resultado: "validado"; validadoAt: string; desdeMarca: boolean }
  | {
      resultado: "actualizado";
      validadoAt: string;
      padron: PadronConsulta;
      cambios: Array<"nombre" | "condicionIva" | "domicilio">;
    }
  | { resultado: "rechazado"; padron: PadronConsulta };

export type PadronActualizado = Extract<PadronValidacionResultado, { resultado: "actualizado" }>;

type CambiosPadron = PadronActualizado["cambios"];

/** Lo que el backend guardó desde ARCA, para aplicarlo a un Cliente en memoria. */
export function aplicarCambiosPadronCliente<T extends { nombre?: string; condicionIva?: number | null; direccion?: string | null }>(
  c: T,
  padron: PadronConsulta,
  cambios: CambiosPadron,
): T {
  return {
    ...c,
    ...(cambios.includes("nombre") && padron.nombre && { nombre: padron.nombre }),
    ...(cambios.includes("condicionIva") && { condicionIva: padron.condicionIva }),
    ...(cambios.includes("domicilio") && { direccion: padron.domicilio }),
  };
}

/** Ídem para un Transportista (el domicilio vive en `domicilio`). */
export function aplicarCambiosPadronTransportista<T extends { nombre?: string; condicionIva?: number | null; domicilio?: string | null }>(
  t: T,
  padron: PadronConsulta,
  cambios: CambiosPadron,
): T {
  return {
    ...t,
    ...(cambios.includes("nombre") && padron.nombre && { nombre: padron.nombre }),
    ...(cambios.includes("condicionIva") && { condicionIva: padron.condicionIva }),
    ...(cambios.includes("domicilio") && { domicilio: padron.domicilio }),
  };
}

/**
 * Valida un Cliente/Transportista ya guardado contra el padrón de ARCA apenas se lo elige.
 * Si ARCA informa otra razón social / condición IVA / domicilio, el backend los guarda
 * solo (sin confirmación; el CUIT nunca se toca) y avisa con `onActualizado` para que la
 * pantalla refresque el registro. No reconsulta ARCA si el registro ya quedó validado con
 * los mismos datos (huella `arcaValidadoHuella`). Opt-in por empresa (`habilitado`); si
 * ARCA falla no se muestra nada: nunca bloquea.
 */
export function useValidacionPadronRegistro({
  entidad,
  id,
  habilitado,
  tenantId,
  getToken,
  onActualizado,
}: {
  entidad: "clientes" | "transportistas";
  id: string | null | undefined;
  habilitado: boolean;
  /** Override de superadmin (pantallas de plataforma). */
  tenantId?: string;
  getToken: () => Promise<string | null>;
  /** El backend actualizó el registro con lo de ARCA: aplicar `cambios` al estado local. */
  onActualizado?: (r: PadronActualizado) => void;
}) {
  const onActualizadoRef = useRef(onActualizado);
  onActualizadoRef.current = onActualizado;
  // `resultado: null` = se consultó y falló (no bloquea, pero ya no está pendiente).
  const [estado, setEstado] = useState<{
    id: string;
    resultado: PadronValidacionResultado | null;
  } | null>(null);

  const url = useCallback(
    (registroId: string, confirmar: boolean) =>
      `/api/padron/validar/${entidad}/${encodeURIComponent(registroId)}${confirmar ? "/confirmar" : ""}${
        tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""
      }`,
    [entidad, tenantId],
  );

  // Respuestas de una selección anterior (el usuario cambió de registro) se descartan.
  const idActual = useRef(id);
  idActual.current = id;

  const pedir = useCallback(
    async (registroId: string, confirmar = false) => {
      try {
        const resultado = await apiJson<PadronValidacionResultado>(
          url(registroId, confirmar),
          getToken,
          { method: "POST" },
        );
        if (idActual.current !== registroId) return;
        setEstado({ id: registroId, resultado });
        if (resultado.resultado === "actualizado") onActualizadoRef.current?.(resultado);
      } catch {
        // ARCA caído / tope diario / sin permiso: no bloquea, se sigue sin validar.
        if (idActual.current === registroId) setEstado({ id: registroId, resultado: null });
      }
    },
    [url, getToken],
  );

  useEffect(() => {
    if (habilitado && id) void pedir(id);
  }, [habilitado, id, pedir]);

  return {
    resultado: estado && estado.id === id ? estado.resultado : null,
    /** Consulta en curso para el `id` actual (para no abrir nada antes de tener la respuesta). */
    pendiente: habilitado && !!id && estado?.id !== id,
    /** Ya hubo respuesta para el `id` actual (con `resultado` null = la consulta falló). */
    consultado: !!id && estado?.id === id,
    /**
     * El usuario editó a mano los datos que se habían actualizado desde ARCA (mismo CUIT):
     * se marca como validado con lo que guardó, para que no se vuelva a pisar.
     */
    confirmar: () => (habilitado && id ? pedir(id, true) : Promise.resolve()),
    /**
     * Volver a validar (ej. después de cargar un CUIT que faltaba, o "Reintentar" si ARCA
     * falló). Limpia el resultado anterior para que vuelva a verse "Validando…".
     */
    revalidar: () => {
      if (!habilitado || !id) return Promise.resolve();
      setEstado(null);
      return pedir(id);
    },
  };
}

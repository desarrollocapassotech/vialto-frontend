import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import type { PadronConsulta } from "@/hooks/useArcaPadron";

/** Respuesta de `POST /api/padron/validar/:entidad/:id[/confirmar]` (backend `core/padron`). */
export type PadronValidacionResultado =
  | { resultado: "no_aplica" }
  | { resultado: "validado"; validadoAt: string; desdeMarca: boolean }
  | {
      resultado: "diferencias";
      padron: PadronConsulta;
      diferencias: Array<"condicionIva" | "domicilio">;
    }
  | { resultado: "rechazado"; padron: PadronConsulta };

/**
 * Valida un Cliente/Transportista ya guardado contra el padrón de ARCA apenas se lo elige.
 * El backend no reconsulta ARCA si el registro ya quedó validado con los mismos datos
 * (huella `arcaValidadoHuella`). Opt-in por empresa (`habilitado`); si ARCA falla no se
 * muestra nada: nunca bloquea.
 */
export function useValidacionPadronRegistro({
  entidad,
  id,
  habilitado,
  tenantId,
  getToken,
}: {
  entidad: "clientes" | "transportistas";
  id: string | null | undefined;
  habilitado: boolean;
  /** Override de superadmin (pantallas de plataforma). */
  tenantId?: string;
  getToken: () => Promise<string | null>;
}) {
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
    async (registroId: string, confirmar: boolean) => {
      try {
        const resultado = await apiJson<PadronValidacionResultado>(
          url(registroId, confirmar),
          getToken,
          { method: "POST" },
        );
        if (idActual.current === registroId) setEstado({ id: registroId, resultado });
      } catch {
        // ARCA caído / tope diario / sin permiso: no bloquea, se sigue sin validar.
        if (idActual.current === registroId) setEstado({ id: registroId, resultado: null });
      }
    },
    [url, getToken],
  );

  useEffect(() => {
    if (habilitado && id) void pedir(id, false);
  }, [habilitado, id, pedir]);

  return {
    resultado: estado && estado.id === id ? estado.resultado : null,
    /** Consulta en curso para el `id` actual (para no abrir nada antes de tener la respuesta). */
    pendiente: habilitado && !!id && estado?.id !== id,
    /** Ya hubo respuesta para el `id` actual (con `resultado` null = la consulta falló). */
    consultado: !!id && estado?.id === id,
    /** Después de que el usuario revisó y guardó los datos contra lo que informó ARCA. */
    confirmar: () => (habilitado && id ? pedir(id, true) : Promise.resolve()),
    /**
     * Volver a validar (ej. después de cargar un CUIT que faltaba, o "Reintentar" si ARCA
     * falló). Limpia el resultado anterior para que vuelva a verse "Validando…".
     */
    revalidar: () => {
      if (!habilitado || !id) return Promise.resolve();
      setEstado(null);
      return pedir(id, false);
    },
  };
}

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type Respuesta = { bloqueado: false } | { bloqueado: true; mensaje: string };

/**
 * Antes de emitir a ARCA, consulta si el CUIT del receptor (cliente de una factura,
 * transportista de una liquidación) está dado de baja / apócrifo en el padrón. Mismo
 * chequeo que hace el backend al emitir (`GET integracion-arca/receptor-padron/...`),
 * para deshabilitar "Emitir" y avisar antes de intentarlo.
 *
 * No depende del opt-in de validación de CUIT de la empresa. Si la consulta falla, no
 * bloquea (el backend tampoco). `datosKey`: cambia cuando se editan los datos del registro
 * (ej. el CUIT), para volver a consultar.
 */
export function useReceptorPadronBloqueado({
  entidad,
  id,
  habilitado,
  tenantId,
  getToken,
  datosKey,
}: {
  entidad: "clientes" | "transportistas";
  id: string | null | undefined;
  /** Solo tenants que emiten por ARCA (módulo correspondiente). */
  habilitado: boolean;
  /** Override de superadmin: usa la ruta de plataforma. */
  tenantId?: string;
  getToken: () => Promise<string | null>;
  datosKey?: string | null;
}) {
  const clave = habilitado && id ? `${entidad}:${id}:${datosKey ?? ""}` : null;
  const [estado, setEstado] = useState<{ clave: string; respuesta: Respuesta | null } | null>(
    null,
  );

  useEffect(() => {
    if (!clave || !id) return;
    let cancelado = false;
    const url = tenantId
      ? `/api/platform/integracion-arca/receptor-padron/${entidad}/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
      : `/api/integracion-arca/receptor-padron/${entidad}/${encodeURIComponent(id)}`;
    apiJson<Respuesta>(url, getToken)
      .then((respuesta) => {
        if (!cancelado) setEstado({ clave, respuesta });
      })
      .catch(() => {
        // Si no se pudo consultar, no bloquea: el backend vuelve a chequear al emitir.
        if (!cancelado) setEstado({ clave, respuesta: null });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, entidad, id, tenantId, getToken]);

  const vigente = clave && estado?.clave === clave ? estado : null;
  const respuesta = vigente?.respuesta ?? null;
  return {
    /** Todavía no respondió para el registro actual. */
    verificando: Boolean(clave) && !vigente,
    bloqueado: respuesta?.bloqueado === true,
    mensaje: respuesta?.bloqueado ? respuesta.mensaje : null,
  };
}

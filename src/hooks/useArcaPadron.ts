import { useCallback, useRef, useState } from "react";
import { ApiError, apiJson } from "@/lib/api";
import { cuitDigitoVerificadorValido } from "@/lib/ciudades";
import type { PaisCodigo } from "@/lib/ciudades";

/** Respuesta de `GET /api/padron/cuit/:cuit` (backend `core/padron`). */
export type PadronConsulta = {
  cuit: string;
  estado: "activo" | "con_observaciones" | "inactivo" | "no_encontrado";
  nombre: string | null;
  domicilio: string | null;
  condicionIva: number | null;
  observaciones: string[];
};

export type ArcaPadronEstado =
  | { status: "idle" }
  | { status: "loading"; cuit: string }
  | { status: "ok"; cuit: string; data: PadronConsulta }
  | { status: "error"; cuit: string; message: string };

type Campo<T> = { value: T; set: (v: T) => void };

/**
 * Valida un CUIT contra el padrón de ARCA y autocompleta nombre, domicilio y
 * condición IVA en formularios de Cliente/Transportista. No depende del módulo
 * ARCA del tenant (el backend usa el certificado de plataforma), pero cada
 * empresa lo tiene que tener habilitado (`habilitado`).
 *
 * Reglas de autocompletado (solo si ARCA devuelve activo / con observaciones):
 * - un campo vacío, o que todavía tiene el último valor que puso ARCA, se pisa solo;
 * - un campo que el usuario escribió o que venía cargado no se toca: se ofrece
 *   "Usar datos de ARCA" (`aplicarDatos`) para reemplazarlo a mano.
 * Si ARCA falla, no bloquea nada: la carga manual sigue igual.
 */
export function useArcaPadron({
  getToken,
  habilitado,
  pais,
  idFiscal,
  nombre,
  domicilio,
  condicionIva,
  cuitInicial,
}: {
  getToken: () => Promise<string | null>;
  /**
   * Opt-in por empresa: `Tenant.validacionCuitArcaHabilitada` (deshabilitado por
   * defecto, lo prende el superadmin en "Campos por empresa" → General). En false
   * no consulta ni muestra nada.
   */
  habilitado: boolean;
  pais: PaisCodigo | "";
  idFiscal: string;
  nombre: Campo<string>;
  /** Omitir si el formulario no tiene (o tiene oculto) el campo de domicilio. */
  domicilio?: Campo<string>;
  /** Omitir si el formulario no tiene (o tiene oculta) la condición IVA. */
  condicionIva?: Campo<number | null>;
  /** Edición: CUIT ya guardado — no se consulta solo al salir del campo si no cambió. */
  cuitInicial?: string;
}) {
  const [estado, setEstado] = useState<ArcaPadronEstado>({ status: "idle" });
  const ultimoConsultado = useRef<string | null>(null);
  const ultimoAutocompletado = useRef<{ nombre?: string; domicilio?: string; condicionIva?: number | null }>({});
  const requestId = useRef(0);
  // Valores vigentes: la respuesta de ARCA llega después de un await y no debe
  // decidir con los valores del render en que se disparó la consulta.
  const campos = useRef({ nombre, domicilio, condicionIva });
  campos.current = { nombre, domicilio, condicionIva };

  const cuit = idFiscal.replace(/\D/g, "");
  const aplica = habilitado && pais === "AR";
  const cuitValido = aplica && cuitDigitoVerificadorValido(cuit);
  // Un resultado de otro CUIT (el usuario lo cambió después) no se muestra.
  const estadoVisible: ArcaPadronEstado =
    aplica && estado.status !== "idle" && estado.cuit === cuit ? estado : { status: "idle" };

  const autocompletar = useCallback(
    (data: PadronConsulta, forzar: boolean) => {
      const { nombre, domicilio, condicionIva } = campos.current;
      const previo = ultimoAutocompletado.current;
      const puedePisar = <T,>(actual: T, vacio: boolean, anterior: T | undefined) =>
        forzar || vacio || (anterior !== undefined && actual === anterior);

      if (data.nombre && puedePisar(nombre.value, !nombre.value.trim(), previo.nombre)) {
        nombre.set(data.nombre);
        previo.nombre = data.nombre;
      }
      if (domicilio && data.domicilio && puedePisar(domicilio.value, !domicilio.value.trim(), previo.domicilio)) {
        domicilio.set(data.domicilio);
        previo.domicilio = data.domicilio;
      }
      if (
        condicionIva &&
        data.condicionIva != null &&
        puedePisar(condicionIva.value, condicionIva.value == null, previo.condicionIva)
      ) {
        condicionIva.set(data.condicionIva);
        previo.condicionIva = data.condicionIva;
      }
    },
    [],
  );

  const consultar = useCallback(async () => {
    if (!cuitValido) return;
    ultimoConsultado.current = cuit;
    const id = ++requestId.current;
    setEstado({ status: "loading", cuit });
    try {
      const data = await apiJson<PadronConsulta>(`/api/padron/cuit/${cuit}`, getToken);
      if (id !== requestId.current) return;
      setEstado({ status: "ok", cuit, data });
      if (data.estado === "activo" || data.estado === "con_observaciones") autocompletar(data, false);
    } catch (e) {
      if (id !== requestId.current) return;
      const message = e instanceof ApiError ? e.message : "No se pudo conectar con ARCA.";
      setEstado({ status: "error", cuit, message });
    }
  }, [cuit, cuitValido, getToken, autocompletar]);

  /** Para el onBlur del input de CUIT: consulta solo si el CUIT es nuevo. */
  const onIdFiscalBlur = useCallback(() => {
    const yaConsultado = ultimoConsultado.current ?? (cuitInicial ?? "").replace(/\D/g, "");
    if (cuitValido && cuit !== yaConsultado) void consultar();
  }, [cuit, cuitValido, cuitInicial, consultar]);

  const datos = estadoVisible.status === "ok" ? estadoVisible.data : null;
  const aceptable = datos?.estado === "activo" || datos?.estado === "con_observaciones";
  const hayDiferencias =
    !!datos &&
    aceptable &&
    ((!!datos.nombre && datos.nombre !== nombre.value) ||
      (!!domicilio && !!datos.domicilio && datos.domicilio !== domicilio.value) ||
      (!!condicionIva && datos.condicionIva != null && datos.condicionIva !== condicionIva.value));

  return {
    estado: estadoVisible,
    /** Muestra el botón "Validar con ARCA" (CUIT argentino válido, sin resultado todavía). */
    puedeValidar: cuitValido && estadoVisible.status === "idle",
    consultar,
    onIdFiscalBlur,
    hayDiferencias,
    aplicarDatos: () => datos && autocompletar(datos, true),
  };
}

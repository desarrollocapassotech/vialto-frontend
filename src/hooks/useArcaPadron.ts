import { useCallback, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
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
 * Corre en segundo plano: si ARCA devuelve activo / con observaciones, pisa razón
 * social, domicilio y condición IVA sin pedir confirmación (el usuario los puede
 * corregir después a mano). En pantalla solo aparece algo si hay un error o una
 * advertencia (ver `ArcaPadronStatus`).
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
  const { user } = useUser();
  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);

  const [estado, setEstado] = useState<ArcaPadronEstado>({ status: "idle" });
  const ultimoConsultado = useRef<string | null>(null);
  const requestId = useRef(0);
  // Valores vigentes: la respuesta de ARCA llega después de un await y no debe
  // decidir con los valores del render en que se disparó la consulta.
  const campos = useRef({ nombre, domicilio, condicionIva });
  campos.current = { nombre, domicilio, condicionIva };

  const cuit = idFiscal.replace(/\D/g, "");
  const aplica = (habilitado || isSuperadmin) && pais === "AR";
  const cuitValido = aplica && cuitDigitoVerificadorValido(cuit);
  // Un resultado de otro CUIT (el usuario lo cambió después) no se muestra.
  const estadoVisible: ArcaPadronEstado =
    aplica && estado.status !== "idle" && estado.cuit === cuit ? estado : { status: "idle" };

  const autocompletar = useCallback((data: PadronConsulta) => {
    const { nombre, domicilio, condicionIva } = campos.current;
    if (data.nombre) nombre.set(data.nombre);
    if (domicilio && data.domicilio) domicilio.set(data.domicilio);
    if (condicionIva && data.condicionIva != null) condicionIva.set(data.condicionIva);
  }, []);

  const consultar = useCallback(async () => {
    if (!cuitValido) return;
    ultimoConsultado.current = cuit;
    const id = ++requestId.current;
    setEstado({ status: "loading", cuit });
    try {
      const data = await apiJson<PadronConsulta>(`/api/padron/cuit/${cuit}`, getToken);
      if (id !== requestId.current) return;
      setEstado({ status: "ok", cuit, data });
      if (data.estado === "activo" || data.estado === "con_observaciones") autocompletar(data);
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

  return {
    estado: estadoVisible,
    /** Reintentar tras un error de conexión. */
    consultar,
    onIdFiscalBlur,
  };
}

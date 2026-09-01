import { useFieldConfig } from "@/hooks/useFieldConfig";

/** Aviso en alta/edición: campos opcionales en BD pero necesarios para exportar PAUT. */
export const TRANSPORTISTA_PAUT_NOTA =
  'Nota: Los campos Domicilio, N° PAUT, Permiso Internacional, Vencimiento del Permiso Internacional son requeridos para emitir documentos PAUT.';

export function TransportistaPautHelperNotice({ isCreate }: { isCreate?: boolean }) {
  const { isVisible } = useFieldConfig("transportistas");
  const configKey = isCreate ? "alta_transportista" : "edicion_transportista";

  const campos = [
    { key: "domicilio", label: "Domicilio" },
    { key: "paut", label: "N° PAUT" },
    { key: "permisoInternacional", label: "Permiso Internacional" },
    { key: "fechaVencimientoPermiso", label: "Vencimiento del Permiso" },
  ] as const;

  const camposOcultos = campos.filter((c) => !isVisible(configKey, c.key));

  return (
    <div
      className="rounded border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 flex flex-col gap-1.5"
      role="note"
    >
      <p>{TRANSPORTISTA_PAUT_NOTA}</p>
      {camposOcultos.length === campos.length && (
        <p className="font-semibold text-red-800">
          Atención: Todos estos campos están ocultos por configuración y no podrás completarlos. Contactá al administrador si necesitas habilitarlos.
        </p>
      )}
      {camposOcultos.length > 0 && camposOcultos.length < campos.length && (
        <p className="font-semibold text-red-800">
          Atención: {camposOcultos.length === 1 ? "El campo" : "Los campos"}{" "}
          {camposOcultos.map((c) => `'${c.label}'`).join(", ")}{" "}
          {camposOcultos.length === 1 ? "está oculto" : "están ocultos"} por configuración y no podrás {camposOcultos.length === 1 ? "completarlo" : "completarlos"}. Contactá al administrador si necesitas habilitarlos.
        </p>
      )}
    </div>
  );
}

/** Aviso en alta/edición: campos opcionales en BD pero necesarios para exportar PAUT. */
export const TRANSPORTISTA_PAUT_NOTA =
  'Nota: Los campos Domicilio, N° PAUT, Permiso Internacional, Vencimiento del Permiso Internacional son requeridos para emitir documentos PAUT.';

export function TransportistaPautHelperNotice() {
  return (
    <p
      className="rounded border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
      role="note"
    >
      {TRANSPORTISTA_PAUT_NOTA}
    </p>
  );
}

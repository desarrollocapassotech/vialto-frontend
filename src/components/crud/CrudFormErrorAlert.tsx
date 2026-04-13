/** Mismo estilo que los avisos de error en formularios (duplicado típico: arriba del layout + encima del botón guardar). */
export function CrudFormErrorAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
      {message}
    </p>
  );
}

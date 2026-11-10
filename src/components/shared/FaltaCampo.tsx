/**
 * Aviso sutil debajo de un campo obligatorio vacío (junto con el borde rojo del
 * input, ver `conBordeError`). El detalle general va en el aviso del pie.
 */
export function FaltaCampo({ show, texto = "Falta completar" }: { show: boolean | undefined; texto?: string }) {
  if (!show) return null;
  return <span className="text-[11px] leading-tight text-red-500/90">{texto}</span>;
}

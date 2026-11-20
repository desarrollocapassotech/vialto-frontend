import { CargandoVialto } from "@/components/shared/CargandoVialto";

/**
 * Capa que tapa TODO el modal con el loader de Vialto y un mensaje, y no deja tocar nada
 * debajo. Se usa mientras se carga algo imprescindible y, sobre todo, mientras se emite
 * contra ARCA (factura, nota de crédito/débito, CVLP): no alcanza con deshabilitar el
 * botón de emitir, porque se podía cerrar el modal o cambiar datos a mitad de la emisión.
 *
 * El panel del modal tiene que ser `relative` (la capa es `absolute inset-0`). Cerrar con
 * Escape u overlay mientras está activa lo bloquea cada modal con su propio `busy`.
 */
export function BloqueoModal({ mensaje }: { mensaje: string }) {
  return <CargandoVialto variante="modal" mensaje={mensaje} />;
}

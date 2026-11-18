/** Montos de las tarjetas y listas del dashboard de inicio. */
export function formatMoney(n: number) {
  return `$ ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyUSD(n: number) {
  return `USD ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

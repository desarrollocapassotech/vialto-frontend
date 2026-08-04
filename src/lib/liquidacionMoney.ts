/** Formato monetario compartido para liquidaciones (evita romper Fast Refresh en el breakdown). */

export function fmtLiquidacionMoney(n: number) {
  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formatea un importe con signo explícito para leer el cálculo. */
export function fmtSignedLiquidacionMoney(
  amount: number,
  sign: "plus" | "minus" | "none" = "none",
) {
  const abs = Math.abs(amount);
  const money = fmtLiquidacionMoney(abs);
  if (sign === "plus") return `+ ${money}`;
  if (sign === "minus") return `− ${money}`;
  return money;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

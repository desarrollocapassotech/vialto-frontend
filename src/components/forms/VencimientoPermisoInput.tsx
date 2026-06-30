import { CrudInput } from "@/components/crud/CrudFields";

// Hoy en formato YYYY-MM-DD, en hora local (no UTC, para no tener off-by-one)
function hoyLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

type Props = {
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
};

export function VencimientoPermisoInput({ value, onChange }: Props) {
  // Comparación de strings ISO funciona directo (mismo formato, ambos YYYY-MM-DD)
  const vencido = value !== "" && value < hoyLocalISO();

  return (
    <>
      <CrudInput
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {vencido && (
        <p className="font-[family-name:var(--font-ui)] text-sm text-amber-600">
          Atención: la fecha ingresada corresponde al pasado. El permiso figura
          como vencido.
        </p>
      )}
    </>
  );
}

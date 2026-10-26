import { Bell, CircleCheck, ClipboardList, Gauge } from "lucide-react";
import { BTN_CONTINUAR } from "./onboardingEstilos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Pantalla final del asistente: resumen y qué pasa ahora. */
export function OnboardingListo({
  planes,
  vehiculos,
  ordenRegistrada,
  onTerminar,
}: {
  planes: number;
  vehiculos: number;
  ordenRegistrada: boolean;
  onTerminar: () => void;
}) {
  const proximos = [
    { icon: Gauge, texto: "En Vencimientos ves qué necesita cada vehículo y cuánto le falta." },
    { icon: Bell, texto: "Te avisamos por mail cuando algo está por vencer o ya venció." },
    { icon: ClipboardList, texto: "Cada service que hagas, lo cargás como orden de trabajo." },
  ];

  return (
    <div className="grid justify-items-center gap-6 py-6 text-center">
      <CircleCheck className="h-12 w-12 text-emerald-600" strokeWidth={1.5} aria-hidden />
      <div>
        <h2 className="text-xl font-medium text-vialto-charcoal">¡Listo! Ya está configurado</h2>
        <p className="mt-1 text-sm text-vialto-steel">
          {planes > 0
            ? `Configuraste ${plural(planes, "plan", "planes")} en ${plural(vehiculos, "vehículo", "vehículos")}`
            : "Cargaste tus planes"}
          {ordenRegistrada ? " y registraste tu primera orden de trabajo." : "."}
        </p>
      </div>
      <ul className="w-full max-w-xl divide-y divide-black/10 border border-black/10 bg-white text-left">
        {proximos.map((p) => (
          <li key={p.texto} className="flex items-center gap-3 px-4 py-3 text-sm text-vialto-charcoal">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50">
              <p.icon className="h-4 w-4 text-vialto-fire" strokeWidth={1.75} aria-hidden />
            </span>
            {p.texto}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onTerminar} className={BTN_CONTINUAR}>
        Ver vencimientos
      </button>
    </div>
  );
}

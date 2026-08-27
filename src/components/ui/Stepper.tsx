export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {steps.map((s, i) => {
        const n = i + 1;
        const done = currentStep > n;
        const active = currentStep === n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div
                aria-current={active ? 'step' : undefined}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  active
                    ? 'border-vialto-fire bg-vialto-fire text-white'
                    : done
                      ? 'border-vialto-fire bg-white text-vialto-fire'
                      : 'border-black/20 bg-white text-vialto-steel'
                }`}
              >
                {done ? '✓' : n}
              </div>
              <span
                className={`text-[10px] leading-tight ${
                  active ? 'font-semibold text-vialto-charcoal' : 'text-vialto-steel'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mb-3 ${currentStep > n ? 'bg-vialto-fire' : 'bg-black/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

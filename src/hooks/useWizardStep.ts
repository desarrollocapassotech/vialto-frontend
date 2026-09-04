import { useState } from 'react';

export function useWizardStep(totalSteps: number, initialStep = 1) {
  const [step, setStep] = useState(initialStep);
  const goNext = () => setStep((s) => Math.min(totalSteps, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const reset = () => setStep(initialStep);
  return { step, setStep, goNext, goBack, reset };
}

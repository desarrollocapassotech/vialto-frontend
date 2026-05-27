import { TaskSetupMFA } from '@clerk/clerk-react';

export function TaskSetupMFAPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
      <TaskSetupMFA redirectUrlComplete="/" />
    </div>
  );
}

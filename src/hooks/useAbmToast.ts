import { useToast } from '@/components/ui/ToastProvider';
import { friendlyError, type FriendlyErrorContext } from '@/lib/friendlyError';

/** Toast + mensajes de error amigables para formularios ABM. */
export function useAbmToast() {
  const toast = useToast();
  return {
    success: (message: string) => toast.success(message),
    /** Muestra toast de error y devuelve el mensaje (para `setError`). */
    fail(e: unknown, context: FriendlyErrorContext): string {
      const msg = friendlyError(e, context);
      toast.error(msg);
      return msg;
    },
  };
}

import { useNavigate } from 'react-router-dom';
import type { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import { TableroCuentaCorriente } from './TableroCuentaCorriente';
import type { TipoContraparte } from '@/lib/cuentaCorriente';

function periodToDates(
  period: string,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (period === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (period === 'month') {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
      to: todayStr,
    };
  }
  if (period === '3months') {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  return null;
}

/**
 * Tablero de cobranzas/pagos, montado como pestaña de módulo en el dashboard del
 * tenant (ver "Panel del tenant: pestañas por módulo" en CLAUDE.md) — no vive dentro
 * de la sección de Cuenta Corriente, que solo muestra el detalle de cuentas.
 */
export function CuentaCorrienteDashboardSection({
  dash,
}: {
  dash: ReturnType<typeof useTenantOwnerDashboard>;
}) {
  const navigate = useNavigate();
  const dates = periodToDates(dash.period, dash.customFrom, dash.customTo);

  function irACuenta(tipo: TipoContraparte, id: string) {
    navigate(`/cuenta-corriente?tipo=${tipo}&id=${encodeURIComponent(id)}`);
  }

  return (
    <section aria-label="Cuenta corriente">
      <TableroCuentaCorriente
        onSeleccionarContraparte={irACuenta}
        desde={dates?.from}
        hasta={dates?.to}
      />
    </section>
  );
}

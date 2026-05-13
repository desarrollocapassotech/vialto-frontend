/** Partes para inputs `type="date"` y `type="time"` en zona horaria local. */
export type FechaHoraPartes = { fecha: string; hora: string };

export function isoToFechaHora(iso: string | null | undefined): FechaHoraPartes {
  if (!iso) return { fecha: '', hora: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: '', hora: '' };
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { fecha: `${y}-${mo}-${day}`, hora: `${h}:${mi}` };
}

/** Acepta ISO string, epoch ms o Date (por si la API serializa distinto en listas). */
export function coerceMovimientoStockFechaIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Fecha/hora del movimiento de stock (detalle + historiales).
 * Usa la misma extracción que los inputs (`isoToFechaHora`), alineada con lo que el usuario cargó vía `fechaHoraToIso`.
 * Con `alwaysShowTime`, siempre muestra `hh:mm` en 24 h (incluye 00:00); sin eso, omite la hora si es medianoche local.
 */
export function formatMovimientoStockFechaFromIso(
  raw: unknown,
  options?: { alwaysShowTime?: boolean },
): string {
  const iso = coerceMovimientoStockFechaIso(raw);
  if (!iso) return '—';
  const { fecha, hora } = isoToFechaHora(iso);
  if (!fecha) return '—';
  const parts = fecha.split('-');
  if (parts.length !== 3) return '—';
  const [y, m, d] = parts;
  const soloFecha = `${d}/${m}/${y}`;
  const ht = (hora ?? '').trim();
  if (!options?.alwaysShowTime && (!ht || ht === '00:00')) return soloFecha;
  const timePart = ht || '00:00';
  return `${soloFecha} ${timePart}`;
}

/** Fecha y hora local en español Argentina, reloj de 24 h (p. ej. registro en detalle de movimiento). */
export function formatInstantEsAr24h(iso: string | number | Date | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d =
    typeof iso === 'object' && iso instanceof Date
      ? iso
      : new Date(typeof iso === 'number' ? iso : String(iso).trim());
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Sin fecha → no se envía. Hora vacía con fecha → 00:00 hora local.
 * La API sigue recibiendo un ISO UTC; el backend ya acepta opcional.
 */
export function fechaHoraToIso(fecha: string, hora: string): string | undefined {
  const f = fecha.trim();
  if (!f) return undefined;
  const t = hora.trim();
  const timePart = t || '00:00';
  const m = /^(\d{1,2}):(\d{2})$/.exec(timePart);
  if (!m) {
    const d = new Date(`${f}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const d = new Date(
    `${f}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`,
  );
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Zona usada en listados (stock, viajes) para que coincida con la operación en Argentina. */
const TZ_LISTADOS_AR = 'America/Argentina/Buenos_Aires';

function parseIsoFlexible(iso: string): Date {
  const s = iso.trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // Algunos backends serializan `YYYY-MM-DD HH:mm:ss.sss` sin `T`
  const d2 = new Date(s.replace(' ', 'T'));
  return d2;
}

/**
 * Listados de viajes: `dd/mm/aaaa` en Argentina, o `dd/mm/aaaa hh:mm` si la hora en AR no es 00:00.
 */
export function formatIsoFechaHoraListadoEsAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = parseIsoFlexible(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const tz = TZ_LISTADOS_AR;
    const soloFecha = d.toLocaleDateString('es-AR', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const parts = new Intl.DateTimeFormat('es-AR', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '', 10);
    if (hour === 0 && minute === 0) return soloFecha;
    const hora = new Intl.DateTimeFormat('es-AR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${soloFecha} ${hora}`;
  } catch {
    return '—';
  }
}

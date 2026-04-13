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

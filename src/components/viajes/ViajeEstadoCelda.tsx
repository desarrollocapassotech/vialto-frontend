import {
  estadoViajeBadgeClass,
  estadoViajeBadgeClassDefault,
  estadoViajeLabel,
  estadoMuestraKmLitros,
  tooltipEstadoViaje,
  VIAJE_ESTADOS_TODOS,
} from '@/lib/viajesEstados';
import type { ViajeInlineDraft } from './viajesSuperadminTypes';

type Props = {
  viajeId: string;
  viajeEstado: string;
  isEditing: boolean;
  draft: ViajeInlineDraft | null;
  isQuickOpen: boolean;
  isSavingEstado: boolean;
  /** Cambia el estado en el draft (modo edición inline). */
  onDraftEstadoChange: (next: string) => void;
  /** Estado final requiere km/litros vacíos en el draft — abre el dialog. */
  onRequiereKmLitrosDraft: (next: string) => void;
  /** Cambio de estado desde el quick-select fuera del modo edición. */
  onQuickEstadoChange: (next: string) => void;
  onQuickOpen: () => void;
  onQuickClose: () => void;
};

const ESTADOS = VIAJE_ESTADOS_TODOS;

export function ViajeEstadoCelda({
  viajeId: _viajeId,
  viajeEstado,
  isEditing,
  draft,
  isQuickOpen,
  isSavingEstado,
  onDraftEstadoChange,
  onRequiereKmLitrosDraft,
  onQuickEstadoChange,
  onQuickOpen,
  onQuickClose,
}: Props) {
  // ── Modo edición inline: select dentro del formulario ────────────────────
  if (isEditing && draft) {
    return (
      <select
        value={draft.estado}
        onChange={(e) => {
          const next = e.target.value;
          const kmVacios =
            !draft.kmRecorridos.trim() && !draft.litrosConsumidos.trim();
          if (estadoMuestraKmLitros(next) && kmVacios) {
            onRequiereKmLitrosDraft(next);
            return;
          }
          onDraftEstadoChange(next);
        }}
        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
      >
        {ESTADOS.map((x) => (
          <option key={x} value={x} title={tooltipEstadoViaje(x)}>
            {estadoViajeLabel[x] ?? x}
          </option>
        ))}
      </select>
    );
  }

  // ── Quick-select: clic en badge abre selector ────────────────────────────
  if (isQuickOpen) {
    return (
      <select
        autoFocus
        value={viajeEstado}
        disabled={isSavingEstado}
        onChange={(e) => onQuickEstadoChange(e.target.value)}
        onBlur={onQuickClose}
        className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
        aria-label="Cambiar estado del viaje"
      >
        {ESTADOS.map((x) => (
          <option key={x} value={x} title={tooltipEstadoViaje(x)}>
            {estadoViajeLabel[x] ?? x}
          </option>
        ))}
      </select>
    );
  }

  // ── Badge estático (estado actual) ───────────────────────────────────────
  return (
    <button
      type="button"
      title={tooltipEstadoViaje(viajeEstado)}
      aria-label={`Estado ${estadoViajeLabel[viajeEstado] ?? viajeEstado}. Abrir selector para cambiar.`}
      disabled={isSavingEstado}
      onClick={() => { if (!isSavingEstado) onQuickOpen(); }}
      className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
        estadoViajeBadgeClass[viajeEstado] ?? estadoViajeBadgeClassDefault
      }`}
    >
      {isSavingEstado ? '…' : estadoViajeLabel[viajeEstado] ?? 'Sin clasificar'}
    </button>
  );
}

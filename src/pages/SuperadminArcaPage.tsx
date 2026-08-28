import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { useToast } from "@/lib/toast";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { EmitirLiquidacionModal } from "@/components/liquidaciones/EmitirLiquidacionModal";
import { AnularLiquidacionModal } from "@/components/liquidaciones/AnularLiquidacionModal";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson, apiFetch } from "@/lib/api";
import { anulacionComprobanteLabel } from "@/lib/arcaCbteTipo";
import { filenameFromContentDisposition } from "@/lib/downloadFilename";
import { friendlyError } from "@/lib/friendlyError";
import { formatStoredArcaError } from "@/lib/arcaFriendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ArcaConfigTenantPage } from "@/pages/ArcaConfigTenantPage";
import type { ArcaConfig, ArcaLog, Liquidacion } from "@/types/api";

// ── Helpers visuales ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  borrador: "BORRADOR",
  pendiente_cae: "ESPERANDO AFIP",
  autorizado: "LIQUIDADO",
  error: "ERROR DE AFIP",
  anulado: "ANULADO",
};

const ESTADO_CLASS: Record<string, string> = {
  borrador: "bg-vialto-steel/15 text-vialto-steel",
  pendiente_cae: "bg-amber-100 text-amber-800",
  autorizado: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  anulado: "bg-slate-100 text-slate-600",
};

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const fmt = (n: number) => ars.format(n);
const fmtDate = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().join("/");
const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });

// ── Modales genéricos ─────────────────────────────────────────────────────────

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-vialto-charcoal">
          {title}
        </h3>
        <p className="mt-3 text-sm text-vialto-steel">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 font-[family-name:var(--font-ui)] text-sm font-medium text-vialto-steel hover:bg-slate-100 hover:text-vialto-charcoal transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 font-[family-name:var(--font-ui)] text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LiquidacionesTab ──────────────────────────────────────────────────────────

function LiquidacionesTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Liquidacion[] | null>(null);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowProcessing, setRowProcessing] = useState<Record<string, string>>(
    {},
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pendingEmitir, setPendingEmitir] = useState<Liquidacion | null>(null);

  const [anularId, setAnularId] = useState<string | null>(null);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<Liquidacion[]>(
        `/api/platform/arca/liquidaciones?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      ),
      apiJson<ArcaConfig | null>(
        `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      ).catch(() => null),
    ])
      .then(([liq, cfg]) => {
        setItems(liq);
        setArcaConfig(cfg);
      })
      .catch((e) => setError(friendlyError(e, "arca")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  function onEmitirSuccess(updated: Liquidacion) {
    setItems(
      (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
    );
    setPendingEmitir(null);
    showToast(
      updated.cae
        ? `Comprobante emitido correctamente. CAE: ${updated.cae}`
        : "Comprobante emitido correctamente.",
    );
  }

  async function descargarPdf(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "pdf" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      const res = await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/pdf?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al descargar el PDF");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `liquidacion-${id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function descargarPdfNc(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "pdf-nc" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      const res = await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/pdf-anulacion?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al descargar el PDF de la anulación");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `anulacion-${id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function anular(id: string, motivo: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "anular" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/anular?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "POST", body: JSON.stringify({ motivo }) },
      );
      setAnularId(null);
      load();
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function eliminar(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "eliminar" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      await apiFetch(
        `/api/platform/arca/liquidaciones/${id}?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      setEliminarId(null);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  if (loading)
    return (
      <p className="mt-6 text-sm text-vialto-steel">Cargando liquidaciones…</p>
    );
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <div className="mt-6 space-y-3">
      <ListadoDatos
        columns={[
          {
            id: "periodo",
            header: "Período",
            primary: true,
            cell: (liq) =>
              `${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "viajes",
            header: "Vj.",
            cell: (liq) => liq.cantViajes,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "bruto",
            header: "Bruto",
            cell: (liq) => fmt(liq.bruto),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "comision",
            header: "Comisión",
            cell: (liq) => fmt(liq.comision),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-vialto-steel`,
          },
          {
            id: "liquido",
            header: "Líquido",
            cell: (liq) => fmt(liq.liquido),
            tdClassName: `${listadoTablaTdClass} text-right font-medium tabular-nums`,
          },
          {
            id: "cae",
            header: "CAE",
            cell: (liq) => liq.cae ?? "—",
            tdClassName: `${listadoTablaTdClass} font-mono text-xs text-vialto-steel`,
          },
          {
            id: "estado",
            header: "Estado",
            cell: (liq) => (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ""}`}
                  >
                    {ESTADO_LABEL[liq.estado] ?? liq.estado}
                  </span>
                  <AmbienteTestBadge ambiente={liq.ambiente} />
                </div>
                {liq.arcaError &&
                  (() => {
                    const msg =
                      formatStoredArcaError(liq.arcaError) ?? liq.arcaError;
                    return (
                      <p
                        className="mt-0.5 max-w-[180px] truncate text-xs text-red-600"
                        title={msg}
                      >
                        {msg}
                      </p>
                    );
                  })()}
                {rowErrors[liq.id] && (
                  <p
                    className="mt-1 max-w-[180px] rounded bg-red-50 p-1 text-xs font-medium text-red-700"
                    title={rowErrors[liq.id]}
                  >
                    Error: {rowErrors[liq.id]}
                  </p>
                )}
              </>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={items ?? []}
        rowKey={(liq) => liq.id}
        emptyMessage="No hay liquidaciones para esta empresa."
        renderActions={(liq) => {
          const isProc = rowProcessing[liq.id];
          return (
            <>
              {(liq.estado === "borrador" || liq.estado === "error") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setPendingEmitir(liq)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright disabled:opacity-50`}
                >
                  Emitir
                </button>
              )}
              {(liq.estado === "autorizado" || liq.estado === "anulado") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => descargarPdf(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                >
                  {isProc === "pdf" ? "…" : "PDF"}
                </button>
              )}
              {liq.estado === "anulado" && liq.anulacionCae && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => descargarPdfNc(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                  title={anulacionComprobanteLabel(liq.anulacionCbteTipo)}
                >
                  {isProc === "pdf-nc" ? "…" : "PDF anulación"}
                </button>
              )}
              {liq.estado === "autorizado" && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setAnularId(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-amber-600 hover:text-amber-700 disabled:opacity-50`}
                >
                  {isProc === "anular" ? "…" : "Anular"}
                </button>
              )}
              {(liq.estado === "borrador" ||
                liq.estado === "error" ||
                liq.estado === "pendiente_cae") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setEliminarId(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-red-600 hover:text-red-700 disabled:opacity-50`}
                >
                  {isProc === "eliminar" ? "…" : "Eliminar"}
                </button>
              )}
            </>
          );
        }}
        actionsHeader="Acciones"
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => {
          const isProc = rowProcessing[liq.id];
          return (
            <ListadoCard
              primary={`${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`}
              fields={[
                { label: "Viajes", value: liq.cantViajes },
                { label: "Bruto", value: fmt(liq.bruto) },
                { label: "Comisión", value: fmt(liq.comision) },
                { label: "Líquido", value: fmt(liq.liquido) },
                { label: "CAE", value: liq.cae ?? "—" },
                {
                  label: "Estado",
                  value: (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ""}`}
                        >
                          {ESTADO_LABEL[liq.estado] ?? liq.estado}
                        </span>
                        <AmbienteTestBadge ambiente={liq.ambiente} />
                      </div>
                      {liq.arcaError &&
                        (() => {
                          const msg =
                            formatStoredArcaError(liq.arcaError) ??
                            liq.arcaError;
                          return (
                            <p
                              className="mt-0.5 truncate text-xs text-red-600"
                              title={msg}
                            >
                              {msg}
                            </p>
                          );
                        })()}
                      {rowErrors[liq.id] && (
                        <p
                          className="mt-1 rounded bg-red-50 p-1 text-xs font-medium text-red-700"
                          title={rowErrors[liq.id]}
                        >
                          Error: {rowErrors[liq.id]}
                        </p>
                      )}
                    </>
                  ),
                },
              ]}
              actions={
                <>
                  {(liq.estado === "borrador" || liq.estado === "error") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setPendingEmitir(liq)}
                      className={`${listadoTablaAccionClass} inline-flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright disabled:opacity-50`}
                    >
                      <Receipt
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      Emitir
                    </button>
                  )}
                  {(liq.estado === "autorizado" ||
                    liq.estado === "anulado") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => descargarPdf(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                    >
                      {isProc === "pdf" ? "…" : "PDF"}
                    </button>
                  )}
                  {liq.estado === "anulado" && liq.anulacionCae && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => descargarPdfNc(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                      title={anulacionComprobanteLabel(liq.anulacionCbteTipo)}
                    >
                      {isProc === "pdf-nc" ? "…" : "PDF anulación"}
                    </button>
                  )}
                  {liq.estado === "autorizado" && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setAnularId(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-amber-600 hover:text-amber-700 disabled:opacity-50`}
                    >
                      {isProc === "anular" ? "…" : "Anular"}
                    </button>
                  )}
                  {(liq.estado === "borrador" ||
                    liq.estado === "error" ||
                    liq.estado === "pendiente_cae") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setEliminarId(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-red-600 hover:text-red-700 disabled:opacity-50`}
                    >
                      {isProc === "eliminar" ? "…" : "Eliminar"}
                    </button>
                  )}
                </>
              }
            />
          );
        }}
      />

      {pendingEmitir && (
        <EmitirLiquidacionModal
          liq={pendingEmitir}
          getToken={getToken}
          onSuccess={onEmitirSuccess}
          onClose={() => setPendingEmitir(null)}
          emitirUrl={`/api/platform/arca/liquidaciones/${encodeURIComponent(pendingEmitir.id)}/emitir?tenantId=${encodeURIComponent(tenantId)}`}
          detalleUrl={`/api/platform/arca/liquidaciones/${encodeURIComponent(pendingEmitir.id)}?tenantId=${encodeURIComponent(tenantId)}`}
          configUrl={`/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`}
          arcaConfig={arcaConfig}
          ivaPct={pendingEmitir.ivaPct ?? arcaConfig?.ivaGastosAdmin}
          tenantId={tenantId}
        />
      )}

      <AnularLiquidacionModal
        open={anularId != null}
        message="¿Deseás anular esta liquidación? Se emite un comprobante de ajuste en ARCA y los viajes quedan disponibles para una nueva liquidación."
        busy={anularId != null && rowProcessing[anularId] === "anular"}
        error={anularId != null ? (rowErrors[anularId] ?? null) : null}
        onCancel={() => {
          if (anularId && rowProcessing[anularId] === "anular") return;
          setAnularId(null);
        }}
        onConfirm={(motivo) => {
          if (!anularId) return;
          void anular(anularId, motivo);
        }}
      />

      <ConfirmModal
        isOpen={eliminarId != null}
        onClose={() => {
          if (eliminarId && rowProcessing[eliminarId] === "eliminar") return;
          setEliminarId(null);
        }}
        onConfirm={() => {
          if (!eliminarId) return;
          void eliminar(eliminarId);
          setEliminarId(null);
        }}
        title="Eliminar liquidación"
        message="¿Deseás eliminar esta liquidación? Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />
    </div>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────────

function LogsTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<ArcaLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiJson<ArcaLog[]>(
      `/api/platform/arca/logs?tenantId=${encodeURIComponent(tenantId)}`,
      () => getToken(),
    )
      .then(setLogs)
      .catch((e) => setError(friendlyError(e, "arca")))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading)
    return <p className="mt-6 text-sm text-vialto-steel">Cargando logs…</p>;
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <ListadoDatos
      className="mt-6"
      columns={[
        {
          id: "fecha",
          header: "Fecha",
          primary: true,
          cell: (log) => fmtTs(log.createdAt),
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: "method",
          header: "Método",
          cell: (log) => (
            <span className="font-mono text-xs text-vialto-charcoal">
              {log.method}
            </span>
          ),
          tdClassName: listadoTablaTdClass,
        },
        {
          id: "ambiente",
          header: "Ambiente",
          cell: (log) => log.ambiente,
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: "http",
          header: "HTTP",
          cell: (log) => log.httpStatus ?? "—",
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: "ms",
          header: "ms",
          cell: (log) => log.durationMs,
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: "resultado",
          header: "Resultado",
          cell: (log) =>
            log.exitoso ? (
              <span className="font-medium text-green-700">OK</span>
            ) : (
              <span className="text-red-600" title={log.error ?? ""}>
                {log.error ? "Error" : "Fallido"}
              </span>
            ),
          tdClassName: listadoTablaTdClass,
        },
      ]}
      rows={logs ?? []}
      rowKey={(log) => log.id}
      emptyMessage="No hay logs registrados para esta empresa."
      renderMobileCard={(log) => (
        <ListadoCard
          primary={fmtTs(log.createdAt)}
          fields={[
            {
              label: "Método",
              value: <span className="font-mono">{log.method}</span>,
            },
            { label: "Ambiente", value: log.ambiente },
            { label: "HTTP", value: log.httpStatus ?? "—" },
            { label: "ms", value: log.durationMs },
            {
              label: "Resultado",
              value: log.exitoso ? (
                <span className="font-medium text-green-700">OK</span>
              ) : (
                <span className="text-red-600">{log.error ?? "Fallido"}</span>
              ),
            },
          ]}
        />
      )}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "config" | "liquidaciones" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Configuración" },
  { id: "liquidaciones", label: "Liquidaciones" },
  { id: "logs", label: "Logs de auditoría" },
];

export function SuperadminArcaPage() {
  const tenants = useTenantsList();
  const [tenantId, setTenantId] = useState("");
  const [tab, setTab] = useState<Tab>("config");
  const selectedTenantModules = tenants?.find(
    (t) => t.clerkOrgId === tenantId,
  )?.modules;

  function handleTenantChange(next: string) {
    setTenantId(next);
    setTab("config");
  }

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          ARCA / AFIP
        </h1>
        <p className="mt-2 text-vialto-steel">
          Configuración de emisión electrónica y liquidaciones CVLP por empresa.
        </p>

        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={tenantId}
            onChange={handleTenantChange}
          />
        </div>

        {!tenantId && (
          <p className="mt-6 text-sm text-vialto-steel">
            Seleccioná una empresa para gestionar su configuración ARCA.
          </p>
        )}

        {tenantId && (
          <>
            <div className="mt-8 flex gap-0.5 border-b border-black/10">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={[
                    "px-4 py-2.5 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors",
                    tab === t.id
                      ? "border-vialto-fire font-semibold text-vialto-charcoal"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "config" && (
              <ArcaConfigTenantPage
                key={`cfg-${tenantId}`}
                tenantId={tenantId}
                embeddedInSuperadmin
                modules={selectedTenantModules}
              />
            )}
            {tab === "liquidaciones" && (
              <LiquidacionesTab key={`liq-${tenantId}`} tenantId={tenantId} />
            )}
            {tab === "logs" && (
              <LogsTab key={`log-${tenantId}`} tenantId={tenantId} />
            )}
          </>
        )}
      </div>
    </SuperadminOnly>
  );
}

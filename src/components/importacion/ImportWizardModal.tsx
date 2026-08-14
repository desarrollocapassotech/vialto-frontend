import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { modalOverlayClass } from "@/lib/modalLayers";
import { labelModulo } from "@/lib/platformLabels";
import {
  MODULOS_SECUENCIA,
  useImportWizard,
} from "@/hooks/useImportWizard";

interface ImportWizardModalProps {
  tenantId: string;
  tenantModules: string[];
  onClose: () => void;
}

const th = "px-3 py-2 text-left font-semibold text-vialto-steel";
const td = "px-3 py-2 border-t border-black/10";

/**
 * Wizard paso a paso del import: Clientes → Transportes → Choferes →
 * Vehículos → Viajes → (opcional) Liquidaciones borrador → (opcional)
 * Facturar a clientes. Cada etapa se previsualiza y confirma por separado —
 * no hay un botón único que confirme todo el archivo de una vez.
 */
export function ImportWizardModal({
  tenantId,
  tenantModules,
  onClose,
}: ImportWizardModalProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wizard = useImportWizard(tenantId, [...MODULOS_SECUENCIA], () =>
    getToken(),
  );

  const hasArca = tenantModules.includes("integracion-arca");
  const hasFacturacion = tenantModules.includes("facturacion");

  const [numerosPorCliente, setNumerosPorCliente] = useState<
    Record<string, string>
  >({});

  const pasoActualIndex =
    wizard.fase === "upload"
      ? 0
      : wizard.fase === "modulo"
        ? 1 + wizard.moduloIndex
        : wizard.secuencia.length + 1;
  const totalPasos = wizard.secuencia.length + 3; // + upload + liquidaciones + facturas

  return (
    <div
      className={modalOverlayClass}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-vialto-charcoal">
              Importar datos
            </h2>
            <p className="mt-0.5 text-xs text-vialto-steel">
              Paso {Math.min(pasoActualIndex + 1, totalPasos)} de {totalPasos}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {wizard.error && (
            <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {wizard.error}
            </div>
          )}

          {wizard.fase === "upload" && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-vialto-steel">
                Subí un único Excel con las hojas de Clientes, Transportes,
                Choferes, Vehículos y Viajes. Se van a procesar en ese orden,
                una hoja a la vez.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) wizard.startFile(f);
                }}
                className="text-sm"
              />
            </div>
          )}

          {wizard.fase === "modulo" && wizard.moduloActual && (
            <EtapaModulo wizard={wizard} />
          )}

          {wizard.fase === "post-liquidaciones" && hasArca && (
            <EtapaOpcional
              titulo="Generar liquidaciones borrador"
              descripcion="Se van a agrupar los viajes recién creados por transportista. Ninguna liquidación se emite a AFIP — quedan en borrador para que las emitas manualmente cuando quieras."
              loading={wizard.loading}
              preview={wizard.liquidacionesPreview}
              onPedirPreview={wizard.pedirPreviewLiquidaciones}
              onSaltear={wizard.saltearLiquidaciones}
              onConfirmar={wizard.confirmarLiquidaciones}
              renderTabla={(items: typeof wizard.liquidacionesPreview) =>
                items && items.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>Transportista</th>
                        <th className={th}>Viajes</th>
                        <th className={th}>Período</th>
                        <th className={th}>Bruto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((g) => (
                        <tr key={g.transportistaId}>
                          <td className={td}>{g.transportistaNombre}</td>
                          <td className={td}>{g.cantidadViajes}</td>
                          <td className={td}>
                            {g.periodoDesde} — {g.periodoHasta}
                          </td>
                          <td className={td}>
                            {g.bruto.toLocaleString("es-AR", {
                              style: "currency",
                              currency: "ARS",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-vialto-steel">
                    No hay viajes con transportista externo para liquidar.
                  </p>
                )
              }
            />
          )}
          {wizard.fase === "post-liquidaciones" && !hasArca && (
            <AvanceSilencioso onNext={wizard.saltearLiquidaciones} />
          )}

          {wizard.fase === "post-facturas" && (hasArca || hasFacturacion) && (
            <EtapaOpcional
              titulo="Facturar a clientes"
              descripcion="Se van a agrupar los viajes recién creados por cliente."
              loading={wizard.loading}
              preview={wizard.facturasPreview}
              onPedirPreview={wizard.pedirPreviewFacturas}
              onSaltear={wizard.saltearFacturas}
              onConfirmar={() =>
                wizard.confirmarFacturas(
                  hasArca ? undefined : numerosPorCliente,
                )
              }
              confirmDisabled={
                !hasArca &&
                (wizard.facturasPreview?.some(
                  (g) => !numerosPorCliente[g.clienteId]?.trim(),
                ) ??
                  false)
              }
              renderTabla={(items: typeof wizard.facturasPreview) =>
                items && items.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>Cliente</th>
                        <th className={th}>Viajes</th>
                        <th className={th}>Importe</th>
                        {!hasArca && <th className={th}>N° de factura</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((g) => (
                        <tr key={g.clienteId}>
                          <td className={td}>{g.clienteNombre}</td>
                          <td className={td}>{g.cantidadViajes}</td>
                          <td className={td}>
                            {g.importe.toLocaleString("es-AR", {
                              style: "currency",
                              currency: g.moneda,
                            })}
                          </td>
                          {!hasArca && (
                            <td className={td}>
                              <input
                                type="text"
                                value={numerosPorCliente[g.clienteId] ?? ""}
                                onChange={(e) =>
                                  setNumerosPorCliente((prev) => ({
                                    ...prev,
                                    [g.clienteId]: e.target.value,
                                  }))
                                }
                                placeholder="0001-00000001"
                                className="h-8 w-full border border-black/20 px-2 text-sm"
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-vialto-steel">
                    No hay viajes para facturar.
                  </p>
                )
              }
            />
          )}
          {wizard.fase === "post-facturas" && !hasArca && !hasFacturacion && (
            <AvanceSilencioso onNext={wizard.saltearFacturas} />
          )}

          {wizard.fase === "terminado" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-vialto-charcoal">
                Import terminado.
              </p>
              <ul className="flex flex-col gap-1 text-sm text-vialto-steel">
                {wizard.etapasCompletadas.map((e) => (
                  <li key={e.modulo}>
                    {labelModulo(e.modulo)}: {e.log.exitosas} creados/actualizados
                    {e.log.errores > 0 ? `, ${e.log.errores} con error` : ""}
                  </li>
                ))}
                {wizard.liquidacionesCreadas && (
                  <li>
                    Liquidaciones borrador: {wizard.liquidacionesCreadas.length}
                  </li>
                )}
                {wizard.facturasCreadas && (
                  <li>Facturas: {wizard.facturasCreadas.length}</li>
                )}
              </ul>
              <button
                type="button"
                onClick={onClose}
                className="self-start border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EtapaModulo({
  wizard,
}: {
  wizard: ReturnType<typeof useImportWizard>;
}) {
  const p = wizard.preview;
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {labelModulo(wizard.moduloActual ?? "")}
      </h3>
      {wizard.loading && !p && <Spinner />}
      {p && (
        <>
          <p className="text-sm text-vialto-steel">
            {p.exitosas} de {p.totalFilas} filas listas para crear.
            {p.errores > 0 && ` ${p.errores} con error.`}
          </p>
          {p.detalleErrores.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-black/10">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={th}>Fila</th>
                    <th className={th}>Campo</th>
                    <th className={th}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {p.detalleErrores.map((e, i) => (
                    <tr key={i}>
                      <td className={td}>{e.fila}</td>
                      <td className={td}>{e.campo ?? "—"}</td>
                      <td className={td}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={wizard.loading || p.exitosas === 0}
              onClick={() => void wizard.confirmarModuloActual()}
              className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
            >
              Confirmar y continuar
            </button>
            <button
              type="button"
              disabled={wizard.loading}
              onClick={wizard.saltearModuloActual}
              className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
            >
              Saltear esta hoja
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EtapaOpcional<T>({
  titulo,
  descripcion,
  loading,
  preview,
  onPedirPreview,
  onSaltear,
  onConfirmar,
  renderTabla,
  confirmDisabled,
}: {
  titulo: string;
  descripcion: string;
  loading: boolean;
  preview: T[] | null;
  onPedirPreview: () => void;
  onSaltear: () => void;
  onConfirmar: () => void;
  renderTabla: (items: T[] | null) => React.ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {titulo}
      </h3>
      <p className="text-sm text-vialto-steel">{descripcion}</p>

      {!preview && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onPedirPreview}
            className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Ver preview"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onSaltear}
            className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
          >
            No, gracias
          </button>
        </div>
      )}

      {preview && (
        <>
          {renderTabla(preview)}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading || preview.length === 0 || confirmDisabled}
              onClick={onConfirmar}
              className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Confirmar"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onSaltear}
              className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Tenant sin el módulo correspondiente: se saltea la etapa sin mostrar nada. */
function AvanceSilencioso({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

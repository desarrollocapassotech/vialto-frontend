import { useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useImportacion } from '@/hooks/useImportacion';
import { useImportTemplates, getTemplateExample } from '@/hooks/useImportTemplates';
import { labelModulo } from '@/lib/platformLabels';
import type { Tenant, ImportPreviewViaje, ImportPreviewFactura, ImportPreviewEntidad } from '@/types/api';

interface ImportacionModalProps {
  tenant: Tenant;
  onClose: () => void;
}

type MainTab = 'importar' | 'templates';
type ImportStep = 'upload' | 'preview' | 'result';

export function ImportacionModal({ tenant, onClose }: ImportacionModalProps) {
  const { getToken } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('importar');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importacion = useImportacion(tenant.clerkOrgId, () => getToken());
  const { templates, loading: loadingTpls, saving, error: tplError, save: saveTemplate } = useImportTemplates(tenant.clerkOrgId);

  // Template form state
  const [tplModulo, setTplModulo] = useState('');
  const [tplNombre, setTplNombre] = useState('');
  const [tplConfig, setTplConfig] = useState('');
  const [tplJsonError, setTplJsonError] = useState<string | null>(null);
  const [tplSaved, setTplSaved] = useState(false);

  function handleModuloChange(m: string) {
    setTplModulo(m);
    setTplNombre(m ? `Template ${labelModulo(m)} — ${tenant.name}` : '');
    setTplConfig(m ? getTemplateExample(m) : '');
    setTplJsonError(null);
    setTplSaved(false);
  }

  function handleConfigChange(val: string) {
    setTplConfig(val);
    setTplJsonError(null);
    setTplSaved(false);
    try { JSON.parse(val); } catch { setTplJsonError('JSON inválido'); }
  }

  async function handleSaveTemplate() {
    if (!tplModulo || !tplNombre || !tplConfig) return;
    try { JSON.parse(tplConfig); } catch { setTplJsonError('JSON inválido — corregilo antes de guardar'); return; }
    const ok = await saveTemplate(tplModulo, tplNombre, tplConfig);
    if (ok) { setTplSaved(true); }
  }

  function handleClose() {
    importacion.reset();
    onClose();
  }

  const modulosDisponibles = tenant.modules.filter((m) =>
    ['viajes', 'clientes', 'choferes', 'vehiculos', 'stock'].includes(m),
  );

  const { step, modulo, setModulo, file, setFile, loading, error, preview, log, submitPreview, confirm, reset } = importacion;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-5xl bg-white shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-vialto-charcoal">
              Importar datos
            </h2>
            <p className="mt-0.5 text-sm text-vialto-steel">{tenant.name}</p>
          </div>
          <button type="button" onClick={handleClose} className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none px-2">✕</button>
        </div>

        {/* Main tabs */}
        <div className="flex border-b border-black/10">
          {(['importar', 'templates'] as MainTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMainTab(t)}
              className={[
                'px-6 py-2.5 text-xs uppercase tracking-widest font-[family-name:var(--font-ui)] border-b-2 -mb-px transition-colors',
                mainTab === t
                  ? 'border-vialto-fire text-vialto-fire'
                  : 'border-transparent text-vialto-steel hover:text-vialto-charcoal',
              ].join(' ')}
            >
              {t === 'importar' ? 'Importar' : 'Templates'}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB: IMPORTAR                                         */}
        {/* ══════════════════════════════════════════════════════ */}
        {mainTab === 'importar' && (
          <>
            {/* Step indicator */}
            <div className="flex border-b border-black/10 bg-vialto-mist">
              {(['upload', 'preview', 'result'] as ImportStep[]).map((s, i) => {
                const labels = ['1. Archivo', '2. Previsualización', '3. Resultado'];
                const isActive = step === s;
                const isDone = (s === 'upload' && step !== 'upload') || (s === 'preview' && step === 'result');
                return (
                  <div key={s} className={['flex-1 py-2 text-center text-[11px] uppercase tracking-widest font-[family-name:var(--font-ui)]',
                    isActive ? 'bg-vialto-charcoal text-white' : isDone ? 'text-vialto-fire' : 'text-vialto-steel'].join(' ')}>
                    {labels[i]}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

              {/* Step 1 */}
              {step === 'upload' && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">Módulo *</label>
                    {modulosDisponibles.length === 0 ? (
                      <p className="text-sm text-vialto-steel">Esta empresa no tiene módulos con soporte de importación.</p>
                    ) : (
                      <select value={modulo} onChange={(e) => setModulo(e.target.value)}
                        className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal">
                        <option value="">Seleccioná un módulo…</option>
                        {modulosDisponibles.map((m) => (
                          <option key={m} value={m}>{labelModulo(m)}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">Archivo Excel (.xlsx / .xls) *</label>
                    <div onClick={() => fileInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-black/20 py-8 text-sm text-vialto-steel hover:border-vialto-charcoal hover:text-vialto-charcoal transition-colors">
                      {file ? (
                        <><span className="text-2xl">📄</span><span className="font-medium text-vialto-charcoal">{file.name}</span><span className="text-xs">{(file.size / 1024).toFixed(0)} KB — clic para cambiar</span></>
                      ) : (
                        <><span className="text-2xl">📂</span><span>Clic para seleccionar archivo</span></>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </div>

                  {modulo && templates.length > 0 && !templates.find((t) => t.modulo === modulo) && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      No hay template configurado para <strong>{labelModulo(modulo)}</strong>.{' '}
                      <button type="button" onClick={() => setMainTab('templates')} className="underline">Creá uno en la pestaña Templates</button>.
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 */}
              {step === 'preview' && preview && (
                <PreviewPanel preview={preview} />
              )}

              {/* Step 3 */}
              {step === 'result' && log && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <StatBox label="Total de filas" value={log.totalFilas} />
                    <StatBox label="Importadas" value={log.exitosas} highlight="ok" />
                    <StatBox label="Con errores" value={log.errores} highlight={log.errores > 0 ? 'error' : undefined} />
                  </div>
                  <div className={['rounded px-4 py-3 text-sm',
                    log.estado === 'completado' ? 'bg-green-50 border border-green-200 text-green-800' : '',
                    log.estado === 'con_errores' ? 'bg-amber-50 border border-amber-200 text-amber-800' : '',
                    log.estado === 'fallido' ? 'bg-red-50 border border-red-200 text-red-800' : '',
                  ].join(' ')}>
                    {log.estado === 'completado' && `✓ Importación completada — ${log.exitosas} registros creados.`}
                    {log.estado === 'con_errores' && `⚠ Importación parcial — ${log.exitosas} creados, ${log.errores} con error.`}
                    {log.estado === 'fallido' && '✕ La importación falló. No se creó ningún registro.'}
                  </div>
                  {log.detalles.some((d) => d.estado === 'error') && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">Filas con error</p>
                      <div className="max-h-48 overflow-y-auto rounded border border-red-200 bg-red-50 text-xs divide-y divide-red-100">
                        {log.detalles.filter((d) => d.estado === 'error').map((d, i) => (
                          <div key={i} className="px-3 py-1.5 text-red-800">
                            <span className="font-medium">Fila {d.fila}</span> — {d.mensaje}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer import */}
            <div className="flex items-center justify-between border-t border-black/10 px-6 py-4 bg-vialto-mist/40">
              <button type="button" onClick={step === 'preview' ? reset : handleClose}
                className="text-sm uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal px-3 py-1.5">
                {step === 'preview' ? 'Volver' : 'Cerrar'}
              </button>
              {step === 'upload' && (
                <button type="button" disabled={!modulo || !file || loading} onClick={submitPreview}
                  className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? 'Procesando…' : 'Ver previsualización'}
                </button>
              )}
              {step === 'preview' && preview && preview.exitosas > 0 && (
                <button type="button" disabled={loading} onClick={confirm}
                  className="inline-flex h-10 items-center px-5 bg-vialto-fire text-white text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? 'Importando…' : `Confirmar importación (${preview.exitosas} filas)`}
                </button>
              )}
              {step === 'result' && (
                <button type="button" onClick={handleClose}
                  className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite">
                  Listo
                </button>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB: TEMPLATES                                        */}
        {/* ══════════════════════════════════════════════════════ */}
        {mainTab === 'templates' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Templates existentes */}
              {loadingTpls ? (
                <p className="text-sm text-vialto-steel">Cargando templates…</p>
              ) : templates.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">Templates configurados</p>
                  <div className="rounded border border-black/10 divide-y divide-black/5">
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <span className="font-medium text-vialto-charcoal">{t.nombre}</span>
                          <span className="ml-2 text-xs text-vialto-steel">({labelModulo(t.modulo)})</span>
                        </div>
                        <span className={['text-[11px] px-2 py-0.5 uppercase tracking-wider', t.activo ? 'bg-green-100 text-green-700' : 'bg-vialto-mist text-vialto-steel'].join(' ')}>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-vialto-steel">No hay templates configurados para esta empresa.</p>
              )}

              {/* Formulario crear/actualizar template */}
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-vialto-steel">Crear / actualizar template</p>
                {tplError && <div className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{tplError}</div>}
                {tplSaved && <div className="mb-3 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">✓ Template guardado correctamente.</div>}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">Módulo *</label>
                    <select value={tplModulo} onChange={(e) => handleModuloChange(e.target.value)}
                      className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal">
                      <option value="">Seleccioná un módulo…</option>
                      {modulosDisponibles.map((m) => <option key={m} value={m}>{labelModulo(m)}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">Nombre del template *</label>
                    <input value={tplNombre} onChange={(e) => setTplNombre(e.target.value)}
                      placeholder="ej. Template viajes Fernández v1"
                      className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs uppercase tracking-wider text-vialto-steel">Configuración (JSON) *</label>
                      {tplJsonError && <span className="text-xs text-red-600">{tplJsonError}</span>}
                    </div>
                    <textarea
                      value={tplConfig}
                      onChange={(e) => handleConfigChange(e.target.value)}
                      rows={12}
                      spellCheck={false}
                      className={['w-full border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-vialto-charcoal resize-none',
                        tplJsonError ? 'border-red-400' : 'border-black/20'].join(' ')}
                      placeholder='{"sheet": 0, "headerRow": 1, "columns": [...]}'
                    />
                    <div className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] text-blue-800">
                      <span className="mt-0.5 shrink-0 text-base leading-none">💡</span>
                      <span>
                        El JSON viene precargado con los campos correctos para el módulo seleccionado.
                        Solo tenés que cambiar cada <code className="font-mono bg-blue-100 px-0.5">excelHeader</code> para que coincida exactamente con el nombre de columna que usa el cliente en su Excel.
                        El resto de la configuración (campos del sistema, tipos, lookups) no necesita modificarse.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer templates */}
            <div className="flex items-center justify-between border-t border-black/10 px-6 py-4 bg-vialto-mist/40">
              <button type="button" onClick={handleClose}
                className="text-sm uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal px-3 py-1.5">
                Cerrar
              </button>
              <button type="button"
                disabled={!tplModulo || !tplNombre || !tplConfig || !!tplJsonError || saving}
                onClick={handleSaveTemplate}
                className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? 'Guardando…' : 'Guardar template'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: 'ok' | 'error' }) {
  return (
    <div className={['rounded border px-4 py-3 text-center',
      highlight === 'ok' ? 'border-green-200 bg-green-50' : '',
      highlight === 'error' && value > 0 ? 'border-red-200 bg-red-50' : '',
      !highlight || (highlight === 'error' && value === 0) ? 'border-black/10 bg-vialto-mist' : '',
    ].join(' ')}>
      <p className={['text-2xl font-bold',
        highlight === 'ok' ? 'text-green-700' : '',
        highlight === 'error' && value > 0 ? 'text-red-700' : '',
        !highlight || (highlight === 'error' && value === 0) ? 'text-vialto-charcoal' : '',
      ].join(' ')}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-vialto-steel">{label}</p>
    </div>
  );
}

type PreviewTab = 'viajes' | 'facturas' | 'clientes' | 'transportistas';

function PreviewPanel({ preview }: { preview: import('@/types/api').ImportPreviewResult }) {
  const [tab, setTab] = useState<PreviewTab>('viajes');

  const hasViajes = (preview.viajes?.length ?? 0) > 0;
  const hasFacturas = (preview.facturas?.length ?? 0) > 0;
  const hasClientes = (preview.clientes?.length ?? 0) > 0;
  const hasTransportistas = (preview.transportistas?.length ?? 0) > 0;

  const nuevosClientes = preview.clientes?.filter((c) => c.esNuevo).length ?? 0;
  const nuevosTransp = preview.transportistas?.filter((t) => t.esNuevo).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="Filas totales" value={preview.totalFilas} />
        <StatBox label="Viajes a crear" value={preview.exitosas} highlight="ok" />
        <StatBox label="Facturas" value={preview.facturas?.length ?? 0} />
        <StatBox label="Errores" value={preview.errores} highlight={preview.errores > 0 ? 'error' : undefined} />
      </div>

      {/* Errores */}
      {preview.detalleErrores.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">Errores detectados</p>
          <div className="max-h-28 overflow-y-auto rounded border border-red-200 bg-red-50 text-xs divide-y divide-red-100">
            {preview.detalleErrores.map((e, i) => (
              <div key={i} className="px-3 py-1.5 text-red-800">
                <span className="font-medium">Fila {e.fila}</span>{e.campo && <span> · {e.campo}</span>} — {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.exitosas === 0 && (
        <p className="text-sm text-vialto-steel">No hay filas válidas. Revisá los errores y corregí el archivo.</p>
      )}

      {preview.exitosas > 0 && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-black/10">
            {([
              { key: 'viajes', label: `Viajes (${preview.viajes?.length ?? 0})`, show: hasViajes },
              { key: 'facturas', label: `Facturas (${preview.facturas?.length ?? 0})`, show: hasFacturas },
              { key: 'clientes', label: `Clientes (${preview.clientes?.length ?? 0})${nuevosClientes > 0 ? ` · ${nuevosClientes} nuevos` : ''}`, show: hasClientes },
              { key: 'transportistas', label: `Transportistas (${preview.transportistas?.length ?? 0})${nuevosTransp > 0 ? ` · ${nuevosTransp} nuevos` : ''}`, show: hasTransportistas },
            ] as { key: PreviewTab; label: string; show: boolean }[]).filter((t) => t.show).map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={['px-4 py-2 text-[11px] uppercase tracking-wider border-b-2 -mb-px transition-colors',
                  tab === key ? 'border-vialto-fire text-vialto-fire' : 'border-transparent text-vialto-steel hover:text-vialto-charcoal',
                ].join(' ')}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'viajes' && hasViajes && <ViajesTable viajes={preview.viajes!} />}
          {tab === 'facturas' && hasFacturas && <FacturasTable facturas={preview.facturas!} />}
          {tab === 'clientes' && hasClientes && <EntidadTable entidades={preview.clientes!} />}
          {tab === 'transportistas' && hasTransportistas && <EntidadTable entidades={preview.transportistas!} />}
        </>
      )}
    </div>
  );
}

function ViajesTable({ viajes }: { viajes: ImportPreviewViaje[] }) {
  const fmt = (v: unknown) => v != null ? String(v) : null;
  const money = (v: number | null) => v != null ? `$${v.toLocaleString('es-AR')}` : null;
  return (
    <div className="overflow-x-auto rounded border border-black/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-vialto-mist font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-fire text-left">
            <th className="px-3 py-2 whitespace-nowrap">Fila</th>
            <th className="px-3 py-2 whitespace-nowrap">Cliente</th>
            <th className="px-3 py-2 whitespace-nowrap">Transporte</th>
            <th className="px-3 py-2 whitespace-nowrap">Origen</th>
            <th className="px-3 py-2 whitespace-nowrap">Destino</th>
            <th className="px-3 py-2 whitespace-nowrap">F. Carga</th>
            <th className="px-3 py-2 whitespace-nowrap">F. Descarga</th>
            <th className="px-3 py-2 whitespace-nowrap">Carga</th>
            <th className="px-3 py-2 whitespace-nowrap">Monto</th>
            <th className="px-3 py-2 whitespace-nowrap">Nro FC</th>
            <th className="px-3 py-2 whitespace-nowrap">Flete</th>
            <th className="px-3 py-2 whitespace-nowrap">FC Flete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {viajes.map((v) => (
            <tr key={v.fila} className="hover:bg-vialto-mist/50">
              <td className="px-3 py-1.5 text-vialto-steel">{v.fila}</td>
              <Td>{fmt(v.cliente)}</Td>
              <Td>{fmt(v.transporte)}</Td>
              <Td>{fmt(v.origen)}</Td>
              <Td>{fmt(v.destino)}</Td>
              <Td>{fmt(v.fechaCarga)}</Td>
              <Td>{fmt(v.fechaDescarga)}</Td>
              <Td>{fmt(v.detalleCarga)}</Td>
              <Td>{money(v.monto)}</Td>
              <Td>{fmt(v.nroFactura)}</Td>
              <Td>{money(v.precioTransportistaExterno)}</Td>
              <Td>{fmt(v.nroFacturaTransporte)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FacturasTable({ facturas }: { facturas: ImportPreviewFactura[] }) {
  return (
    <div className="overflow-x-auto rounded border border-black/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-vialto-mist font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-fire text-left">
            <th className="px-3 py-2 whitespace-nowrap">Tipo</th>
            <th className="px-3 py-2 whitespace-nowrap">Número</th>
            <th className="px-3 py-2 whitespace-nowrap">Nombre</th>
            <th className="px-3 py-2 whitespace-nowrap">Importe</th>
            <th className="px-3 py-2 whitespace-nowrap">Emisión</th>
            <th className="px-3 py-2 whitespace-nowrap">Vencimiento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {facturas.map((f, i) => (
            <tr key={i} className="hover:bg-vialto-mist/50">
              <td className="px-3 py-1.5">
                <span className={['text-[10px] px-1.5 py-0.5 uppercase tracking-wider rounded',
                  f.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
                ].join(' ')}>
                  {f.tipo === 'cliente' ? 'Cliente' : 'Flete'}
                </span>
              </td>
              <Td>{f.numero}</Td>
              <Td>{f.nombre}</Td>
              <td className="px-3 py-1.5 text-vialto-charcoal font-medium">${f.importe.toLocaleString('es-AR')}</td>
              <Td>{f.fechaEmision}</Td>
              <Td>{f.fechaVencimiento}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntidadTable({ entidades }: { entidades: ImportPreviewEntidad[] }) {
  return (
    <div className="rounded border border-black/10 divide-y divide-black/5 max-h-80 overflow-y-auto">
      {entidades.map((e, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-vialto-charcoal">{e.nombre}</span>
          {e.esNuevo
            ? <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 uppercase tracking-wider">Nuevo</span>
            : <span className="text-[10px] px-1.5 py-0.5 bg-vialto-mist text-vialto-steel uppercase tracking-wider">Existente</span>
          }
        </div>
      ))}
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-1.5 text-vialto-charcoal whitespace-nowrap max-w-[140px] truncate">
      {children ?? <span className="text-vialto-steel">—</span>}
    </td>
  );
}

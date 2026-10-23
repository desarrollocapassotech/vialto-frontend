import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { ErrorPieModal } from '@/components/shared/ErrorPieModal';
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { fmtDateUtc } from '@/lib/fmtDateUtc';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';
import { importarAfip, type TipoContraparte } from '@/lib/cuentaCorriente';
import { leerExcelMisComprobantes, type FilaAfip } from '@/lib/afipMisComprobantes';

type Props = {
  /** cliente = ventas (Excel "Emitidos"); proveedor = compras (Excel "Recibidos"). */
  lado: TipoContraparte;
  onClose: () => void;
  /** Después de importar: recargar la cuenta. */
  onImportado: () => void;
};

/** Fila de la vista previa (lo que devuelve el backend + lo descartado al leer el Excel). */
type FilaPreview = {
  fila: number;
  numeroComprobante: string;
  fecha: string;
  cuit: string;
  contraparte: string;
  total: number | null;
  moneda: string;
  importa: boolean;
  motivo?: string;
};

/**
 * Importación masiva de ventas/compras desde el Excel "Mis Comprobantes" de AFIP: se lee en
 * el navegador, el backend resuelve el cliente/proveedor por CUIT y devuelve la vista previa
 * (`simular`), y recién al confirmar crea los movimientos. Ver `lib/afipMisComprobantes.ts`.
 */
export function ImportarAfipModal({ lado, onClose, onImportado }: Props) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const descarte = useConfirmarDescarte(onClose);
  const esVenta = lado === 'cliente';
  const nombre = esVenta ? 'ventas' : 'compras';

  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaAfip[]>([]);
  /** Filas descartadas al leer el Excel (nota de crédito, moneda…): no llegan al backend. */
  const [cantDescartadas, setCantDescartadas] = useState(0);
  const [preview, setPreview] = useState<FilaPreview[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aImportar = preview?.filter((f) => f.importa).length ?? 0;
  const omitidas = (preview?.length ?? 0) - aImportar;

  /** El backend no conoce `total` (solo para mostrar): se manda el resto de la fila. */
  const payload = (lista: FilaAfip[]) => lista.map(({ total: _total, ...f }) => f);

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    setArchivo(file.name);
    setPreview(null);
    setError(null);
    setCargando(true);
    try {
      const lectura = await leerExcelMisComprobantes(file, lado);
      setFilas(lectura.filas);
      setCantDescartadas(lectura.descartadas.length);
      const res =
        lectura.filas.length > 0
          ? await importarAfip(() => getToken(), { lado, simular: true, filas: payload(lectura.filas) })
          : { creados: 0, filas: [] };
      const delBackend: FilaPreview[] = res.filas.map((f) => ({
        fila: f.fila,
        numeroComprobante: f.numeroComprobante,
        fecha: f.fecha,
        cuit: f.cuit,
        contraparte: f.contraparteNombre ?? f.denominacion ?? '—',
        total: f.total,
        moneda: f.moneda,
        importa: f.estado === 'importar',
        motivo: f.motivo,
      }));
      const descartadas: FilaPreview[] = lectura.descartadas.map((d) => ({
        fila: d.fila,
        numeroComprobante: d.numeroComprobante,
        fecha: d.fecha,
        cuit: d.cuit,
        contraparte: d.denominacion ?? '—',
        total: null,
        moneda: '',
        importa: false,
        motivo: d.motivo,
      }));
      setPreview([...delBackend, ...descartadas].sort((a, b) => a.fila - b.fila));
    } catch (err) {
      setError(err instanceof Error && !('status' in err) ? err.message : friendlyError(err, 'cuentaCorriente'));
    } finally {
      setCargando(false);
    }
  }

  async function importar() {
    setImportando(true);
    setError(null);
    try {
      const res = await importarAfip(() => getToken(), { lado, simular: false, filas: payload(filas) });
      const noCreadas = res.filas.filter((f) => f.estado === 'omitido').length + cantDescartadas;
      showToast(
        `${res.creados} ${res.creados === 1 ? (esVenta ? 'venta importada' : 'compra importada') : `${nombre} importadas`}${
          noCreadas > 0 ? ` · ${noCreadas} omitidas` : ''
        }.`,
        'success',
      );
      onImportado();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setImportando(false);
    }
  }

  return (
    <ViewModalShell
      title={`Importar ${nombre} desde AFIP`}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      maxWidthClass="sm:max-w-5xl"
      scrollBody
      footer={
        <>
          <ErrorPieModal error={error} />
          <button type="button" className={viewModalBtnGhost} onClick={descarte.solicitarCierre}>
            Cancelar
          </button>
          <button
            type="button"
            className={viewModalBtnPrimary}
            disabled={!preview || aImportar === 0 || importando}
            onClick={() => void importar()}
          >
            {importando ? 'Importando…' : `Importar ${aImportar > 0 ? aImportar : ''} ${nombre}`.replace(/\s+/g, ' ')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-vialto-steel">
          En AFIP entrá a <strong>Mis Comprobantes</strong> → <strong>{esVenta ? 'Emitidos' : 'Recibidos'}</strong>,
          buscá el período y descargá el Excel. Cada comprobante se carga como {esVenta ? 'venta al cliente' : 'compra al proveedor'}{' '}
          con ese CUIT, con su IVA por alícuota. Los que ya están cargados no se duplican.
        </p>

        <label className="flex cursor-pointer items-center gap-3 border border-dashed border-black/25 bg-vialto-mist/40 px-4 py-3 text-sm hover:bg-vialto-mist">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {cargando ? 'Leyendo el archivo…' : archivo ?? `Elegí el Excel de comprobantes ${esVenta ? 'emitidos' : 'recibidos'} (.xlsx)`}
          </span>
          <span className="shrink-0 text-xs uppercase tracking-wider text-vialto-steel">
            {archivo ? 'Cambiar' : 'Elegir archivo'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={cargando || importando}
            onChange={(e) => {
              void elegirArchivo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        {preview && (
          <>
            <p className="text-sm">
              <strong className="text-emerald-700">{aImportar}</strong> se importan
              {omitidas > 0 && (
                <>
                  {' · '}
                  <strong className="text-vialto-fire">{omitidas}</strong> se omiten
                </>
              )}
              .
            </p>
            {preview.length === 0 ? (
              <p className="text-sm text-vialto-steel">El archivo no tiene comprobantes.</p>
            ) : (
              <div className="overflow-x-auto border border-black/10">
                <table className="w-full text-sm">
                  <thead className="bg-vialto-mist/50 text-left text-[11px] uppercase tracking-wider text-vialto-steel">
                    <tr>
                      <th className="px-3 py-2 font-normal">Comprobante</th>
                      <th className="px-3 py-2 font-normal">Fecha</th>
                      <th className="px-3 py-2 font-normal">{esVenta ? 'Cliente' : 'Proveedor'}</th>
                      <th className="px-3 py-2 text-right font-normal">Total</th>
                      <th className="px-3 py-2 font-normal">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {preview.map((f) => (
                      <tr key={`${f.fila}-${f.numeroComprobante}`} className={f.importa ? '' : 'text-vialto-steel'}>
                        <td className="whitespace-nowrap px-3 py-1.5 font-medium">{f.numeroComprobante}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{f.fecha ? fmtDateUtc(f.fecha) : '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className="block max-w-[16rem] truncate">{f.contraparte}</span>
                          <span className="text-xs text-vialto-steel">CUIT {f.cuit || '—'}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                          {f.total != null ? `$ ${formatCurrencyArFromNumber(f.total)} ${f.moneda}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {f.importa ? (
                            <span className="text-emerald-700">Se importa</span>
                          ) : (
                            <span className="text-vialto-fire">{f.motivo ?? 'Se omite'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </ViewModalShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import type { ImportTemplate } from '@/types/api';

const TEMPLATE_EXAMPLES: Record<string, object> = {
  viajes: {
    sheet: 0,
    headerRow: 1,
    columns: [
      { excelHeader: 'CLIENTE', field: 'clienteId', type: 'lookup', lookupModel: 'clientes', lookupField: 'nombre', required: true, createIfNotFound: true },
      { excelHeader: 'TRANSPORTE', field: 'transportistaId', type: 'lookup', lookupModel: 'transportistas', lookupField: 'nombre', createIfNotFound: true },
      { excelHeader: 'ORIGEN', field: 'origen', type: 'string' },
      { excelHeader: 'DESTINO', field: 'destino', type: 'string' },
      { excelHeader: 'FECHA D/C', field: 'fechaCarga', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'FECHA D/D', field: 'fechaDescarga', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'DETALLE DE CARGA', field: 'detalleCarga', type: 'string' },
      { excelHeader: 'TOTAL A FC CLIENTE', field: 'monto', type: 'number' },
      { excelHeader: 'N DE FACT EXPO', field: 'nroFactura', type: 'string' },
      { excelHeader: 'FECHA EMISION FC', field: 'fechaEmisionFactura', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'FECHA VENC FC', field: 'fechaVencimientoFactura', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'VALOR FLETERO', field: 'precioTransportistaExterno', type: 'number' },
      { excelHeader: 'FC FLETERO', field: 'nroFacturaTransporte', type: 'string' },
      { excelHeader: 'EMISION FLETERO', field: 'fechaEmisionFacturaTransp', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'VENCIMIENTO', field: 'fechaVencimientoFacturaTransp', type: 'date', format: 'DD/MM/YYYY' },
      { excelHeader: 'OBSERVACIONES', field: 'observaciones', type: 'string' },
    ],
  },
  clientes: {
    sheet: 0,
    headerRow: 1,
    columns: [
      { excelHeader: 'Nombre', field: 'nombre', type: 'string', required: true },
      { excelHeader: 'CUIT', field: 'cuit', type: 'string' },
      { excelHeader: 'Email', field: 'email', type: 'string' },
      { excelHeader: 'Teléfono', field: 'telefono', type: 'string' },
      { excelHeader: 'Dirección', field: 'direccion', type: 'string' },
    ],
  },
};

export function getTemplateExample(modulo: string): string {
  const example = TEMPLATE_EXAMPLES[modulo] ?? {
    sheet: 0,
    headerRow: 1,
    columns: [
      { excelHeader: 'Columna Excel', field: 'campoSistema', type: 'string', required: true },
    ],
  };
  return JSON.stringify(example, null, 2);
}

export function useImportTemplates(tenantId: string) {
  const { getToken } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ImportTemplate[]>(
        `/api/importaciones/templates?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar templates');
    } finally {
      setLoading(false);
    }
  }, [tenantId, getToken]);

  useEffect(() => { void load(); }, [load]);

  async function save(modulo: string, nombre: string, configJson: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const config = JSON.parse(configJson) as object;
      await apiJson('/api/importaciones/templates', () => getToken(), {
        method: 'POST',
        body: JSON.stringify({ tenantId, modulo, nombre, config }),
      });
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar template');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { templates, loading, saving, error, save, reload: load };
}

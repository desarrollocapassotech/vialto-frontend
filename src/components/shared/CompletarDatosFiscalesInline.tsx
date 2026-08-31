import { useState } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiJson } from '@/lib/api';
import { validateClienteForm, validateTransportistaForm } from '@/lib/clienteForm';
import {
  condicionTributariaPorPais,
  esPaisSoportado,
  idFiscalPorPais,
  validarIdFiscal,
} from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';
import { friendlyError } from '@/lib/friendlyError';
import type { Cliente, Transportista } from '@/types/api';
import { useFieldConfig } from '@/hooks/useFieldConfig';

type Entidad = 'cliente' | 'transportista';

export interface CompletarDatosFiscalesInitial {
  nombre: string;
  pais: string | null;
  idFiscal: string | null;
  condicionIva: number | null;
  condicionTributaria: string | null;
  /** `direccion` (cliente) o `domicilio` (transportista). */
  direccion: string | null;
}

interface Props {
  entidad: Entidad;
  id: string;
  /** Override de superadmin; si está presente usa las rutas /api/platform/... */
  tenantId?: string;
  initial: CompletarDatosFiscalesInitial;
  getToken: () => Promise<string | null>;
  onSaved: (updated: Cliente | Transportista) => void;
  /** Si se pasa, muestra un botón "Cancelar" (formulario mostrado en un toggle). */
  onCancel?: () => void;
  /** Si es true, ignora la configuración del tenant y hace obligatorios los campos de facturación/AFIP. */
  forceArcaFields?: boolean;
}

const labelClass =
  'font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.08em] text-vialto-steel';

export function CompletarDatosFiscalesInline({
  entidad,
  id,
  tenantId,
  initial,
  getToken,
  onSaved,
  onCancel,
  forceArcaFields,
}: Props) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [pais, setPais] = useState<PaisCodigo | ''>(
    esPaisSoportado(initial.pais ?? '') ? (initial.pais as PaisCodigo) : '',
  );
  const [idFiscal, setIdFiscal] = useState(initial.idFiscal ?? '');
  const [condicionIva, setCondicionIva] = useState<number | null>(initial.condicionIva);
  const [condicionTributaria, setCondicionTributaria] = useState(
    initial.condicionTributaria ?? '',
  );
  const [direccion, setDireccion] = useState(initial.direccion ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formKey = entidad === 'cliente' ? 'edicion_cliente' : 'edicion_transportista';
  const { isVisible } = useFieldConfig(entidad === 'cliente' ? 'clientes' : 'transportistas');
  
  const paisVisible = forceArcaFields || isVisible(formKey, "pais");
  const idFiscalVisible = forceArcaFields || isVisible(formKey, "idFiscal");
  const condicionVisible = forceArcaFields || isVisible(formKey, "condicionIvaTributaria");
  const direccionVisible = forceArcaFields || isVisible(formKey, "direccion");

  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;
  const idFiscalError = fieldErrors.idFiscal ?? errorFiscal;
  const direccionLabel = entidad === 'cliente' ? 'Dirección' : 'Domicilio';
  const entidadLabel = entidad === 'cliente' ? 'cliente' : 'transportista';

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  const redInputClass = "!border-red-400 bg-red-50/50";
  const isNombreMissing = !nombre.trim();
  const isPaisMissing = paisVisible && !pais;
  const isIdFiscalMissing = idFiscalVisible && !idFiscal.trim();
  const isDireccionMissing = direccionVisible && !direccion.trim();
  const isIvaMissing = condicionVisible && pais === 'AR' && condicionIva === null;
  const isTributariaMissing = condicionVisible && pais !== 'AR' && !condicionTributaria.trim();

  async function onSave() {
    const validate = entidad === 'cliente' ? validateClienteForm : validateTransportistaForm;
    const msg = validate(nombre, pais, idFiscal, paisVisible, idFiscalVisible);
    if (msg) {
      const errs: Record<string, string> = {};
      if (!nombre.trim()) errs.nombre = msg;
      else if (paisVisible && !pais) errs.pais = msg;
      else errs.idFiscal = msg;
      setFieldErrors(errs);
      return;
    }
    const errorFiscalCheck = idFiscalVisible && idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;
    if (errorFiscalCheck) {
      setFieldErrors({ idFiscal: errorFiscalCheck });
      return;
    }
    setFieldErrors({});
    setError(null);
    setSaving(true);
    try {
      const base = entidad === 'cliente' ? 'clientes' : 'transportistas';
      const path = tenantId
        ? `/api/platform/${base}/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/${base}/${encodeURIComponent(id)}`;
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        pais,
        idFiscal: idFiscal.trim(),
        condicionIva: pais === 'AR' ? condicionIva : null,
        condicionTributaria:
          pais !== 'AR' ? condicionTributaria.trim() : null,
      };
      if (entidad === 'cliente') body.direccion = direccion.trim();
      else body.domicilio = direccion.trim();
      const updated = await apiJson<Cliente | Transportista>(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved(updated);
    } catch (e) {
      setError(friendlyError(e, entidad === 'cliente' ? 'clientes' : 'transportistas'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-black/10 bg-white px-4 py-4 space-y-3">
      <p className={labelClass}>Completar datos del {entidadLabel}</p>

      <label className="grid gap-1">
        <CrudFieldLabel required>Nombre</CrudFieldLabel>
        <CrudInput
          value={nombre}
          disabled={saving}
          className={isNombreMissing ? redInputClass : undefined}
          error={fieldErrors.nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <CrudFieldError message={fieldErrors.nombre} />
      </label>

      {(paisVisible || idFiscalVisible) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {paisVisible && (
            <label className="grid gap-1">
              <CrudFieldLabel required>País</CrudFieldLabel>
              <PaisUbicacionSelect
                value={pais}
                onChange={handlePaisChange}
                placeholder="Seleccioná un país"
                disabled={saving}
                className={isPaisMissing ? redInputClass : undefined}
              />
              <CrudFieldError message={fieldErrors.pais} />
            </label>
          )}

          {idFiscalVisible && (
            <label className="grid gap-1">
              <CrudFieldLabel required>{idFiscalPorPais(pais).label}</CrudFieldLabel>
              <CrudInput
                value={idFiscal}
                placeholder={idFiscalPorPais(pais).placeholder}
                disabled={saving}
                className={isIdFiscalMissing ? redInputClass : undefined}
                error={idFiscalError || undefined}
                onChange={(e) => setIdFiscal(e.target.value)}
              />
              <CrudFieldError message={idFiscalError} />
            </label>
          )}
        </div>
      )}

      {(condicionVisible || direccionVisible) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {condicionVisible && (
            <label className="grid gap-1">
              <CrudFieldLabel required>{condInfo.label}</CrudFieldLabel>
              {condInfo.type === 'select' ? (
                <CrudSelect
                  value={condicionIva ?? ''}
                  disabled={saving}
                  className={isIvaMissing ? redInputClass : undefined}
                  onChange={(e) =>
                    setCondicionIva(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Seleccioná una opción</option>
                  {condInfo.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </CrudSelect>
              ) : (
                <CrudInput
                  value={condicionTributaria}
                  placeholder={condInfo.placeholder}
                  disabled={saving}
                  className={isTributariaMissing ? redInputClass : undefined}
                  onChange={(e) => setCondicionTributaria(e.target.value)}
                />
              )}
            </label>
          )}

          {direccionVisible && (
            <label className="grid gap-1">
              <CrudFieldLabel required>{direccionLabel}</CrudFieldLabel>
              <CrudInput
                value={direccion}
                disabled={saving}
                className={isDireccionMissing ? redInputClass : undefined}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="h-8 px-3 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={saving || !!errorFiscal}
          onClick={() => void onSave()}
          className="h-8 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </div>
    </div>
  );
}

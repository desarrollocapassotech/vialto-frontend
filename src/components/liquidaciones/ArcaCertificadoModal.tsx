import { useEffect, useState } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { Spinner } from '@/components/ui/Spinner';
import { CUIT_TEST_HOMOLOGACION } from '@/lib/arcaCbteTipo';

const labelClass =
  'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel';

const textareaClass =
  'rounded border border-black/10 bg-white px-3 py-2 text-xs font-mono text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 resize-y';

const maskedBoxClass =
  'flex h-[13rem] flex-col items-center justify-center gap-1.5 rounded border border-black/10 bg-white px-3 py-2 text-center select-none';

export function MaskedPemField({
  id,
  label,
  value,
  onChange,
  configurado,
  editing,
  onEdit,
  saving,
  placeholder,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  configurado?: boolean;
  editing: boolean;
  onEdit: () => void;
  saving: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
          {configurado && (
            <span className="ml-2 normal-case text-green-700">● configurado</span>
          )}
        </label>
        {configurado && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-[10px] uppercase tracking-wider text-vialto-fire hover:underline"
          >
            Editar
          </button>
        )}
      </div>
      {configurado && !editing ? (
        <div className={maskedBoxClass}>
          <span className="font-mono text-xs tracking-widest text-vialto-steel">
            ••••••••••••••••••••••••
          </span>
          <span className="text-[11px] text-vialto-steel">
            Oculto por seguridad. Hacé clic en «Editar» para reemplazarlo.
          </span>
        </div>
      ) : (
        <textarea
          id={id}
          rows={8}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          placeholder={placeholder}
          className={`${textareaClass} disabled:opacity-60`}
        />
      )}
    </div>
  );
}

type AmbientePem = {
  cert: string;
  key: string;
  certConfigurado?: boolean;
  keyConfigurado?: boolean;
};

export function ArcaCertificadoModal({
  ambienteActivo,
  produccion,
  onClose,
  onSave,
}: {
  /** Ambiente actualmente en uso por el tenant (config.ambiente). */
  ambienteActivo: 'homologacion' | 'produccion';
  produccion: AmbientePem;
  onClose: () => void;
  onSave: (values: {
    certPemProduccion: string;
    keyPemProduccion: string;
  }) => Promise<void>;
}) {
  const [certProd, setCertProd] = useState(produccion.cert);
  const [keyProd, setKeyProd] = useState(produccion.key);
  const [editingCertProd, setEditingCertProd] = useState(
    !produccion.certConfigurado,
  );
  const [editingKeyProd, setEditingKeyProd] = useState(
    !produccion.keyConfigurado,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = certProd !== produccion.cert || keyProd !== produccion.key;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, saving]);

  async function handleApply() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        certPemProduccion: certProd,
        keyPemProduccion: keyProd,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar el certificado y la clave.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title="Certificado y clave privada"
      onClose={saving ? () => {} : onClose}
      maxWidthClass="sm:max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${viewModalBtnGhost} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={saving || !dirty}
            className={`inline-flex items-center gap-2 ${viewModalBtnPrimary} disabled:opacity-50`}
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? 'Aplicando…' : dirty ? 'Aplicar cambios' : 'Sin cambios para aplicar'}
          </button>
        </>
      }
    >
      {error && (
        <div
          className="mb-4 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Homologación */}
        <div className="rounded border border-amber-300/70 bg-amber-50/40 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-amber-900">
              Homologación
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900">
              Testing
            </span>
            {ambienteActivo === 'homologacion' && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-vialto-charcoal text-white">
                En uso ahora
              </span>
            )}
          </div>
          <p className="text-xs text-amber-900/90">
            En homologación no hace falta cargar un certificado propio: se usa
            automáticamente el CUIT de prueba de AFIP{' '}
            <span className="font-mono">{CUIT_TEST_HOMOLOGACION}</span>, sin
            certificado, en lugar del CUIT real del emisor. El punto de venta
            también debe ser uno válido para ese CUIT de prueba (usá{' '}
            <span className="font-mono">1</span> si no sabés cuál).
          </p>
        </div>

        {/* Producción */}
        <div className="rounded border border-emerald-300/70 bg-emerald-50/40 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-emerald-900">
              Producción
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-200 text-emerald-900">
              Comprobantes reales
            </span>
            {ambienteActivo === 'produccion' && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-vialto-charcoal text-white">
                En uso ahora
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-emerald-900/90">
            Certificado emitido por AFIP para el CUIT real del emisor. Dejá un
            campo vacío para conservar el valor ya configurado.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MaskedPemField
              id="certPemProduccion"
              label="Certificado digital (.crt / .pem)"
              value={certProd}
              onChange={setCertProd}
              configurado={produccion.certConfigurado}
              editing={editingCertProd}
              onEdit={() => setEditingCertProd(true)}
              saving={saving}
              autoFocus
              placeholder={
                produccion.certConfigurado
                  ? 'Pegá aquí para reemplazar el certificado actual.'
                  : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
              }
            />
            <MaskedPemField
              id="keyPemProduccion"
              label="Clave privada (.key / .pem)"
              value={keyProd}
              onChange={setKeyProd}
              configurado={produccion.keyConfigurado}
              editing={editingKeyProd}
              onEdit={() => setEditingKeyProd(true)}
              saving={saving}
              placeholder={
                produccion.keyConfigurado
                  ? 'Pegá aquí para reemplazar la clave actual.'
                  : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
              }
            />
          </div>
        </div>
      </div>
    </ViewModalShell>
  );
}

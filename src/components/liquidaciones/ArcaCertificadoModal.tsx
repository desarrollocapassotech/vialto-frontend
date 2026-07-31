import { useEffect, useState } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { Spinner } from '@/components/ui/Spinner';

const labelClass =
  'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel';

const textareaClass =
  'rounded border border-black/10 bg-white px-3 py-2 text-xs font-mono text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 resize-y';

const maskedBoxClass =
  'flex h-[15.5rem] flex-col items-center justify-center gap-1.5 rounded border border-black/10 bg-vialto-mist/50 px-3 py-2 text-center select-none';

export function ArcaCertificadoModal({
  certPem,
  keyPem,
  certConfigurado,
  keyConfigurado,
  onClose,
  onSave,
}: {
  certPem: string;
  keyPem: string;
  certConfigurado?: boolean;
  keyConfigurado?: boolean;
  onClose: () => void;
  onSave: (values: { certPem: string; keyPem: string }) => Promise<void>;
}) {
  const [localCert, setLocalCert] = useState(certPem);
  const [localKey, setLocalKey] = useState(keyPem);
  const [editingCert, setEditingCert] = useState(!certConfigurado);
  const [editingKey, setEditingKey] = useState(!keyConfigurado);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = localCert !== certPem || localKey !== keyPem;

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
      await onSave({ certPem: localCert, keyPem: localKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el certificado y la clave.');
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
      <p className="mb-4 text-xs text-vialto-steel">
        Archivos PEM generados en AFIP y vinculados al servicio WSFE. Dejá un campo vacío para
        conservar el valor ya configurado. El certificado y la clave se guardan al aplicar los
        cambios desde acá.
      </p>
      {error && (
        <div
          className="mb-4 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="certPemModal" className={labelClass}>
              Certificado digital (.crt / .pem)
              {certConfigurado && <span className="ml-2 normal-case text-green-700">● configurado</span>}
            </label>
            {certConfigurado && !editingCert && (
              <button
                type="button"
                onClick={() => setEditingCert(true)}
                className="shrink-0 text-[10px] uppercase tracking-wider text-vialto-fire hover:underline"
              >
                Editar
              </button>
            )}
          </div>
          {certConfigurado && !editingCert ? (
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
              id="certPemModal"
              rows={10}
              autoFocus
              value={localCert}
              onChange={(e) => setLocalCert(e.target.value)}
              disabled={saving}
              placeholder={
                certConfigurado
                  ? 'Pegá aquí para reemplazar el certificado actual.'
                  : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
              }
              className={`${textareaClass} disabled:opacity-60`}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="keyPemModal" className={labelClass}>
              Clave privada (.key / .pem)
              {keyConfigurado && <span className="ml-2 normal-case text-green-700">● configurada</span>}
            </label>
            {keyConfigurado && !editingKey && (
              <button
                type="button"
                onClick={() => setEditingKey(true)}
                className="shrink-0 text-[10px] uppercase tracking-wider text-vialto-fire hover:underline"
              >
                Editar
              </button>
            )}
          </div>
          {keyConfigurado && !editingKey ? (
            <div className={maskedBoxClass}>
              <span className="font-mono text-xs tracking-widest text-vialto-steel">
                ••••••••••••••••••••••••
              </span>
              <span className="text-[11px] text-vialto-steel">
                Oculto por seguridad. Hacé clic en «Editar» para reemplazarla.
              </span>
            </div>
          ) : (
            <textarea
              id="keyPemModal"
              rows={10}
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              disabled={saving}
              placeholder={
                keyConfigurado
                  ? 'Pegá aquí para reemplazar la clave actual.'
                  : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
              }
              className={`${textareaClass} disabled:opacity-60`}
            />
          )}
        </div>
      </div>
    </ViewModalShell>
  );
}

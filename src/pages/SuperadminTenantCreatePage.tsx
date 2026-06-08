import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TenantForm, type TenantFormValues } from '@/components/superadmin/TenantForm';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

const INITIAL_VALUES: TenantFormValues = {
  name: '',
  clerkOrgId: '',
  idFiscal: '',
  modules: [],
};

export function SuperadminTenantCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<TenantFormValues>(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit() {
    const name = values.name.trim();
    const hasModules = values.modules.length > 0;

    const errs: Record<string, string> = {};
    if (!name) errs.name = 'Ingresá el nombre de la empresa.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    if (!hasModules) {
      setError('Seleccioná al menos un módulo para crear la empresa.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiJson('/api/tenants', () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          name,
          idFiscal: values.idFiscal.trim() || undefined,
          modules: values.modules,
        }),
      });
      navigate('/superadmin/empresas', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SuperadminOnly>
      <div className="max-w-4xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Crear empresa
        </h1>
        <p className="mt-2 text-vialto-steel">
          Alta de una nueva empresa.
        </p>

        <div className="mt-4">
          <Link className="text-sm text-vialto-fire hover:text-vialto-bright" to="/superadmin/empresas">
            ← Volver a empresas
          </Link>
        </div>

        <TenantForm
          values={values}
          onChange={setValues}
          onSubmit={onSubmit}
          submitLabel="Crear empresa"
          loading={loading}
          showOrgIdInput={false}
          submitAlign="right"
          fieldErrors={fieldErrors}
          formError={error}
        />
      </div>
    </SuperadminOnly>
  );
}

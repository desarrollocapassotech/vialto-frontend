import { labelModulo } from '@/lib/platformLabels';
import { AVAILABLE_MODULES } from '@/lib/moduleCatalog';

export interface TenantFormValues {
  name: string;
  clerkOrgId: string;
  cuit: string;
  modules: string[];
  billingStatus?: 'trial' | 'active' | 'suspended' | 'expired';
  maxUsers?: string;
  billingRenewsAt?: string;
  whiteLabelDomain?: string;
}

interface TenantFormProps {
  values: TenantFormValues;
  onChange: (next: TenantFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading: boolean;
  includeAdvancedFields?: boolean;
  disableOrgId?: boolean;
  showOrgIdInput?: boolean;
  submitAlign?: 'left' | 'right';
}

export function TenantForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  loading,
  includeAdvancedFields = false,
  disableOrgId = false,
  showOrgIdInput = true,
  submitAlign = 'left',
}: TenantFormProps) {
  const toggleModule = (moduleCode: string) => {
    const exists = values.modules.includes(moduleCode);
    const modules = exists
      ? values.modules.filter((m) => m !== moduleCode)
      : [...values.modules, moduleCode];
    onChange({ ...values, modules });
  };

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-vialto-steel">
            Nombre de empresa *
          </span>
          <input
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            required
            className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
          />
        </label>
        {showOrgIdInput && (
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-vialto-steel">
              Org ID de Clerk *
            </span>
            <input
              value={values.clerkOrgId}
              onChange={(e) => onChange({ ...values, clerkOrgId: e.target.value })}
              required
              disabled={disableOrgId}
              className="h-10 w-full border border-black/15 bg-white px-3 text-sm disabled:bg-black/5"
            />
          </label>
        )}
      </div>

      <div>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-vialto-steel">
            CUIT
          </span>
          <input
            value={values.cuit}
            onChange={(e) => onChange({ ...values, cuit: e.target.value })}
            placeholder="Solo números"
            className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
          />
        </label>
      </div>

      <fieldset className="border border-black/10 bg-white p-4">
        <legend className="px-1 text-xs uppercase tracking-wider text-vialto-steel">
          Módulos contratados
        </legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_MODULES.map((moduleCode) => (
            <label key={moduleCode} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.modules.includes(moduleCode)}
                onChange={() => toggleModule(moduleCode)}
              />
              <span>{labelModulo(moduleCode)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {includeAdvancedFields && (
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-vialto-steel">
              Suscripción
            </span>
            <select
              value={values.billingStatus ?? 'trial'}
              onChange={(e) =>
                onChange({
                  ...values,
                  billingStatus: e.target.value as NonNullable<
                    TenantFormValues['billingStatus']
                  >,
                })
              }
              className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
            >
              <option value="trial">En prueba</option>
              <option value="active">Al día</option>
              <option value="suspended">Suspendido</option>
              <option value="expired">Vencido</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-vialto-steel">
              Máx. usuarios
            </span>
            <input
              type="number"
              min={1}
              value={values.maxUsers ?? ''}
              onChange={(e) => onChange({ ...values, maxUsers: e.target.value })}
              className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-vialto-steel">
              Renovación
            </span>
            <input
              type="date"
              value={values.billingRenewsAt ?? ''}
              onChange={(e) =>
                onChange({ ...values, billingRenewsAt: e.target.value })
              }
              className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-3">
            <span className="text-xs uppercase tracking-wider text-vialto-steel">
              Dominio white-label
            </span>
            <input
              value={values.whiteLabelDomain ?? ''}
              onChange={(e) =>
                onChange({ ...values, whiteLabelDomain: e.target.value })
              }
              className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
            />
          </label>
        </div>
      )}

      <div className={submitAlign === 'right' ? 'flex justify-end' : ''}>
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

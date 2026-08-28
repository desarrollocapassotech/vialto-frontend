import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { labelModulo } from '@/lib/platformLabels';
import { AVAILABLE_MODULES } from '@/lib/moduleCatalog';

export interface TenantFormValues {
  name: string;
  clerkOrgId: string;
  idFiscal: string;
  modules: string[];
  billingStatus?: 'trial' | 'active' | 'suspended' | 'expired';
  maxUsers?: string;
  billingRenewsAt?: string;
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
  fieldErrors?: Record<string, string>;
  formError?: string | null;
}

const sectionTitleClass =
  "font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-vialto-charcoal";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-black/10 bg-white p-5 sm:p-6">
      <h2 className={sectionTitleClass}>{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-vialto-steel">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
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
  fieldErrors = {},
  formError,
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
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <SectionCard title="Datos de la empresa">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <CrudFieldLabel required>Nombre de empresa</CrudFieldLabel>
            <CrudInput
              value={values.name}
              onChange={(e) => onChange({ ...values, name: e.target.value })}
              error={fieldErrors.name}
            />
            <CrudFieldError message={fieldErrors.name} />
          </label>
          {showOrgIdInput && (
            <label className="flex flex-col gap-1.5">
              <CrudFieldLabel required>Org ID de Clerk</CrudFieldLabel>
              <CrudInput
                value={values.clerkOrgId}
                onChange={(e) =>
                  onChange({ ...values, clerkOrgId: e.target.value })
                }
                disabled={disableOrgId}
                className="disabled:bg-black/5"
                error={fieldErrors.clerkOrgId}
              />
              <CrudFieldError message={fieldErrors.clerkOrgId} />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <CrudFieldLabel>ID Fiscal</CrudFieldLabel>
            <CrudInput
              value={values.idFiscal}
              onChange={(e) =>
                onChange({ ...values, idFiscal: e.target.value })
              }
              placeholder="Solo números"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Módulos contratados"
        description="Define qué secciones ve la empresa en el menú y qué endpoints puede usar."
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {AVAILABLE_MODULES.map((moduleCode) => {
            const checked = values.modules.includes(moduleCode);
            return (
              <label
                key={moduleCode}
                className={`flex items-center gap-2.5 rounded border px-3 py-2.5 text-sm transition-colors ${
                  checked
                    ? "border-vialto-fire/50 bg-vialto-fire/5 text-vialto-charcoal"
                    : "border-black/10 text-vialto-steel hover:border-black/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(moduleCode)}
                  className="h-4 w-4 shrink-0 accent-vialto-fire"
                />
                <span>{labelModulo(moduleCode)}</span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      {includeAdvancedFields && (
        <SectionCard title="Suscripción">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <CrudFieldLabel>Estado</CrudFieldLabel>
              <CrudSelect
                value={values.billingStatus ?? 'trial'}
                onChange={(e) =>
                  onChange({
                    ...values,
                    billingStatus: e.target.value as NonNullable<
                      TenantFormValues['billingStatus']
                    >,
                  })
                }
              >
                <option value="trial">En prueba</option>
                <option value="active">Al día</option>
                <option value="suspended">Suspendido</option>
                <option value="expired">Vencido</option>
              </CrudSelect>
            </label>
            <label className="flex flex-col gap-1.5">
              <CrudFieldLabel>Máx. usuarios</CrudFieldLabel>
              <CrudInput
                type="number"
                min={1}
                value={values.maxUsers ?? ''}
                onChange={(e) =>
                  onChange({ ...values, maxUsers: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <CrudFieldLabel>Renovación</CrudFieldLabel>
              <CrudInput
                type="date"
                value={values.billingRenewsAt ?? ''}
                onChange={(e) =>
                  onChange({ ...values, billingRenewsAt: e.target.value })
                }
              />
            </label>
          </div>
        </SectionCard>
      )}

      <CrudFormErrorAlert message={formError} />
      <CrudSubmitButton loading={loading} label={submitLabel} />
    </form>
  );
}

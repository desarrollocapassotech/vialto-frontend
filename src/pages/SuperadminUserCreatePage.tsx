import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Miembro' },
] as const;

export function SuperadminUserCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<(typeof ROLES)[number]['value']>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!tenantId) {
      setError('Seleccioná una empresa antes de crear usuarios.');
      return;
    }
    if (!name.trim()) {
      setError('Ingresá el nombre del usuario.');
      return;
    }
    if (!email.trim()) {
      setError('Ingresá un email.');
      return;
    }
    if (!password.trim()) {
      setError('Ingresá una contraseña.');
      return;
    }
    if (password.trim().length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiJson(
        `/api/platform/users/invite?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password: password.trim(),
            role,
          }),
        },
      );
      navigate(`/superadmin/usuarios?tenantId=${encodeURIComponent(tenantId)}`, {
        replace: true,
      });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SuperadminOnly>
      <CrudPageLayout
        title="Crear usuario"
        backTo={`/superadmin/usuarios${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`}
        backLabel="← Volver a usuarios"
        error={error}
      >
        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="grid gap-1.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Nombre
            </span>
            <CrudInput
              value={name}
              placeholder="Ej: Juan Perez"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Email
            </span>
            <CrudInput
              type="email"
              value={email}
              placeholder="usuario@empresa.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Rol
            </span>
            <CrudSelect value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number]['value'])}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </CrudSelect>
          </label>
          <label className="grid gap-1.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Contraseña inicial
            </span>
            <div className="relative">
              <CrudInput
                type={showPassword ? 'text' : 'password'}
                value={password}
                placeholder="Mínimo 8 caracteres"
                className="w-full pr-24"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>
          <CrudSubmitButton loading={loading} label="Crear usuario" />
        </form>
      </CrudPageLayout>
    </SuperadminOnly>
  );
}

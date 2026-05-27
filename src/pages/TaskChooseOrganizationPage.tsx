import { useOrganizationList, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function TaskChooseOrganizationPage() {
  const { isLoaded, userMemberships, userInvitations, setActive } = useOrganizationList({
    userMemberships: true,
    userInvitations: true,
  });
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    navigate('/sign-in', { replace: true });
  }

  async function handleSelectOrg(orgId: string) {
    setLoading(true);
    setError(null);
    try {
      await setActive!({ organization: orgId });
      navigate('/', { replace: true });
    } catch {
      setError('No se pudo seleccionar la empresa. Intentá de nuevo.');
      setLoading(false);
    }
  }

  async function handleAcceptInvitation(inv: any) {
    setLoading(true);
    setError(null);
    try {
      await inv.accept();
      await setActive!({ organization: inv.publicOrganizationData.id });
      navigate('/', { replace: true });
    } catch {
      setError('No se pudo aceptar la invitación. Intentá de nuevo.');
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal">
        <p className="text-white/60 text-sm">Cargando…</p>
      </div>
    );
  }

  const memberships = userMemberships?.data ?? [];
  const invitations = userInvitations?.data ?? [];
  const hasOptions = memberships.length > 0 || invitations.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
      <div className="w-full max-w-md bg-vialto-graphite border border-white/10 shadow-xl p-6">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-white">
          Seleccionar empresa
        </h1>

        {hasOptions ? (
          <div className="mt-6 space-y-2">
            {memberships.map((m: any) => (
              <button
                key={m.organization.id}
                onClick={() => handleSelectOrg(m.organization.id)}
                disabled={loading}
                className="w-full text-left px-4 py-3 border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 text-white transition-colors disabled:opacity-60"
              >
                <p className="text-sm font-medium">{m.organization.name}</p>
                <p className="text-xs text-white/45 mt-0.5 uppercase tracking-wider">Miembro</p>
              </button>
            ))}

            {invitations.map((inv: any) => (
              <button
                key={inv.id}
                onClick={() => handleAcceptInvitation(inv)}
                disabled={loading}
                className="w-full text-left px-4 py-3 border border-vialto-fire/40 bg-vialto-fire/5 hover:bg-vialto-fire/10 text-white transition-colors disabled:opacity-60"
              >
                <p className="text-sm font-medium">{inv.publicOrganizationData?.name}</p>
                <p className="text-xs text-vialto-fire mt-0.5 uppercase tracking-wider">Invitación pendiente · Aceptar</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-white/70 text-sm leading-relaxed">
              Tu usuario no tiene ninguna empresa asignada en el sistema.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              Comunicate con el administrador de Vialto para que te asigne la empresa correspondiente.
            </p>
            <a
              href="mailto:vialto.logistica@gmail.com?subject=Solicitud%20de%20acceso%20a%20empresa&body=Hola%2C%20necesito%20que%20me%20asignen%20una%20empresa%20en%20Vialto."
              className="mt-2 inline-block w-full h-10 bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider text-white leading-10"
            >
              Enviar email al administrador
            </a>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-200 bg-red-900/30 border border-red-700/50 px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-5 w-full text-center text-sm text-white/45 hover:text-white/70"
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}

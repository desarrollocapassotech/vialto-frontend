import { useOrganization, useOrganizationList, useUser } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';

/**
 * Asegura que usuarios de tenant (admin / member / stock_viewer / stock_operator) tengan
 * activa la organización de su cuenta. Sin esto, el JWT no trae `org_id`
 * y el inventario / stock queda vacío (sin datos de la empresa).
 */
export function useEnsureTenantOrganization() {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { isLoaded: listLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const activatingRef = useRef(false);

  useEffect(() => {
    if (!userLoaded || !orgLoaded || !listLoaded) return;
    if (!setActive) return;
    if (organization?.id) return;
    if (isPlatformSuperadmin(user?.publicMetadata)) return;
    if (activatingRef.current) return;

    const memberships = userMemberships?.data ?? [];
    if (memberships.length === 0) return;

    const metaTenantId =
      typeof user?.publicMetadata?.tenantId === 'string'
        ? user.publicMetadata.tenantId.trim()
        : '';

    const fromMeta = metaTenantId
      ? memberships.find((m) => m.organization.id === metaTenantId)
      : undefined;

    const target =
      fromMeta?.organization.id ??
      (memberships.length === 1 ? memberships[0]?.organization.id : undefined);

    if (!target) return;

    activatingRef.current = true;
    void setActive({ organization: target }).finally(() => {
      activatingRef.current = false;
    });
  }, [
    userLoaded,
    orgLoaded,
    listLoaded,
    organization?.id,
    setActive,
    user?.publicMetadata,
    userMemberships?.data,
  ]);
}

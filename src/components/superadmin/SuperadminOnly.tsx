import { useUser } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isPlatformSuperadmin } from '@/lib/roleLabels';

interface SuperadminOnlyProps {
  children: ReactNode;
}

export function SuperadminOnly({ children }: SuperadminOnlyProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (!isPlatformSuperadmin(user?.publicMetadata)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

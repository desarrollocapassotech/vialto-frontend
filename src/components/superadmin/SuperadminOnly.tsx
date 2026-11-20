import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isPlatformSuperadmin } from "@/lib/roleLabels";

interface SuperadminOnlyProps {
  children: ReactNode;
}

export function SuperadminOnly({ children }: SuperadminOnlyProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Verificando permisos…" />
    );
  }

  if (!isPlatformSuperadmin(user?.publicMetadata)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

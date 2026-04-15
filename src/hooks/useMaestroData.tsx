import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import type { Cliente, Chofer, Transportista, Vehiculo } from '@/types/api';

type MaestroDataContextValue = {
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
  loading: boolean;
  refreshClientes: () => Promise<Cliente[]>;
  refreshChoferes: () => Promise<Chofer[]>;
  refreshTransportistas: () => Promise<Transportista[]>;
  refreshVehiculos: () => Promise<Vehiculo[]>;
};

const MaestroDataContext = createContext<MaestroDataContextValue | null>(null);

export function MaestroDataProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [c, ch, t, v] = await Promise.all([
          apiJson<Cliente[]>('/api/clientes', () => getTokenRef.current()),
          apiJson<Chofer[]>('/api/choferes', () => getTokenRef.current()),
          apiJson<Transportista[]>('/api/transportistas', () => getTokenRef.current()),
          apiJson<Vehiculo[]>('/api/vehiculos', () => getTokenRef.current()),
        ]);
        if (!cancelled) {
          setClientes(c);
          setChoferes(ch);
          setTransportistas(t);
          setVehiculos(v);
        }
      } catch { /* silencioso — las páginas muestran listas vacías */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, orgId]);

  const refreshClientes = async (): Promise<Cliente[]> => {
    const data = await apiJson<Cliente[]>('/api/clientes', () => getTokenRef.current());
    setClientes(data);
    return data;
  };

  const refreshChoferes = async (): Promise<Chofer[]> => {
    const data = await apiJson<Chofer[]>('/api/choferes', () => getTokenRef.current());
    setChoferes(data);
    return data;
  };

  const refreshTransportistas = async (): Promise<Transportista[]> => {
    const data = await apiJson<Transportista[]>('/api/transportistas', () => getTokenRef.current());
    setTransportistas(data);
    return data;
  };

  const refreshVehiculos = async (): Promise<Vehiculo[]> => {
    const data = await apiJson<Vehiculo[]>('/api/vehiculos', () => getTokenRef.current());
    setVehiculos(data);
    return data;
  };

  return (
    <MaestroDataContext.Provider
      value={{ clientes, choferes, transportistas, vehiculos, loading, refreshClientes, refreshChoferes, refreshTransportistas, refreshVehiculos }}
    >
      {children}
    </MaestroDataContext.Provider>
  );
}

export function useMaestroData(): MaestroDataContextValue {
  const ctx = useContext(MaestroDataContext);
  if (!ctx) throw new Error('useMaestroData debe usarse dentro de MaestroDataProvider');
  return ctx;
}

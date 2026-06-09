import { useMemo, useState } from 'react';

interface FiltrableRow {
  pais?: string | null;
  nombre: string;
  idFiscal?: string | null;
  paut?: string | null;
}

export function useListadoFiltros<T extends FiltrableRow>(rows: T[] | null) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroPais, setFiltroPais] = useState('');

  const paisesList = useMemo(() => {
    if (!rows) return [];
    const set = new Set(rows.map((t) => t.pais).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [rows]);

  const rowsFiltradas = useMemo(() => {
    if (!rows) return null;
    const q = busqueda.trim().toLowerCase();
    return rows.filter((t) => {
      const matchBusqueda =
        !q ||
        t.nombre.toLowerCase().includes(q) ||
        (t.idFiscal ?? '').toLowerCase().includes(q) ||
        (t.paut ?? '').toLowerCase().includes(q);
      const matchPais = !filtroPais || t.pais === filtroPais;
      return matchBusqueda && matchPais;
    });
  }, [rows, busqueda, filtroPais]);

  const onClear = () => {
    setBusqueda('');
    setFiltroPais('');
  };

  const activeFilterCount = (busqueda ? 1 : 0) + (filtroPais ? 1 : 0);

  return { busqueda, setBusqueda, filtroPais, setFiltroPais, paisesList, rowsFiltradas, onClear, activeFilterCount };
}
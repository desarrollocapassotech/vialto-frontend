import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { labelVehiculoTipo } from "@/lib/labels";
import type { Vehiculo } from "@/types/api";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtNum(n: number) {
  return n.toLocaleString("es-AR");
}

function vehiculoDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/vehiculos/${encodeURIComponent(id)}`;
}

export function VehiculoViewModal({
  vehiculoId,
  patenteTitulo,
  tenantId,
  onClose,
  editTo,
}: {
  vehiculoId: string;
  patenteTitulo?: string;
  tenantId?: string;
  onClose: () => void;
  editTo?: string; // <-- 1. Ahora es opcional para poder ocultar el botón en modo lectura
}) {
  const { getToken } = useAuth();
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimoKmCombustible, setUltimoKmCombustible] = useState<number | null>(
    null,
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const row = await apiJson<Vehiculo>(
          vehiculoDetailUrl(vehiculoId, tenantId),
          () => getToken(),
        );
        if (!cancelled) {
          setVehiculo(row);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setVehiculo(null);
          setError(friendlyError(e, "vehiculos"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, vehiculoId, tenantId]);

  // Si el vehículo nunca tuvo kmActual seteado (0), mostramos el km de su
  // última carga de combustible como referencia. Solo en contexto tenant —
  // no hay endpoint de plataforma para combustible cross-tenant — y sin
  // romper la vista si ese tenant no tiene el módulo habilitado.
  useEffect(() => {
    setUltimoKmCombustible(null);
    if (!vehiculo || vehiculo.kmActual !== 0 || tenantId?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<{ cargas: { km: number }[] }>(
          `/api/combustible?vehiculoId=${encodeURIComponent(vehiculoId)}&limit=1`,
          () => getToken(),
        );
        if (!cancelled && data.cargas.length > 0) {
          setUltimoKmCombustible(data.cargas[0].km);
        }
      } catch {
        // silencioso: módulo combustible deshabilitado u otro error — se mantiene el 0
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehiculo, vehiculoId, tenantId, getToken]);

  const titulo = vehiculo?.patente ?? patenteTitulo ?? "Vehículo";
  const anio = vehiculo ? (vehiculo.año ?? vehiculo.anio) : null;
  const kmActualEsFallback =
    vehiculo?.kmActual === 0 && ultimoKmCombustible != null;
  const kmActualMostrado = kmActualEsFallback
    ? ultimoKmCombustible
    : vehiculo?.kmActual;

  return (
    <ViewModalShell
      title={titulo}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {/* 2. Solo mostramos el botón Editar si nos pasaron editTo */}
          {editTo && (
            <Link to={editTo} className={viewModalBtnPrimary}>
              Editar
            </Link>
          )}
        </>
      }
    >
      {loading && (
        <p className="text-sm text-vialto-steel">Cargando detalle…</p>
      )}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {!loading && vehiculo && (
        <div className={viewModalGridClass}>
          {[
            { label: "Patente", value: vehiculo.patente },
            { label: "Tipo", value: labelVehiculoTipo(vehiculo.tipo) },
            { label: "Marca", value: vehiculo.marca },
            { label: "Modelo", value: vehiculo.modelo },
            { label: "Año", value: anio },
          ]
            .filter((c) => c.value != null && c.value !== "")
            .map((c) => (
              <div key={c.label}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  {c.label}
                </p>
                <p className="mt-1 text-sm">{c.value}</p>
              </div>
            ))}
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Kilometraje actual
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              {kmActualMostrado != null ? fmtNum(kmActualMostrado) : "—"}
              {kmActualEsFallback && (
                <span className="text-[11px] font-normal italic text-vialto-steel">
                  (según última carga de combustible)
                </span>
              )}
            </p>
          </div>
          {[
            { label: "N.° Chasis", value: vehiculo.nroChasis },
            { label: "Póliza", value: vehiculo.poliza },
            {
              label: "Vto. Póliza",
              value: vehiculo.vencimientoPoliza
                ? fmtDate(vehiculo.vencimientoPoliza)
                : null,
            },
            {
              label: "Tara (kg)",
              value: vehiculo.tara != null ? fmtNum(vehiculo.tara) : null,
            },
            { label: "Precinto", value: vehiculo.precinto },
            { label: "Alta", value: fmtDate(vehiculo.createdAt) },
          ]
            .filter((c) => c.value != null && c.value !== "")
            .map((c) => (
              <div key={c.label}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  {c.label}
                </p>
                <p className="mt-1 text-sm">{c.value}</p>
              </div>
            ))}
        </div>
      )}
    </ViewModalShell>
  );
}

import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState, useCallback } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { CargaCombustible } from "@/types/api";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { CargaCombustibleEditModal } from "./CargaCombustibleEditModal";

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

export function CargaCombustibleViewModal({
  cargaId,
  onClose,
}: {
  cargaId: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();

  // Tipamos la carga para admitir los IDs en caso de que el backend no envíe los objetos poblados
  const [carga, setCarga] = useState<
    | (CargaCombustible & {
        choferId?: string | null;
        vehiculoId?: string | null;
        chofer?: { id?: string; nombre: string } | null;
        vehiculo?: { id?: string; patente: string } | null;
      })
    | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Estados para cruzar los datos si el backend no los trae poblados
  const [choferes, setChoferes] = useState<{ id: string; nombre: string }[]>(
    [],
  );
  const [vehiculos, setVehiculos] = useState<{ id: string; patente: string }[]>(
    [],
  );

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      setError(null);
      try {
        // Ejecutamos en paralelo la carga del detalle y los catálogos de choferes y vehículos
        const [row, ch, ve] = await Promise.all([
          apiJson<CargaCombustible>(
            `/api/combustible/${encodeURIComponent(cargaId)}`,
            () => getToken(),
          ),
          apiJson<{ id: string; nombre: string }[]>("/api/choferes", () =>
            getToken(),
          ).catch(() => []),
          apiJson<{ id: string; patente: string }[]>("/api/vehiculos", () =>
            getToken(),
          ).catch(() => []),
        ]);

        setCarga(row);
        setChoferes(ch);
        setVehiculos(ve);
      } catch (e) {
        setCarga(null);
        setError(friendlyError(e, "combustible"));
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [cargaId, getToken],
  );

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) loadData();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (isEditing) return;

    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, isEditing]);

  if (isEditing && carga) {
    return (
      <CargaCombustibleEditModal
        carga={carga}
        onClose={() => setIsEditing(false)}
        onSaved={() => {
          setIsEditing(false);
          loadData(true);
        }}
      />
    );
  }

  // Lógica para resolver el nombre:
  // 1. Si el backend mandó carga.chofer.nombre lo usamos.
  // 2. Si mandó carga.choferId, lo buscamos en el listado local de choferes.
  // 3. Sino, devolvemos el guion.
  const choferNombre =
    carga?.chofer?.nombre ??
    choferes.find((c) => c.id === carga?.choferId)?.nombre ??
    "—";

  const vehiculoPatente =
    carga?.vehiculo?.patente ??
    vehiculos.find((v) => v.id === carga?.vehiculoId)?.patente ??
    "—";

  return (
    <ViewModalShell
      title="Detalle de Carga de Combustible"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={loading || !carga}
            className={viewModalBtnPrimary}
          >
            Editar
          </button>
        </div>
      }
    >
      {loading && (
        <p className="text-sm text-vialto-steel">Cargando detalle…</p>
      )}
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {!loading && carga && (
        <div className="space-y-6">
          <div className={viewModalGridClass}>
            {[
              { label: "Fecha", value: fmtDate(carga.fecha) },
              { label: "Conductor", value: choferNombre }, // Usamos la variable resuelta
              { label: "Vehículo", value: vehiculoPatente }, // Usamos la variable resuelta
              { label: "Estación de servicio", value: carga.estacion },
              { label: "Litros", value: `${fmtNum(carga.litros)} L` },
              {
                label: "Precio/L",
                value:
                  carga.precioPorLitro != null
                    ? `$${fmtNum(carga.precioPorLitro)}`
                    : "—",
              },
              { label: "Monto Total", value: `$${fmtNum(carga.importe)}` },
              { label: "Kilometraje", value: `${fmtNum(carga.km)} km` },
              { label: "Forma de pago", value: carga.formaPago ?? "—" },
              { label: "Registrado el", value: fmtDate(carga.createdAt) },
            ].map((c, i) => (
              <div key={i}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  {c.label}
                </p>
                <p className="mt-1 text-sm font-medium text-vialto-charcoal">
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 pt-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-vialto-charcoal">
              Documentación respaldatoria (Fotos)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Fotos del Tacómetro */}
              <div className="flex flex-col border border-black/10 rounded p-4 bg-vialto-mist/20">
                <span className="text-xs uppercase tracking-wider text-vialto-steel mb-2">
                  Foto del Tacómetro
                </span>
                {carga.fotoTacometro ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(carga.fotoTacometro!)}
                    className="group relative aspect-video w-full overflow-hidden border border-black/15 bg-white hover:border-vialto-fire/40 transition-colors"
                  >
                    <img
                      src={carga.fotoTacometro}
                      alt="Foto del Tacómetro"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs uppercase tracking-wider font-medium">
                        Ampliar foto
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex flex-1 items-center justify-center aspect-video border border-dashed border-black/15 bg-white text-xs text-vialto-steel">
                    Sin foto de tacómetro registrada
                  </div>
                )}
              </div>

              {/* Fotos del Ticket */}
              <div className="flex flex-col border border-black/10 rounded p-4 bg-vialto-mist/20">
                <span className="text-xs uppercase tracking-wider text-vialto-steel mb-2">
                  Foto del Ticket
                </span>
                {carga.fotoTicket ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(carga.fotoTicket!)}
                    className="group relative aspect-video w-full overflow-hidden border border-black/15 bg-white hover:border-vialto-fire/40 transition-colors"
                  >
                    <img
                      src={carga.fotoTicket}
                      alt="Foto del Ticket"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs uppercase tracking-wider font-medium">
                        Ampliar foto
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex flex-1 items-center justify-center aspect-video border border-dashed border-black/15 bg-white text-xs text-vialto-steel">
                    Sin foto de ticket registrada
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <AdjuntoPreviewModal
          url={previewUrl}
          title={
            previewUrl === carga?.fotoTacometro
              ? "Foto del Tacómetro"
              : "Foto del Ticket"
          }
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </ViewModalShell>
  );
}

import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  FORMA_PAGO_LABELS,
  SERVICE_STATIONS,
  fmtTipoVehiculo,
} from "@/lib/combustibleLabels";
import type { CargaCombustible } from "@/types/api";

function fmtVehiculoLabel(v: {
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}): string {
  const tipo = fmtTipoVehiculo(v.tipo);
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  const detalle = [tipo, marcaModelo].filter(Boolean).join(" · ");
  return detalle ? `${v.patente} — ${detalle}` : v.patente;
}

// Utilidad para normalizar texto (quita tildes y pasa a minúsculas)
const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (name: string, value: string) => void;
  name: string;
  placeholder: string;
}

function SearchableSelect({
  options,
  value,
  onChange,
  name,
  placeholder,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm(""); // Reseteamos la búsqueda al cerrar
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrado reactivo de opciones
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const normalizedSearch = normalizeText(searchTerm);
    return options.filter((opt) =>
      normalizeText(opt.label).includes(normalizedSearch),
    );
  }, [options, searchTerm]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className="h-9 w-full border border-black/15 bg-white px-2 flex items-center justify-between cursor-pointer text-sm focus-within:border-vialto-fire"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className={
            selectedOption && selectedOption.value !== ""
              ? "text-vialto-charcoal"
              : "text-gray-500"
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-gray-400 text-xs">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full border border-black/15 bg-white shadow-xl">
          <div className="p-1 border-b border-black/10">
            <input
              type="text"
              className="w-full bg-gray-50 border border-black/10 px-2 py-1.5 text-sm focus:outline-none focus:border-vialto-fire focus:bg-white"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-vialto-fire hover:text-white ${
                    value === opt.value
                      ? "bg-vialto-mist text-vialto-charcoal font-medium"
                      : "text-vialto-charcoal"
                  }`}
                  onClick={() => {
                    onChange(name, opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {opt.label}
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-gray-500 italic">
                No se encontraron resultados
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

type VehiculoOpt = {
  id: string;
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
};
type ChoferOpt = { id: string; nombre: string };

interface Props {
  vehiculos: VehiculoOpt[];
  choferes: ChoferOpt[];
  tenantId?: string;
  /**
   * Última carga registrada por vehículo (lookup por vehiculoId).
   * Se usa para validar que el km ingresado no sea inferior al último.
   */
  cargasPorVehiculo?: Record<string, { km: number; fecha: string }[]>;
  onClose: () => void;
  onSuccess: (nuevaCarga: CargaCombustible) => void;
}

export function CargaCombustibleCreateModal({
  tenantId,
  vehiculos,
  choferes,
  cargasPorVehiculo = {},
  onClose,
  onSuccess,
}: Props) {
  const { getToken } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    vehiculoId: "",
    choferId: "",
    estacion: "",
    litros: "",
    precioPorLitro: "",
    importe: "",
    km: "",
    formaPago: "",
  });

  // Coherencia importe ≈ litros × precioPorLitro (1% de tolerancia).
  const importeError = useMemo(() => {
    const litros = Number(formData.litros);
    const precio = Number(formData.precioPorLitro);
    const importe = Number(formData.importe);
    if (!litros || !precio || !importe) return null;
    const esperado = litros * precio;
    const diff = Math.abs(importe - esperado);
    if (diff > esperado * 0.01) {
      return `El monto no coincide con litros × precio (esperado ≈ $${esperado.toLocaleString(
        "es-AR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}).`;
    }
    return null;
  }, [formData.litros, formData.precioPorLitro, formData.importe]);

  // Validación del kilometraje en tiempo real:
  // 1) solo números/puntos, 2) no inferior al de la última carga del vehículo.
  const kmError = useMemo(() => {
    if (!formData.km) return null;

    if (!/^[\d.]+$/.test(formData.km)) {
      return "El kilometraje solo puede contener números.";
    }

    const kmSanitizado = parseInt(formData.km.replace(/\./g, ""), 10);
    if (isNaN(kmSanitizado)) {
      return "El kilometraje ingresado no es válido.";
    }

    const historial = formData.vehiculoId
      ? (cargasPorVehiculo[formData.vehiculoId] ?? [])
      : [];
    const nuevaFecha = formData.fecha; // "YYYY-MM-DD"
    const fmt = (iso: string) =>
      iso.slice(0, 10).split("-").reverse().join("/");

    // Carga anterior o del mismo día (fecha <= la nueva): actúa como piso.
    const anterior = historial
      .filter((c) => c.fecha.slice(0, 10) <= nuevaFecha)
      .pop();
    if (anterior && kmSanitizado < anterior.km) {
      return `El kilometraje ingresado (${kmSanitizado} km) es inconsistente: no puede ser inferior al de la carga anterior registrada el ${fmt(anterior.fecha)} (${anterior.km} km).`;
    }

    // Carga posterior (fecha estrictamente mayor): actúa como techo.
    const posterior = historial.find((c) => c.fecha.slice(0, 10) > nuevaFecha);
    if (posterior && kmSanitizado > posterior.km) {
      return `El kilometraje ingresado (${kmSanitizado} km) es inconsistente: no puede ser superior al de la carga posterior registrada el ${fmt(posterior.fecha)} (${posterior.km} km).`;
    }

    return null;
  }, [formData.km, formData.vehiculoId, formData.fecha, cargasPorVehiculo]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Red de seguridad: no enviar si hay errores de validación en pantalla.
    if (importeError || kmError) {
      showToast("Revisá los datos antes de guardar", "error");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const kmSanitizado = parseInt(formData.km.replace(/\./g, ""), 10);

      if (isNaN(kmSanitizado)) {
        throw new Error("El kilometraje ingresado no es válido.");
      }

      const payload = {
        ...formData,
        choferId: formData.choferId || null,
        litros: Number(formData.litros),
        precioPorLitro: Number(formData.precioPorLitro),
        importe: Number(formData.importe),
        km: kmSanitizado,
      };

      const apiBase = tenantId ? "/api/platform" : "/api";
      let endpoint = `${apiBase}/combustible`;

      if (tenantId) {
        endpoint += `?tenantId=${encodeURIComponent(tenantId || "")}`;
      }

      const nuevaCarga = await apiJson<CargaCombustible>(
        endpoint,
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      showToast("Carga registrada exitosamente", "success");
      onSuccess(nuevaCarga);
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo registrar la carga", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:border-vialto-fire";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-vialto-steel mb-1";

  // Preparamos las opciones para los SearchableSelects basados en los props
  const vehiculosOptions = useMemo(() => {
    return vehiculos.map((v) => ({
      value: v.id,
      label: fmtVehiculoLabel(v),
    }));
  }, [vehiculos]);

  const choferesOptions = useMemo(() => {
    return [
      { value: "", label: "Sin conductor asignado" },
      ...choferes.map((ch) => ({
        value: ch.id,
        label: ch.nombre,
      })),
    ];
  }, [choferes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nueva-carga-sa-titulo"
    >
      <div className="relative w-full max-w-2xl border border-black/15 bg-white p-6 shadow-xl my-auto">
        <h2
          id="nueva-carga-sa-titulo"
          className="text-xl font-semibold text-vialto-charcoal mb-6 border-b border-black/10 pb-3"
        >
          Registrar nueva carga
        </h2>

        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Fecha *</label>
              <input
                type="date"
                name="fecha"
                required
                value={formData.fecha}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estación *</label>
              <select
                name="estacion"
                required
                value={formData.estacion}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="" disabled>
                  Seleccione estación...
                </option>
                {SERVICE_STATIONS.map((station) => (
                  <option key={station} value={station}>
                    {station}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Vehículo *</label>
              <SearchableSelect
                name="vehiculoId"
                options={vehiculosOptions}
                value={formData.vehiculoId}
                onChange={handleSelectChange}
                placeholder="Seleccione un vehículo..."
              />
            </div>

            <div>
              <label className={labelClass}>Conductor (Opcional)</label>
              <SearchableSelect
                name="choferId"
                options={choferesOptions}
                value={formData.choferId}
                onChange={handleSelectChange}
                placeholder="Sin conductor asignado"
              />
            </div>

            <div>
              <label className={labelClass}>Litros *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                name="litros"
                required
                value={formData.litros}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Precio por Litro *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precioPorLitro"
                required
                value={formData.precioPorLitro}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Monto Total *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="importe"
                required
                value={formData.importe}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
              {importeError && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  ⚠️ {importeError}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Kilómetros *</label>
              <input
                type="text"
                inputMode="numeric"
                name="km"
                required
                value={formData.km}
                onChange={handleChange}
                className={inputClass}
                placeholder="Ej: 450.000"
              />
              {kmError && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  ⚠️ {kmError}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Forma de pago *</label>
              <select
                name="formaPago"
                required
                value={formData.formaPago}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="" disabled>
                  Seleccione método...
                </option>
                <option value="efectivo">{FORMA_PAGO_LABELS.efectivo}</option>
                <option value="tarjeta">{FORMA_PAGO_LABELS.tarjeta}</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-black/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(importeError) || Boolean(kmError)}
              className="inline-flex h-10 items-center px-6 bg-vialto-fire text-sm font-medium uppercase tracking-wider text-white hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:text-gray-500"
            >
              {loading ? "Guardando..." : "Guardar Carga"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

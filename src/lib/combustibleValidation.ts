import { useState, useEffect } from "react";
import { apiJson } from "@/lib/api";

type KmBounds = {
  prev: { km: number; fecha: string } | null;
  next: { km: number; fecha: string } | null;
};

export type FormErrors = {
  importe?: string;
  km?: string;
};

export function useCombustibleValidation(
  getToken: () => Promise<string | null>,
  vehiculoId: string,
  fecha: string, // YYYY-MM-DD
  litrosRaw: string,
  precioPorLitroRaw: string,
  importeRaw: string,
  kmRaw: string,
  excludeId?: string
) {
  const [bounds, setBounds] = useState<KmBounds | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Fetch km bounds with debounce when vehiculoId or fecha change
  useEffect(() => {
    let cancelled = false;

    if (!vehiculoId || !fecha) {
      setBounds(null);
      return;
    }

    const timer = setTimeout(() => {
      const qs = new URLSearchParams();
      qs.set("vehiculoId", vehiculoId);
      qs.set("fecha", fecha);
      if (excludeId) qs.set("excludeId", excludeId);

      apiJson<KmBounds>(`/api/combustible/limites-km?${qs.toString()}`, getToken)
        .then((res) => {
          if (!cancelled) setBounds(res);
        })
        .catch(() => {
          // Si falla, no bloqueamos el frontend, el backend igual lo validará al guardar
          if (!cancelled) setBounds(null);
        });
    }, 500); // 500ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vehiculoId, fecha, excludeId, getToken]);

  // Validate math and bounds in real-time
  useEffect(() => {
    const errors: FormErrors = {};

    const litros = Number(litrosRaw);
    const precio = Number(precioPorLitroRaw);
    const importe = Number(importeRaw);
    const km = parseInt(kmRaw.replace(/\./g, ""), 10);

    // 1. Validar coherencia de importe
    if (litros > 0 && precio > 0 && importe > 0) {
      const expectedImporte = litros * precio;
      const diff = Math.abs(importe - expectedImporte);
      const tolerance = expectedImporte * 0.01;

      if (diff > tolerance) {
        errors.importe =
          "Inconsistencia: El importe total no coincide con los litros multiplicados por el precio";
      }
    }

    // 2. Validar kilometraje histórico
    if (bounds && !isNaN(km) && km > 0) {
      if (bounds.prev && km < bounds.prev.km) {
        const fechaFmt = new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(bounds.prev.fecha));
        errors.km = `Inconsistencia: No puede ser inferior a la carga anterior el ${fechaFmt} (${bounds.prev.km.toLocaleString("es-AR")} km)`;
      }

      if (bounds.next && km > bounds.next.km) {
        const fechaFmt = new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(bounds.next.fecha));
        errors.km = `Inconsistencia: No puede ser superior a la carga posterior el ${fechaFmt} (${bounds.next.km.toLocaleString("es-AR")} km)`;
      }
    }

    setFormErrors(errors);
  }, [litrosRaw, precioPorLitroRaw, importeRaw, kmRaw, bounds]);

  return { formErrors };
}

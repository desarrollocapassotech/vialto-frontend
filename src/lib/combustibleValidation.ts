import { useState, useEffect, useMemo } from "react";
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
  excludeId?: string,
) {
  const [bounds, setBounds] = useState<KmBounds | null>(null);
  const [kmError, setKmError] = useState<string | undefined>(undefined);

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

      apiJson<KmBounds>(
        `/api/combustible/limites-km?${qs.toString()}`,
        getToken,
      )
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

  // Coherencia importe ≈ litros × precio: sincrónico (useMemo), no vía efecto.
  // Así se recalcula en el mismo render que litrosRaw/precioPorLitroRaw/importeRaw
  // cambian, sin un frame intermedio con datos desactualizados.
  const importeError = useMemo(() => {
    const litros = Number(litrosRaw);
    const precio = Number(precioPorLitroRaw);
    const importe = Number(importeRaw);

    if (litros > 0 && precio > 0 && importe > 0) {
      const expectedImporte = litros * precio;
      const diff = Math.abs(importe - expectedImporte);
      const tolerance = expectedImporte * 0.01;

      if (diff > tolerance) {
        return "Inconsistencia: El importe total no coincide con los litros multiplicados por el precio";
      }
    }
    return undefined;
  }, [litrosRaw, precioPorLitroRaw, importeRaw]);

  // Límite de km: depende de `bounds` (fetch async con debounce), se mantiene
  // vía efecto porque no hay forma de calcularlo sincrónicamente.
  useEffect(() => {
    const km = parseInt(kmRaw.replace(/\./g, ""), 10);

    if (bounds && !isNaN(km) && km > 0) {
      if (bounds.prev && km < bounds.prev.km) {
        const fechaFmt = new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(bounds.prev.fecha));
        setKmError(
          `Inconsistencia: No puede ser inferior a la carga anterior el ${fechaFmt} (${bounds.prev.km.toLocaleString("es-AR")} km)`,
        );
        return;
      }

      if (bounds.next && km > bounds.next.km) {
        const fechaFmt = new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(bounds.next.fecha));
        setKmError(
          `Inconsistencia: No puede ser superior a la carga posterior el ${fechaFmt} (${bounds.next.km.toLocaleString("es-AR")} km)`,
        );
        return;
      }
    }

    setKmError(undefined);
  }, [kmRaw, bounds]);

  const formErrors: FormErrors = useMemo(() => {
    const errors: FormErrors = {};
    if (importeError) errors.importe = importeError;
    if (kmError) errors.km = kmError;
    return errors;
  }, [importeError, kmError]);

  return { formErrors };
}

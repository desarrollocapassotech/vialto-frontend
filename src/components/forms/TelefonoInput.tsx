// src/components/forms/TelefonoInput.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumber,
} from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { CrudInput, CrudSelect } from "@/components/crud/CrudFields";
import type { PaisCodigo } from "@/lib/ciudades";

// "AR" -> 🇦🇷
function banderaEmoji(code: string) {
  if (code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)),
  );
}

// Nombres de país en español (con fallback al código)
const nombrePais = (() => {
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames(["es"], { type: "region" });
  } catch {
    dn = null;
  }
  return (code: string) => dn?.of(code) ?? code;
})();

// Lista completa, ordenada alfabéticamente por nombre
const PAISES = getCountries()
  .map((code) => ({
    code,
    nombre: nombrePais(code),
    prefijo: getCountryCallingCode(code),
    bandera: banderaEmoji(code),
  }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

type Props = {
  pais?: PaisCodigo | ""; // sugerencia inicial (país del transportista)
  value: string; // E.164: "+543512402751" | ""
  onChange: (e164: string) => void;
  error?: string;
  placeholder?: string;
};

export function TelefonoInput({
  pais,
  value,
  onChange,
  error,
  placeholder,
}: Props) {
  // País inicial: del value si existe, si no el del form, si no AR
  const [country, setCountry] = useState<CountryCode>(() => {
    if (value) {
      try {
        const c = parsePhoneNumber(value)?.country;
        if (c) return c;
      } catch {
        /* noop */
      }
    }
    if (pais && isSupportedCountry(pais)) return pais as CountryCode;
    return "AR";
  });

  // Sincroniza una sola vez si el value llega async (edición con fetch)
  const synced = useRef(false);
  const derivado = useMemo<CountryCode | undefined>(() => {
    if (!value) return undefined;
    try {
      return parsePhoneNumber(value)?.country;
    } catch {
      return undefined;
    }
  }, [value]);
  useEffect(() => {
    if (!synced.current && derivado) {
      setCountry(derivado);
      synced.current = true;
    }
  }, [derivado]);

  const prefijo = getCountryCallingCode(country);

  // Parte nacional formateada (sin prefijo), lo que se ve en el input
  const nacional = useMemo(() => {
    if (!value) return "";
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith(prefijo)) digits = digits.slice(prefijo.length);
    return new AsYouType(country).input(digits);
  }, [value, country, prefijo]);

  function emit(nextCountry: CountryCode, rawNacional: string) {
    const digits = rawNacional.replace(/\D/g, "");
    if (!digits) return onChange("");
    onChange(`+${getCountryCallingCode(nextCountry)}${digits}`);
  }

  function handleCountryChange(next: CountryCode) {
    setCountry(next);
    emit(next, nacional); // conserva los dígitos, cambia el prefijo
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <div className="shrink-0 sm:w-60">
        <CrudSelect
          value={country}
          onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
        >
          {PAISES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.bandera} {p.nombre} (+{p.prefijo})
            </option>
          ))}
        </CrudSelect>
      </div>
      <div className="flex-1">
        <CrudInput
          type="tel"
          placeholder={placeholder ?? "Ej: 351 240 2751"}
          value={nacional}
          error={error}
          onChange={(e) => emit(country, e.target.value)}
        />
      </div>
    </div>
  );
}

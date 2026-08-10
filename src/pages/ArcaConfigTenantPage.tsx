import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HelpCircle } from "lucide-react"; // <-- Importamos HelpCircle
import { ArcaCertificadoModal } from "@/components/liquidaciones/ArcaCertificadoModal";
import { ConceptosLiquidacionConfigSection } from "@/components/liquidaciones/ConceptosLiquidacionConfigSection";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import type { ArcaConfig } from "@/types/api";

const CONDICION_IVA = [
  { value: "1", label: "IVA Responsable Inscripto" },
  { value: "6", label: "Responsable Monotributo" },
  { value: "4", label: "IVA Sujeto Exento" },
  { value: "5", label: "Consumidor Final" },
  { value: "3", label: "IVA no Responsable" },
  { value: "7", label: "Sujeto no Categorizado" },
];

function isoToArcaDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function arcaDateToIso(arca: string) {
  if (!arca) return "";
  const [d, m, y] = arca.split("/");
  if (!y) return "";
  return `${y}-${m}-${d}`;
}

function fmtDate(iso: string) {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

type FormValues = {
  cuitEmisor: string;
  razonSocial: string;
  domicilioEmisor: string;
  condicionIvaEmisor: string;
  ingBrutos: string;
  inicActEmisor: string;
  ptoVentaCvlp: string;
  ptoVentaFactura: string;
  ambiente: "homologacion" | "produccion";
  comisionPctDefault: string;
  ivaGastosAdmin: string;
  certPemProduccion: string;
  keyPemProduccion: string;
};

const EMPTY: FormValues = {
  cuitEmisor: "",
  razonSocial: "",
  domicilioEmisor: "",
  condicionIvaEmisor: "",
  ingBrutos: "",
  inicActEmisor: "",
  ptoVentaCvlp: "1",
  ptoVentaFactura: "1",
  ambiente: "homologacion",
  comisionPctDefault: "8",
  ivaGastosAdmin: "21",
  certPemProduccion: "",
  keyPemProduccion: "",
};

const EMISOR_FIELDS = [
  "cuitEmisor",
  "razonSocial",
  "domicilioEmisor",
  "condicionIvaEmisor",
  "ingBrutos",
  "inicActEmisor",
] as const satisfies readonly (keyof FormValues)[];

const VENTA_FIELDS = [
  "ptoVentaCvlp",
  "ptoVentaFactura",
] as const satisfies readonly (keyof FormValues)[];

const AMBIENTE_FIELDS = [
  "ambiente",
] as const satisfies readonly (keyof FormValues)[];

const COMISION_FIELDS = [
  "comisionPctDefault",
  "ivaGastosAdmin",
] as const satisfies readonly (keyof FormValues)[];

const CERT_FIELDS = [
  "certPemProduccion",
  "keyPemProduccion",
] as const satisfies readonly (keyof FormValues)[];

const GENERAL_FIELDS = [
  ...EMISOR_FIELDS,
  ...VENTA_FIELDS,
  ...COMISION_FIELDS,
] as const satisfies readonly (keyof FormValues)[];

function configToForm(c: ArcaConfig): FormValues {
  return {
    cuitEmisor: c.cuitEmisor,
    razonSocial: c.razonSocial ?? "",
    domicilioEmisor: c.domicilioEmisor ?? "",
    condicionIvaEmisor: c.condicionIvaEmisor ?? "",
    ingBrutos: c.ingBrutos ?? "",
    inicActEmisor: arcaDateToIso(c.inicActEmisor ?? ""),
    ptoVentaCvlp: String(c.ptoVentaCvlp),
    ptoVentaFactura: String(c.ptoVentaFactura),
    ambiente: c.ambiente,
    comisionPctDefault: String(c.comisionPctDefault),
    ivaGastosAdmin: String(c.ivaGastosAdmin),
    certPemProduccion: "",
    keyPemProduccion: "",
  };
}

const inputClass =
  "h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";

const labelClass =
  "font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel";

const sectionTitleClass =
  "font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-vialto-charcoal";

function SectionCard({
  title,
  description,
  onSave,
  saving,
  dirty,
  children,
}: {
  title: string;
  description?: string;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-black/10 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className={sectionTitleClass}>{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-vialto-steel">{description}</p>
          )}
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="shrink-0 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel hover:text-vialto-fire disabled:opacity-50 disabled:hover:text-vialto-steel"
          >
            {saving ? "Aplicando…" : dirty ? "Aplicar cambios" : "Sin cambios"}
          </button>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ArcaConfigTenantPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const canEditAmbiente = isPlatformSuperadmin(user?.publicMetadata);
  const { showToast } = useToast();
  const [existing, setExisting] = useState<ArcaConfig | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [savedValues, setSavedValues] = useState<FormValues>(EMPTY);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"general" | "ambiente" | "conceptos">(
    tabParam === "ambiente" || tabParam === "conceptos" ? tabParam : "general",
  );

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    void (async () => {
      try {
        const config = await apiJson<ArcaConfig | null>(
          "/api/integracion-arca/config",
          () => getToken(),
        );
        if (!cancelled) {
          if (config) {
            setExisting(config);
            setValues(configToForm(config));
            setSavedValues(configToForm(config));
          }
        }
      } catch {
        // sin config previa
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function sectionDirty(keys: readonly (keyof FormValues)[]) {
    const comparable = canEditAmbiente
      ? keys
      : keys.filter((k) => k !== "ambiente");
    return !existing || comparable.some((k) => values[k] !== savedValues[k]);
  }

  async function saveSection(
    keys: readonly (keyof FormValues)[],
    overrides?: Partial<FormValues>,
  ) {
    const v: FormValues = { ...savedValues };
    for (const k of keys) (v as Record<string, string>)[k] = values[k];
    Object.assign(v, overrides ?? {});
    if (!canEditAmbiente) {
      v.ambiente = savedValues.ambiente;
    }
    const touched = new Set<keyof FormValues>([
      ...keys,
      ...(Object.keys(overrides ?? {}) as (keyof FormValues)[]),
    ]);

    if (!existing) {
      v.cuitEmisor = values.cuitEmisor;
      touched.add("cuitEmisor");
    }

    if (!v.cuitEmisor.trim()) {
      setFieldErrors({ cuitEmisor: "El CUIT emisor es obligatorio." });
      const msg =
        'Ingresá el CUIT emisor en "Datos del emisor" antes de guardar.';
      setError(msg);
      throw new Error(msg);
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const body = {
        cuitEmisor: v.cuitEmisor.trim(),
        razonSocial: v.razonSocial.trim() || undefined,
        domicilioEmisor: v.domicilioEmisor.trim() || undefined,
        condicionIvaEmisor: v.condicionIvaEmisor.trim() || undefined,
        ingBrutos: v.ingBrutos.trim() || undefined,
        inicActEmisor: v.inicActEmisor
          ? isoToArcaDate(v.inicActEmisor)
          : undefined,
        ptoVentaCvlp: Number(v.ptoVentaCvlp),
        ptoVentaFactura: Number(v.ptoVentaFactura),
        ambiente: v.ambiente,
        comisionPctDefault: Number(v.comisionPctDefault),
        ivaGastosAdmin: Number(v.ivaGastosAdmin),
        certPemProduccion: v.certPemProduccion.trim() || undefined,
        keyPemProduccion: v.keyPemProduccion.trim() || undefined,
      };
      const config = await apiJson<ArcaConfig>(
        "/api/integracion-arca/config",
        () => getToken(),
        { method: "POST", body: JSON.stringify(body) },
      );
      setExisting(config);
      const merged = configToForm(config);
      setSavedValues(merged);
      setValues((prev) => {
        const next = { ...prev };
        for (const k of touched)
          (next as Record<string, string>)[k] = merged[k];
        return next;
      });
      showToast("Configuración guardada correctamente.");
    } catch (e) {
      const msg = friendlyError(e, "arca");
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoSelect(file: File) {
    setLogoError(null);
    const isImage =
      file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isImage) {
      setLogoError("El logo debe ser una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("El logo no puede superar 5 MB.");
      return;
    }
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const config = await apiJson<ArcaConfig>(
        "/api/integracion-arca/config/logo",
        () => getToken(),
        { method: "POST", body: form },
      );
      setExisting(config);
      showToast("Logo actualizado correctamente.");
    } catch (e) {
      setLogoError(friendlyError(e, "arca"));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleLogoRemove() {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const config = await apiJson<ArcaConfig>(
        "/api/integracion-arca/config/logo",
        () => getToken(),
        { method: "DELETE" },
      );
      setExisting(config);
      showToast("Logo eliminado.");
    } catch (e) {
      setLogoError(friendlyError(e, "arca"));
    } finally {
      setLogoUploading(false);
    }
  }

  const generalDirty = sectionDirty(GENERAL_FIELDS);

  function onSubmitGeneral(e: React.FormEvent) {
    e.preventDefault();
    void saveSection(GENERAL_FIELDS).catch(() => {});
  }

  const TABS: { id: "general" | "ambiente" | "conceptos"; label: string }[] = [
    { id: "general", label: "General" },
    { id: "ambiente", label: "Ambiente y certificados" },
    { id: "conceptos", label: "Conceptos de liquidación" },
  ];

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Configuración ARCA / AFIP
      </h1>
      <p className="mt-2 text-vialto-steel">
        Datos para la emisión de comprobantes electrónicos.
      </p>
      {existing && (
        <p className="mt-1 text-xs text-vialto-steel/70">
          Última actualización: {fmtDate(existing.updatedAt)}
        </p>
      )}

      <div className="mt-8 flex gap-0.5 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "px-4 py-2.5 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-vialto-fire font-semibold text-vialto-charcoal"
                : "border-transparent text-vialto-steel hover:text-vialto-charcoal",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "conceptos" && (
        <div className="mt-6">
          <SectionCard
            title="Conceptos de liquidación"
            description="Catálogo de conceptos adicionales que se pueden sumar o restar al liquidar."
          >
            <ConceptosLiquidacionConfigSection getToken={() => getToken()} />
          </SectionCard>
        </div>
      )}

      {(tab === "general" || tab === "ambiente") && initialLoading ? (
        <p className="mt-8 text-sm text-vialto-steel">
          Cargando configuración…
        </p>
      ) : tab === "general" ? (
        <form onSubmit={onSubmitGeneral} className="mt-6 space-y-6">
          {error && (
            <div
              className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              {error}
            </div>
          )}

          <SectionCard
            title="Datos del emisor"
            onSave={() => void saveSection(EMISOR_FIELDS).catch(() => {})}
            saving={loading}
            dirty={sectionDirty(EMISOR_FIELDS)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cuitEmisor" className={labelClass}>
                  CUIT Emisor <span className="text-red-500">*</span>
                </label>
                <input
                  id="cuitEmisor"
                  type="text"
                  value={values.cuitEmisor}
                  onChange={(e) => set("cuitEmisor", e.target.value)}
                  placeholder="Ej: 30-71234567-8"
                  className={`${inputClass} ${fieldErrors.cuitEmisor ? "border-red-400" : ""}`}
                />
                <CrudFieldError message={fieldErrors.cuitEmisor} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="razonSocial" className={labelClass}>
                  Razón Social
                </label>
                <input
                  id="razonSocial"
                  type="text"
                  value={values.razonSocial}
                  onChange={(e) => set("razonSocial", e.target.value)}
                  placeholder="Ej: Transportes Del Sur S.R.L."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="condicionIva" className={labelClass}>
                  Condición frente al IVA
                </label>
                <select
                  id="condicionIva"
                  value={values.condicionIvaEmisor}
                  onChange={(e) => set("condicionIvaEmisor", e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Sin especificar —</option>
                  {CONDICION_IVA.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="domicilioEmisor" className={labelClass}>
                  Domicilio del Emisor
                </label>
                <input
                  id="domicilioEmisor"
                  type="text"
                  value={values.domicilioEmisor}
                  onChange={(e) => set("domicilioEmisor", e.target.value)}
                  placeholder="Ej: San Martín 1234, Paraná, Entre Ríos"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ingBrutos" className={labelClass}>
                  Ing. Brutos
                </label>
                <input
                  id="ingBrutos"
                  type="text"
                  value={values.ingBrutos}
                  onChange={(e) => set("ingBrutos", e.target.value)}
                  placeholder="Ej: CM-30712345678"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inicActEmisor" className={labelClass}>
                  Inicio de Actividades
                </label>
                <input
                  id="inicActEmisor"
                  type="date"
                  value={values.inicActEmisor}
                  onChange={(e) => set("inicActEmisor", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Logo de la empresa"
            description="Se muestra en los comprobantes emitidos por ARCA."
          >
            {!existing ? (
              <p className="text-xs text-vialto-steel">
                Guardá el CUIT del emisor en "Datos del emisor" antes de subir
                el logo.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                {existing.logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoPreviewOpen(true)}
                    title="Ver logo en tamaño completo"
                    className="h-16 w-16 shrink-0 rounded border border-black/10 bg-white p-1 hover:ring-2 hover:ring-vialto-fire/35"
                  >
                    <img
                      src={existing.logoUrl}
                      alt="Logo de la empresa"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-black/20 text-center text-[10px] uppercase tracking-wider text-vialto-steel">
                    Sin logo
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex h-10 items-center gap-2 rounded border border-black/20 bg-white px-4 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                    >
                      {logoUploading && <Spinner className="h-3.5 w-3.5" />}
                      {logoUploading
                        ? "Subiendo…"
                        : existing.logoUrl
                          ? "Cambiar logo"
                          : "Subir logo"}
                    </button>
                    {existing.logoUrl && (
                      <>
                        <button
                          type="button"
                          disabled={logoUploading}
                          onClick={() => setLogoPreviewOpen(true)}
                          className="text-xs uppercase tracking-wider text-vialto-steel hover:underline disabled:opacity-50"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          disabled={logoUploading}
                          onClick={() => void handleLogoRemove()}
                          className="text-xs uppercase tracking-wider text-vialto-fire hover:underline disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleLogoSelect(f);
                      }}
                    />
                  </div>
                  <p className="text-xs text-vialto-steel">
                    JPG, PNG o WEBP, máximo 5 MB.
                  </p>
                </div>
              </div>
            )}
            {logoError && (
              <p className="text-xs font-medium text-red-600">{logoError}</p>
            )}
          </SectionCard>

          <SectionCard
            title="Puntos de venta"
            onSave={() => void saveSection(VENTA_FIELDS).catch(() => {})}
            saving={loading}
            dirty={sectionDirty(VENTA_FIELDS)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ptoVentaCvlp" className={labelClass}>
                  Pto. Venta CVLP
                </label>
                <input
                  id="ptoVentaCvlp"
                  type="number"
                  value={values.ptoVentaCvlp}
                  onChange={(e) => set("ptoVentaCvlp", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ptoVentaFactura" className={labelClass}>
                  Pto. Venta Factura A/B
                </label>
                <input
                  id="ptoVentaFactura"
                  type="number"
                  value={values.ptoVentaFactura}
                  onChange={(e) => set("ptoVentaFactura", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Comisiones e IVA"
            description="Porcentajes aplicados por defecto al liquidar viajes."
            onSave={() => void saveSection(COMISION_FIELDS).catch(() => {})}
            saving={loading}
            dirty={sectionDirty(COMISION_FIELDS)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="comisionPctDefault" className={labelClass}>
                  Comisión default (%)
                </label>
                <input
                  id="comisionPctDefault"
                  type="number"
                  value={values.comisionPctDefault}
                  onChange={(e) => set("comisionPctDefault", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ivaGastosAdmin"
                  className={`flex items-center gap-1.5 ${labelClass}`}
                >
                  <span>IVA sobre neto (%)</span>
                  <div className="group relative flex items-center">
                    <HelpCircle className="h-3.5 w-3.5 cursor-help text-vialto-steel transition-colors hover:text-vialto-charcoal" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded bg-vialto-charcoal px-2.5 py-1.5 text-[11px] normal-case leading-tight tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Alícuotas válidas de AFIP: 0%, 2.5%, 5%, 10.5%, 21% y 27%
                      <span className="absolute left-1/2 top-full -mt-[1px] -translate-x-1/2 border-[5px] border-transparent border-t-vialto-charcoal"></span>
                    </div>
                  </div>
                </label>
                <input
                  id="ivaGastosAdmin"
                  type="number"
                  value={values.ivaGastosAdmin}
                  onChange={(e) => set("ivaGastosAdmin", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <button
            type="submit"
            disabled={loading || !generalDirty}
            className="inline-flex items-center gap-2 h-10 rounded bg-vialto-fire px-6 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-bright disabled:opacity-50"
          >
            {loading && <Spinner />}
            {loading
              ? "Aplicando…"
              : generalDirty
                ? "Aplicar cambios"
                : "Sin cambios para aplicar"}
          </button>
        </form>
      ) : tab === "ambiente" ? (
        <div className="mt-6 space-y-6">
          {error && (
            <div
              className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              {error}
            </div>
          )}

          <SectionCard
            title="Ambiente"
            onSave={() => void saveSection(AMBIENTE_FIELDS).catch(() => {})}
            saving={loading}
            dirty={sectionDirty(AMBIENTE_FIELDS)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ambiente" className={labelClass}>
                  Ambiente
                </label>
                <select
                  id="ambiente"
                  value={values.ambiente}
                  disabled={!canEditAmbiente}
                  onChange={(e) =>
                    set("ambiente", e.target.value as FormValues["ambiente"])
                  }
                  className={`${inputClass}${!canEditAmbiente ? " cursor-not-allowed bg-vialto-mist opacity-90" : ""}`}
                >
                  <option value="homologacion">Homologación (testing)</option>
                  <option value="produccion">Producción</option>
                </select>
                {!canEditAmbiente && (
                  <p className="text-xs text-vialto-steel">
                    Solo el superadmin de plataforma puede cambiar el ambiente.
                  </p>
                )}
              </div>
            </div>
            {values.ambiente === "produccion" && (
              <p className="text-xs text-red-700">
                Los comprobantes emitidos en producción son reales y tienen
                validez fiscal ante AFIP.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Certificado y clave privada"
            description="En homologación se usa automáticamente el CUIT de prueba de AFIP, sin certificado. Solo hace falta cargar el certificado real para producción."
          >
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded border border-black/20 bg-white px-4 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                Ver / editar certificado
              </button>
              <div className="text-xs text-vialto-steel">
                <p className="mb-0.5 font-medium text-emerald-800">
                  Producción
                </p>
                <p>
                  Certificado:{" "}
                  {values.certPemProduccion ? (
                    <span className="text-amber-700">
                      ● pendiente de guardar
                    </span>
                  ) : existing?.certConfiguradoProduccion ? (
                    <span className="text-green-700">● configurado</span>
                  ) : (
                    <span>○ sin configurar</span>
                  )}
                </p>
                <p>
                  Clave privada:{" "}
                  {values.keyPemProduccion ? (
                    <span className="text-amber-700">
                      ● pendiente de guardar
                    </span>
                  ) : existing?.keyConfiguradoProduccion ? (
                    <span className="text-green-700">● configurada</span>
                  ) : (
                    <span>○ sin configurar</span>
                  )}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {certModalOpen && (
        <ArcaCertificadoModal
          ambienteActivo={existing?.ambiente ?? values.ambiente}
          produccion={{
            cert: values.certPemProduccion,
            key: values.keyPemProduccion,
            certConfigurado: existing?.certConfiguradoProduccion,
            keyConfigurado: existing?.keyConfiguradoProduccion,
          }}
          onClose={() => setCertModalOpen(false)}
          onSave={async (fields) => {
            await saveSection(CERT_FIELDS, fields);
            setCertModalOpen(false);
          }}
        />
      )}

      {logoPreviewOpen && existing?.logoUrl && (
        <AdjuntoPreviewModal
          url={existing.logoUrl}
          title="Logo de la empresa"
          onClose={() => setLogoPreviewOpen(false)}
        />
      )}
    </div>
  );
}

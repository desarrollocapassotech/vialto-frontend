import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui/Spinner";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { EmitirLiquidacionModal } from "@/components/liquidaciones/EmitirLiquidacionModal";
import { AnularLiquidacionModal } from "@/components/liquidaciones/AnularLiquidacionModal";
import { MaskedPemField } from "@/components/liquidaciones/ArcaCertificadoModal";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson, apiFetch } from "@/lib/api";
import { anulacionComprobanteLabel, CUIT_TEST_HOMOLOGACION } from "@/lib/arcaCbteTipo";
import { filenameFromContentDisposition } from "@/lib/downloadFilename";
import { friendlyError } from "@/lib/friendlyError";
import { formatStoredArcaError } from "@/lib/arcaFriendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type { ArcaConfig, ArcaLog, Liquidacion } from "@/types/api";

// ── Helpers visuales ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_cae: "Pendiente CAE",
  autorizado: "Autorizado",
  error: "Error",
  anulado: "Anulado",
};

const ESTADO_CLASS: Record<string, string> = {
  borrador: "bg-vialto-steel/15 text-vialto-steel",
  pendiente_cae: "bg-amber-100 text-amber-800",
  autorizado: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  anulado: "bg-slate-100 text-slate-600",
};

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const fmt = (n: number) => ars.format(n);
const fmtDate = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().join("/");
const fmtTs = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });

// ── Condición IVA emisor (AFIP standard codes) ───────────────────────────────

const CONDICION_IVA_EMISOR = [
  { value: "1", label: "IVA Responsable Inscripto" },
  { value: "6", label: "Responsable Monotributo" },
  { value: "4", label: "IVA Sujeto Exento" },
  { value: "5", label: "Consumidor Final" },
  { value: "3", label: "IVA no Responsable" },
  { value: "7", label: "Sujeto no Categorizado" },
];

// Helpers para la fecha (UI ↔ ARCA format)
function isoToArcaDate(iso: string): string {
  // "YYYY-MM-DD" → "DD/MM/YYYY"
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function arcaDateToIso(arca: string): string {
  // "DD/MM/YYYY" → "YYYY-MM-DD"
  if (!arca) return "";
  const [d, m, y] = arca.split("/");
  if (!y) return "";
  return `${y}-${m}-${d}`;
}

function validateConfigForm(values: ConfigFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.cuitEmisor.trim()) {
    errors.cuitEmisor = "El CUIT emisor es obligatorio.";
  }

  const enteroPositivoFields: (keyof ConfigFormValues)[] = [
    "ptoVentaCvlp",
    "ptoVentaFactura",
  ];
  for (const field of enteroPositivoFields) {
    const n = Number(values[field]);
    if (!Number.isInteger(n) || n < 1) {
      errors[field] = "Debe ser un número entero mayor o igual a 1.";
    }
  }

  const porcentajeFields: (keyof ConfigFormValues)[] = [
    "comisionPctDefault",
    "ivaGastosAdmin",
  ];
  for (const field of porcentajeFields) {
    const n = Number(values[field]);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      errors[field] = "Debe ser un valor entre 0 y 100.";
    }
  }

  return errors;
}

// ── Modales genéricos ─────────────────────────────────────────────────────────

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-medium text-vialto-charcoal">
          {title}
        </h3>
        <p className="mt-3 text-sm text-vialto-steel">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 font-[family-name:var(--font-ui)] text-sm font-medium text-vialto-steel hover:bg-slate-100 hover:text-vialto-charcoal transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 font-[family-name:var(--font-ui)] text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ConfigTab ────────────────────────────────────────────────────────────────

type ConfigFormValues = {
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

const EMPTY_FORM: ConfigFormValues = {
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

function configToForm(c: ArcaConfig): ConfigFormValues {
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

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 rounded border bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 ${error ? "border-red-400" : "border-black/10"}`}
      />
      <CrudFieldError message={error} />
    </>
  );
}

function ConfigTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [existing, setExisting] = useState<ArcaConfig | null>(null);
  const [values, setValues] = useState<ConfigFormValues>(EMPTY_FORM);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCertProd, setEditingCertProd] = useState(true);
  const [editingKeyProd, setEditingKeyProd] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    (async () => {
      try {
        const config = await apiJson<ArcaConfig | null>(
          `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) {
          if (config) {
            setExisting(config);
            setValues(configToForm(config));
            setEditingCertProd(!config.certConfiguradoProduccion);
            setEditingKeyProd(!config.keyConfiguradoProduccion);
          } else {
            setExisting(null);
            setValues(EMPTY_FORM);
            setEditingCertProd(true);
            setEditingKeyProd(true);
          }
        }
      } catch {
        // 404 = no config todavía
        if (!cancelled) {
          setExisting(null);
          setValues(EMPTY_FORM);
          setEditingCertProd(true);
          setEditingKeyProd(true);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

  function set<K extends keyof ConfigFormValues>(
    key: K,
    value: ConfigFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateConfigForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const body = {
        cuitEmisor: values.cuitEmisor.trim(),
        razonSocial: values.razonSocial.trim() || undefined,
        domicilioEmisor: values.domicilioEmisor.trim() || undefined,
        condicionIvaEmisor: values.condicionIvaEmisor.trim() || undefined,
        ingBrutos: values.ingBrutos.trim() || undefined,
        inicActEmisor: values.inicActEmisor
          ? isoToArcaDate(values.inicActEmisor)
          : undefined,
        ptoVentaCvlp: Number(values.ptoVentaCvlp),
        ptoVentaFactura: Number(values.ptoVentaFactura),
        ambiente: values.ambiente,
        comisionPctDefault: Number(values.comisionPctDefault),
        ivaGastosAdmin: Number(values.ivaGastosAdmin),
        certPemProduccion: values.certPemProduccion.trim() || undefined,
        keyPemProduccion: values.keyPemProduccion.trim() || undefined,
      };

      const config = await apiJson<ArcaConfig>(
        `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "POST", body: JSON.stringify(body) },
      );
      setExisting(config);
      setValues(configToForm(config));
      setEditingCertProd(!config.certConfiguradoProduccion);
      setEditingKeyProd(!config.keyConfiguradoProduccion);
      showToast("Configuración guardada correctamente.");
    } catch (e) {
      setError(friendlyError(e, "arca"));
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <p className="mt-4 text-sm text-vialto-steel">Cargando configuración…</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-5">
      {existing && (
        <div className="rounded border border-black/10 bg-white px-4 py-3 text-sm text-vialto-charcoal">
          <span className="font-medium">Configurado</span> — última
          actualización: {fmtDate(existing.updatedAt)} · ambiente:{" "}
          <span
            className={`font-medium ${
              existing.ambiente === "produccion"
                ? "text-red-700"
                : "text-amber-700"
            }`}
          >
            {existing.ambiente === "produccion"
              ? "Producción"
              : "Homologación (testing)"}
          </span>
        </div>
      )}

      {error && (
        <div
          className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Datos del emisor */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="razonSocial">Razón Social</FieldLabel>
        <TextInput
          id="razonSocial"
          value={values.razonSocial}
          onChange={(v) => set("razonSocial", v)}
          placeholder="Ej: NyM Logística S.R.L."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="domicilioEmisor">Domicilio del Emisor</FieldLabel>
        <TextInput
          id="domicilioEmisor"
          value={values.domicilioEmisor}
          onChange={(v) => set("domicilioEmisor", v)}
          placeholder="Ej: Av. Siempreviva 742, CABA"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cuitEmisor">
            CUIT Emisor <span className="text-red-500">*</span>
          </FieldLabel>
          <input
            id="cuitEmisor"
            type="text"
            value={values.cuitEmisor}
            onChange={(e) => set("cuitEmisor", e.target.value)}
            placeholder="20XXXXXXXXXXX"
            className={`h-10 rounded border bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 ${fieldErrors.cuitEmisor ? "border-red-400" : "border-black/10"}`}
          />
          <CrudFieldError message={fieldErrors.cuitEmisor} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="condicionIvaEmisor">
            Condición frente al IVA
          </FieldLabel>
          <select
            id="condicionIvaEmisor"
            value={values.condicionIvaEmisor}
            onChange={(e) => set("condicionIvaEmisor", e.target.value)}
            className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
          >
            <option value="">— Sin especificar —</option>
            {CONDICION_IVA_EMISOR.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ingBrutos">Ing. Brutos</FieldLabel>
          <TextInput
            id="ingBrutos"
            value={values.ingBrutos}
            onChange={(v) => set("ingBrutos", v)}
            placeholder="Ej: CM 20XXXXXXXXX3"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="inicActEmisor">Inicio de Actividades</FieldLabel>
          <input
            id="inicActEmisor"
            type="date"
            value={values.inicActEmisor}
            onChange={(e) => set("inicActEmisor", e.target.value)}
            className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
          />
        </div>
      </div>

      {/* Puntos de venta */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ptoVentaCvlp">Pto. Venta CVLP</FieldLabel>
          <TextInput
            id="ptoVentaCvlp"
            type="number"
            value={values.ptoVentaCvlp}
            onChange={(v) => set("ptoVentaCvlp", v)}
            error={fieldErrors.ptoVentaCvlp}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ptoVentaFactura">
            Pto. Venta Factura A/B
          </FieldLabel>
          <TextInput
            id="ptoVentaFactura"
            type="number"
            value={values.ptoVentaFactura}
            onChange={(v) => set("ptoVentaFactura", v)}
            error={fieldErrors.ptoVentaFactura}
          />
        </div>
      </div>

      {/* Ambiente */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Ambiente</FieldLabel>
        <select
          value={values.ambiente}
          onChange={(e) =>
            set("ambiente", e.target.value as ConfigFormValues["ambiente"])
          }
          className="h-10 rounded border border-black/10 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
        >
          <option value="homologacion">Homologación (testing)</option>
          <option value="produccion">Producción</option>
        </select>
        {values.ambiente === "produccion" && (
          <p className="text-xs text-red-700">
            Los comprobantes emitidos en producción son reales y tienen validez
            fiscal ante AFIP.
          </p>
        )}
      </div>

      {/* Comisión e IVA */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="comisionPctDefault">
            Comisión default (%)
          </FieldLabel>
          <TextInput
            id="comisionPctDefault"
            type="number"
            value={values.comisionPctDefault}
            onChange={(v) => set("comisionPctDefault", v)}
            error={fieldErrors.comisionPctDefault}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="ivaGastosAdmin">IVA sobre neto (%)</FieldLabel>
          <TextInput
            id="ivaGastosAdmin"
            type="number"
            value={values.ivaGastosAdmin}
            onChange={(v) => set("ivaGastosAdmin", v)}
            error={fieldErrors.ivaGastosAdmin}
          />
        </div>
      </div>

      {/* Certificado y clave privada */}
      <div className="border-t border-black/10 pt-5 space-y-4">
        <div>
          <FieldLabel>Certificado y clave privada</FieldLabel>
          <p className="text-xs text-vialto-steel mt-1">
            Solo hace falta cargar el certificado real para producción. Dejá
            el campo vacío para conservar el valor actual.
          </p>
        </div>

        <div className="rounded border border-amber-300/70 bg-amber-50/40 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-amber-900">
              Homologación
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900">
              Testing
            </span>
            {values.ambiente === "homologacion" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-vialto-charcoal text-white">
                En uso ahora
              </span>
            )}
          </div>
          <p className="text-xs text-amber-900/90">
            En homologación no hace falta cargar un certificado propio: se usa
            automáticamente el CUIT de prueba de AFIP{" "}
            <span className="font-mono">{CUIT_TEST_HOMOLOGACION}</span>, sin
            certificado, en lugar del CUIT real del emisor. El punto de venta
            también debe ser uno válido para ese CUIT de prueba (usá{" "}
            <span className="font-mono">1</span> si no sabés cuál).
          </p>
        </div>

        <div className="rounded border border-emerald-300/70 bg-emerald-50/40 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-emerald-900">
              Producción
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-200 text-emerald-900">
              Comprobantes reales
            </span>
            {values.ambiente === "produccion" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-vialto-charcoal text-white">
                En uso ahora
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MaskedPemField
              id="certPemProduccion"
              label="Certificado digital (.crt / .pem)"
              value={values.certPemProduccion}
              onChange={(v) => set("certPemProduccion", v)}
              configurado={existing?.certConfiguradoProduccion}
              editing={editingCertProd}
              onEdit={() => setEditingCertProd(true)}
              saving={loading}
              placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            />
            <MaskedPemField
              id="keyPemProduccion"
              label="Clave privada (.key / .pem)"
              value={values.keyPemProduccion}
              onChange={(v) => set("keyPemProduccion", v)}
              configurado={existing?.keyConfiguradoProduccion}
              editing={editingKeyProd}
              onEdit={() => setEditingKeyProd(true)}
              saving={loading}
              placeholder="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 h-10 rounded bg-vialto-fire px-6 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-bright disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading
          ? "Guardando…"
          : existing
            ? "Guardar cambios"
            : "Guardar configuración"}
      </button>
    </form>
  );
}

// ── LiquidacionesTab ──────────────────────────────────────────────────────────

function LiquidacionesTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Liquidacion[] | null>(null);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowProcessing, setRowProcessing] = useState<Record<string, string>>(
    {},
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pendingEmitir, setPendingEmitir] = useState<Liquidacion | null>(null);

  // Estado para la ventana de confirmación
  const [anularId, setAnularId] = useState<string | null>(null);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      apiJson<Liquidacion[]>(
        `/api/platform/arca/liquidaciones?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      ),
      apiJson<ArcaConfig | null>(
        `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      ).catch(() => null),
    ])
      .then(([liq, cfg]) => {
        setItems(liq);
        setArcaConfig(cfg);
      })
      .catch((e) => setError(friendlyError(e, "arca")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  function onEmitirSuccess(updated: Liquidacion) {
    setItems(
      (prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev,
    );
    setPendingEmitir(null);
    showToast(
      updated.cae
        ? `Comprobante emitido correctamente. CAE: ${updated.cae}`
        : "Comprobante emitido correctamente.",
    );
  }

  async function descargarPdf(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "pdf" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      const res = await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/pdf?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al descargar el PDF");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `liquidacion-${id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function descargarPdfNc(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "pdf-nc" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      const res = await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/pdf-anulacion?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
      );
      if (!res.ok) throw new Error("Error al descargar el PDF de la anulación");
      const filename = filenameFromContentDisposition(
        res.headers.get("Content-Disposition"),
        `anulacion-${id}.pdf`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function anular(id: string, motivo: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "anular" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      await apiFetch(
        `/api/platform/arca/liquidaciones/${id}/anular?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "POST", body: JSON.stringify({ motivo }) },
      );
      setAnularId(null);
      load(); // Refrescamos todo para tener el estado actualizado desde el backend
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  async function eliminar(id: string) {
    setRowProcessing((prev) => ({ ...prev, [id]: "eliminar" }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      await apiFetch(
        `/api/platform/arca/liquidaciones/${id}?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      setEliminarId(null);
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(e, "arca") }));
    } finally {
      setRowProcessing((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

  if (loading)
    return (
      <p className="mt-6 text-sm text-vialto-steel">Cargando liquidaciones…</p>
    );
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <div className="mt-6 space-y-3">
      <ListadoDatos
        columns={[
          {
            id: "periodo",
            header: "Período",
            primary: true,
            cell: (liq) =>
              `${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "viajes",
            header: "Vj.",
            cell: (liq) => liq.cantViajes,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "bruto",
            header: "Bruto",
            cell: (liq) => fmt(liq.bruto),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: "comision",
            header: "Comisión",
            cell: (liq) => fmt(liq.comision),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-vialto-steel`,
          },
          {
            id: "liquido",
            header: "Líquido",
            cell: (liq) => fmt(liq.liquido),
            tdClassName: `${listadoTablaTdClass} text-right font-medium tabular-nums`,
          },
          {
            id: "cae",
            header: "CAE",
            cell: (liq) => liq.cae ?? "—",
            tdClassName: `${listadoTablaTdClass} font-mono text-xs text-vialto-steel`,
          },
          {
            id: "estado",
            header: "Estado",
            cell: (liq) => (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ""}`}
                  >
                    {ESTADO_LABEL[liq.estado] ?? liq.estado}
                  </span>
                  <AmbienteTestBadge ambiente={liq.ambiente} />
                </div>
                {liq.arcaError &&
                  (() => {
                    const msg =
                      formatStoredArcaError(liq.arcaError) ?? liq.arcaError;
                    return (
                      <p
                        className="mt-0.5 max-w-[180px] truncate text-xs text-red-600"
                        title={msg}
                      >
                        {msg}
                      </p>
                    );
                  })()}
                {rowErrors[liq.id] && (
                  <p
                    className="mt-1 max-w-[180px] rounded bg-red-50 p-1 text-xs font-medium text-red-700"
                    title={rowErrors[liq.id]}
                  >
                    Error: {rowErrors[liq.id]}
                  </p>
                )}
              </>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={items ?? []}
        rowKey={(liq) => liq.id}
        emptyMessage="No hay liquidaciones para esta empresa."
        renderActions={(liq) => {
          const isProc = rowProcessing[liq.id];
          return (
            <>
              {(liq.estado === "borrador" || liq.estado === "error") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setPendingEmitir(liq)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright disabled:opacity-50`}
                >
                  Emitir
                </button>
              )}
              {(liq.estado === "autorizado" || liq.estado === "anulado") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => descargarPdf(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                >
                  {isProc === "pdf" ? "…" : "PDF"}
                </button>
              )}
              {liq.estado === "anulado" && liq.anulacionCae && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => descargarPdfNc(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                  title={anulacionComprobanteLabel(liq.anulacionCbteTipo)}
                >
                  {isProc === "pdf-nc" ? "…" : "PDF anulación"}
                </button>
              )}
              {liq.estado === "autorizado" && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setAnularId(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-amber-600 hover:text-amber-700 disabled:opacity-50`}
                >
                  {isProc === "anular" ? "…" : "Anular"}
                </button>
              )}
              {(liq.estado === "borrador" ||
                liq.estado === "error" ||
                liq.estado === "pendiente_cae") && (
                <button
                  type="button"
                  disabled={!!isProc}
                  onClick={() => setEliminarId(liq.id)}
                  className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-red-600 hover:text-red-700 disabled:opacity-50`}
                >
                  {isProc === "eliminar" ? "…" : "Eliminar"}
                </button>
              )}
            </>
          );
        }}
        actionsHeader="Acciones"
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => {
          const isProc = rowProcessing[liq.id];
          return (
            <ListadoCard
              primary={`${fmtDate(liq.periodoDesde)} – ${fmtDate(liq.periodoHasta)}`}
              fields={[
                { label: "Viajes", value: liq.cantViajes },
                { label: "Bruto", value: fmt(liq.bruto) },
                { label: "Comisión", value: fmt(liq.comision) },
                { label: "Líquido", value: fmt(liq.liquido) },
                { label: "CAE", value: liq.cae ?? "—" },
                {
                  label: "Estado",
                  value: (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[liq.estado] ?? ""}`}
                        >
                          {ESTADO_LABEL[liq.estado] ?? liq.estado}
                        </span>
                        <AmbienteTestBadge ambiente={liq.ambiente} />
                      </div>
                      {liq.arcaError &&
                        (() => {
                          const msg =
                            formatStoredArcaError(liq.arcaError) ??
                            liq.arcaError;
                          return (
                            <p
                              className="mt-0.5 truncate text-xs text-red-600"
                              title={msg}
                            >
                              {msg}
                            </p>
                          );
                        })()}
                      {rowErrors[liq.id] && (
                        <p
                          className="mt-1 rounded bg-red-50 p-1 text-xs font-medium text-red-700"
                          title={rowErrors[liq.id]}
                        >
                          Error: {rowErrors[liq.id]}
                        </p>
                      )}
                    </>
                  ),
                },
              ]}
              actions={
                <>
                  {(liq.estado === "borrador" || liq.estado === "error") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setPendingEmitir(liq)}
                      className={`${listadoTablaAccionClass} inline-flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-vialto-fire hover:text-vialto-bright disabled:opacity-50`}
                    >
                      <Receipt
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      Emitir
                    </button>
                  )}
                  {(liq.estado === "autorizado" ||
                    liq.estado === "anulado") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => descargarPdf(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                    >
                      {isProc === "pdf" ? "…" : "PDF"}
                    </button>
                  )}
                  {liq.estado === "anulado" && liq.anulacionCae && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => descargarPdfNc(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50`}
                      title={anulacionComprobanteLabel(liq.anulacionCbteTipo)}
                    >
                      {isProc === "pdf-nc" ? "…" : "PDF anulación"}
                    </button>
                  )}
                  {liq.estado === "autorizado" && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setAnularId(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-amber-600 hover:text-amber-700 disabled:opacity-50`}
                    >
                      {isProc === "anular" ? "…" : "Anular"}
                    </button>
                  )}
                  {(liq.estado === "borrador" ||
                    liq.estado === "error" ||
                    liq.estado === "pendiente_cae") && (
                    <button
                      type="button"
                      disabled={!!isProc}
                      onClick={() => setEliminarId(liq.id)}
                      className={`${listadoTablaAccionClass} font-[family-name:var(--font-ui)] text-red-600 hover:text-red-700 disabled:opacity-50`}
                    >
                      {isProc === "eliminar" ? "…" : "Eliminar"}
                    </button>
                  )}
                </>
              }
            />
          );
        }}
      />

      {pendingEmitir && (
        <EmitirLiquidacionModal
          liq={pendingEmitir}
          getToken={getToken}
          onSuccess={onEmitirSuccess}
          onClose={() => setPendingEmitir(null)}
          emitirUrl={`/api/platform/arca/liquidaciones/${encodeURIComponent(pendingEmitir.id)}/emitir?tenantId=${encodeURIComponent(tenantId)}`}
          detalleUrl={`/api/platform/arca/liquidaciones/${encodeURIComponent(pendingEmitir.id)}?tenantId=${encodeURIComponent(tenantId)}`}
          configUrl={`/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId)}`}
          arcaConfig={arcaConfig}
          ivaPct={pendingEmitir.ivaPct ?? arcaConfig?.ivaGastosAdmin}
        />
      )}

      <AnularLiquidacionModal
        open={anularId != null}
        message="¿Deseás anular esta liquidación? Se emite un comprobante de ajuste en ARCA y los viajes quedan disponibles para una nueva liquidación."
        busy={anularId != null && rowProcessing[anularId] === "anular"}
        error={anularId != null ? (rowErrors[anularId] ?? null) : null}
        onCancel={() => {
          if (anularId && rowProcessing[anularId] === "anular") return;
          setAnularId(null);
        }}
        onConfirm={(motivo) => {
          if (!anularId) return;
          void anular(anularId, motivo);
        }}
      />

      <ConfirmModal
        isOpen={eliminarId != null}
        onClose={() => {
          if (eliminarId && rowProcessing[eliminarId] === "eliminar") return;
          setEliminarId(null);
        }}
        onConfirm={() => {
          if (!eliminarId) return;
          void eliminar(eliminarId);
          setEliminarId(null);
        }}
        title="Eliminar liquidación"
        message="¿Deseás eliminar esta liquidación? Esta acción no se puede deshacer."
        confirmText="Eliminar"
      />
    </div>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────────

function LogsTab({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<ArcaLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiJson<ArcaLog[]>(
      `/api/platform/arca/logs?tenantId=${encodeURIComponent(tenantId)}`,
      () => getToken(),
    )
      .then(setLogs)
      .catch((e) => setError(friendlyError(e, "arca")))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading)
    return <p className="mt-6 text-sm text-vialto-steel">Cargando logs…</p>;
  if (error) return <p className="mt-6 text-sm text-amber-700">{error}</p>;

  return (
    <ListadoDatos
      className="mt-6"
      columns={[
        {
          id: "fecha",
          header: "Fecha",
          primary: true,
          cell: (log) => fmtTs(log.createdAt),
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: "method",
          header: "Método",
          cell: (log) => (
            <span className="font-mono text-xs text-vialto-charcoal">
              {log.method}
            </span>
          ),
          tdClassName: listadoTablaTdClass,
        },
        {
          id: "ambiente",
          header: "Ambiente",
          cell: (log) => log.ambiente,
          tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
        },
        {
          id: "http",
          header: "HTTP",
          cell: (log) => log.httpStatus ?? "—",
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: "ms",
          header: "ms",
          cell: (log) => log.durationMs,
          thClassName: `${listadoTablaThClass} text-right`,
          tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-xs text-vialto-steel`,
        },
        {
          id: "resultado",
          header: "Resultado",
          cell: (log) =>
            log.exitoso ? (
              <span className="font-medium text-green-700">OK</span>
            ) : (
              <span className="text-red-600" title={log.error ?? ""}>
                {log.error ? "Error" : "Fallido"}
              </span>
            ),
          tdClassName: listadoTablaTdClass,
        },
      ]}
      rows={logs ?? []}
      rowKey={(log) => log.id}
      emptyMessage="No hay logs registrados para esta empresa."
      renderMobileCard={(log) => (
        <ListadoCard
          primary={fmtTs(log.createdAt)}
          fields={[
            {
              label: "Método",
              value: <span className="font-mono">{log.method}</span>,
            },
            { label: "Ambiente", value: log.ambiente },
            { label: "HTTP", value: log.httpStatus ?? "—" },
            { label: "ms", value: log.durationMs },
            {
              label: "Resultado",
              value: log.exitoso ? (
                <span className="font-medium text-green-700">OK</span>
              ) : (
                <span className="text-red-600">{log.error ?? "Fallido"}</span>
              ),
            },
          ]}
        />
      )}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "config" | "liquidaciones" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Configuración" },
  { id: "liquidaciones", label: "Liquidaciones" },
  { id: "logs", label: "Logs de auditoría" },
];

export function SuperadminArcaPage() {
  const tenants = useTenantsList();
  const [tenantId, setTenantId] = useState("");
  const [tab, setTab] = useState<Tab>("config");

  function handleTenantChange(next: string) {
    setTenantId(next);
    setTab("config");
  }

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          ARCA / AFIP
        </h1>
        <p className="mt-2 text-vialto-steel">
          Configuración de emisión electrónica y liquidaciones CVLP por empresa.
        </p>

        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={tenantId}
            onChange={handleTenantChange}
          />
        </div>

        {!tenantId && (
          <p className="mt-6 text-sm text-vialto-steel">
            Seleccioná una empresa para gestionar su configuración ARCA.
          </p>
        )}

        {tenantId && (
          <>
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

            {tab === "config" && (
              <ConfigTab key={`cfg-${tenantId}`} tenantId={tenantId} />
            )}
            {tab === "liquidaciones" && (
              <LiquidacionesTab key={`liq-${tenantId}`} tenantId={tenantId} />
            )}
            {tab === "logs" && (
              <LogsTab key={`log-${tenantId}`} tenantId={tenantId} />
            )}
          </>
        )}
      </div>
    </SuperadminOnly>
  );
}

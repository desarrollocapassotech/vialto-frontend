import { useMemo, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { MSG_ARCA_NO_FACTURA_USD, arcaBloqueaFacturarUsd } from "@/lib/arcaUsdRestriction";
import { monedaUnicaDeViajes, viajesFiltradosParaFactura } from "@/lib/viajesFlota";
import {
  emptyFacturaDraft,
  facturaPayloadFromDraft,
  type FacturaDraft,
} from "@/components/facturacion/FacturaEditModal";
import type { Factura, Viaje } from "@/types/api";

export type UseFacturaCreatorConfig = {
  getToken: () => Promise<string | null>;
  apiUrlViajes: string;
  apiUrlFacturasCreate: string;
  hasArca: boolean;
  showComprobanteAdjunto: boolean;
};

export function useFacturaCreator(config: UseFacturaCreatorConfig) {
  const configRef = useRef(config);
  configRef.current = config;

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FacturaDraft>(emptyFacturaDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);

  const viajesNueva = useMemo(() => {
    const list = viajesFiltradosParaFactura(
      viajes,
      draft.tipo,
      draft.clienteId,
      draft.transportistaId,
    );
    if (!config.hasArca) return list;
    return list.filter((v) => !arcaBloqueaFacturarUsd(true, v.monedaMonto));
  }, [viajes, draft.tipo, draft.clienteId, draft.transportistaId, config.hasArca]);

  async function ensureViajesLoaded() {
    if (viajes.length > 0 || viajesLoading) return;
    setViajesLoading(true);
    try {
      const data = await apiJson<Viaje[]>(configRef.current.apiUrlViajes, () =>
        configRef.current.getToken(),
      );
      setViajes(data);
    } catch {
      /* el modal queda con la lista vacía; el usuario puede reintentar */
    } finally {
      setViajesLoading(false);
    }
  }

  /** Precarga el draft para un viaje puntual, sin abrir el modal todavía. */
  function prepararDraftParaViaje(v: Viaje, letraComprobante?: "a" | "b") {
    setError(null);
    setDraft({
      ...emptyFacturaDraft(),
      clienteId: v.clienteId ?? "",
      viajeIds: [v.id],
      letraComprobante: letraComprobante ?? null,
    });
  }

  function abrir() {
    setCreating(true);
  }

  /** Abre el creador precargado para un viaje puntual (ej. desde su modal de vista). */
  function abrirParaViaje(v: Viaje) {
    prepararDraftParaViaje(v);
    abrir();
    void ensureViajesLoaded();
  }

  function cancelar() {
    setCreating(false);
    setError(null);
    setDraft(emptyFacturaDraft());
  }

  async function handleCreate(onSuccess?: (factura: Factura) => void) {
    setError(null);
    if (!draft.numero.trim()) {
      setError("Ingresá el número de factura.");
      return;
    }
    if (!draft.fechaEmision) {
      setError("Ingresá la fecha de emisión.");
      return;
    }
    if (monedaUnicaDeViajes(draft.viajeIds, viajes) === null) {
      setError(
        "Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.",
      );
      return;
    }
    if (
      config.hasArca &&
      draft.viajeIds.some((id) => {
        const v = viajes.find((x) => x.id === id);
        return v ? arcaBloqueaFacturarUsd(true, v.monedaMonto) : false;
      })
    ) {
      setError(MSG_ARCA_NO_FACTURA_USD);
      return;
    }
    setSaving(true);
    try {
      const comprobanteUrl = config.showComprobanteAdjunto
        ? draft.comprobanteFile
          ? await uploadComprobante(
              () => configRef.current.getToken(),
              draft.comprobanteFile,
              "facturacion",
            )
          : draft.comprobanteUrl
        : undefined;
      const factura = await apiJson<Factura>(
        configRef.current.apiUrlFacturasCreate,
        () => configRef.current.getToken(),
        {
          method: "POST",
          body: JSON.stringify(facturaPayloadFromDraft(draft, comprobanteUrl)),
        },
      );
      setCreating(false);
      setDraft(emptyFacturaDraft());
      onSuccess?.(factura);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la factura.");
    } finally {
      setSaving(false);
    }
  }

  return {
    creating,
    draft,
    setDraft,
    saving,
    error,
    viajes,
    viajesNueva,
    viajesLoading,
    ensureViajesLoaded,
    prepararDraftParaViaje,
    abrir,
    abrirParaViaje,
    cancelar,
    handleCreate,
  };
}

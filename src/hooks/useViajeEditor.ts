import { useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { friendlyError } from "@/lib/friendlyError";
import {
  formatNumberForMoneda,
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
} from "@/lib/currencyMask";
import {
  choferesFlotaPropia,
  flotaPropiaVehiculosListaValida,
  entidadesMaestroStubsDesdeViaje,
  maestroListasParaEdicionViaje,
  mantenerIdSiEnLista,
  mergeMaestroPorId,
  mensajesAyudaFlotaPropia,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
  mensajeErrorTransportistaEfectivoExterno,
  transportistaEfectivoIdDesdeViaje,
  type MaestroListasViaje,
} from "@/lib/viajesFlota";
import type { ViajeInlineDraft } from "@/components/viajes/ViajeEditModal";
import { gananciaBrutaManualPayloadFromDraft } from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import { draftRequiereGananciaBrutaManual } from "@/lib/viajesGananciaBruta";
import {
  otroGastoDraftFromApi,
  otroGastoDraftToApi,
} from "@/components/viajes/OtrosGastosFieldset";
import {
  pagoTransportistaDraftFromApi,
  pagosTransportistaDraftsToApi,
} from "@/components/viajes/PagosTransportistaFieldset";
import {
  esEtiquetaCiudadValida,
  inferirPaisDesdeUbicacion,
} from "@/lib/ciudades";
import { fechaHoraToIso, isoToFechaHora } from "@/lib/viajeFechaHora";
import { productoItemsDesdeViaje, mergeOpcionesProducto } from "@/lib/productosViaje";
import {
  destinosPayloadParaApi,
  destinosRowsDesdeViaje,
  etiquetasDestinosDesdeViaje,
  validarDestinosRows,
  viajeConDestinosEnRespuesta,
} from "@/lib/viajesDestinos";
import { validarPagosTransportistaDraftForm } from "@/lib/viajesTransportistaPagos";
import type {
  Chofer,
  Cliente,
  Producto,
  Transportista,
  Vehiculo,
  Viaje,
} from "@/types/api";

export type UseViajeEditorConfig = {
  getToken: () => Promise<string | null>;
  /** Construye la URL de la API para un viaje puntual (distinta en modo superadmin/platform). */
  apiUrlParaViaje: (id: string) => string;
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
  /** Recarga las listas maestro desde el servidor antes de abrir el editor. */
  refreshMaestroListas: () => Promise<MaestroListasViaje>;
  /** Notifica que se creó una entidad "al vuelo" desde el modal (cliente/chofer/transportista/vehículo). */
  onEntityCreated?: <K extends keyof MaestroListasViaje>(
    key: K,
    item: MaestroListasViaje[K][number],
  ) => void;
  /** El viaje se releyó de la API antes de editar (para sincronizar un listado externo). */
  onViajeRefetched?: (viaje: Viaje) => void;
  /** El viaje se guardó con éxito. */
  onViajeSaved?: (viaje: Viaje) => void;
  /** Catálogo de productos activos (stock) para el selector del modal; si se omite, solo se ven los ya cargados en el viaje. */
  fetchProductosCatalogo?: () => Promise<Producto[]>;
};

function mensajeErrorTransportistaEfectivoExternoLocal(
  draft: ViajeInlineDraft,
): string | null {
  return mensajeErrorTransportistaEfectivoExterno(draft);
}

export function useViajeEditor(config: UseViajeEditorConfig) {
  const configRef = useRef(config);
  configRef.current = config;

  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fechaCargaError, setFechaCargaError] = useState<string | null>(null);
  const [destinosError, setDestinosError] = useState<string | null>(null);
  const [transportistaEfectivoError, setTransportistaEfectivoError] =
    useState<string | null>(null);
  const [fechaDescargaError, setFechaDescargaError] = useState<string | null>(
    null,
  );
  const [viajeEditHint, setViajeEditHint] = useState<string | null>(null);
  const [edicionMaestro, setEdicionMaestro] =
    useState<MaestroListasViaje | null>(null);
  const [sessionMaestro, setSessionMaestro] = useState<MaestroListasViaje>({
    clientes: [],
    choferes: [],
    transportistas: [],
    vehiculos: [],
  });
  const [viajeSnapshot, setViajeSnapshot] = useState<Viaje | null>(null);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const productosCatalogoCargadoRef = useRef(false);

  const { choferes, vehiculos } = config;

  const choferesPropios = choferesFlotaPropia(
    edicionMaestro?.choferes ?? choferes,
  );
  const vehiculosPropios = vehiculosFlotaPropia(
    edicionMaestro?.vehiculos ?? vehiculos,
  );
  const ayudaFlota = edicionMaestro
    ? mensajesAyudaFlotaPropia(edicionMaestro.choferes, edicionMaestro.vehiculos)
    : mensajesAyudaFlotaPropia(choferes, vehiculos);
  const opcionesProducto = mergeOpcionesProducto(productosCatalogo, viajeSnapshot);
  const viajesConFactura = new Set<string>(
    viajeSnapshot?.facturaId ? [viajeSnapshot.id] : [],
  );

  // Cuando cambiamos a modo "propio" con un chofer que ya no está en la lista de flota propia, lo limpiamos.
  useEffect(() => {
    if (!editingId || !draft || draft.operacionModo !== "propio") return;
    setDraft((p) => {
      if (!p || p.operacionModo !== "propio") return p;
      const cid = mantenerIdSiEnLista(p.choferId, choferesPropios);
      if (cid === p.choferId) return p;
      return { ...p, choferId: cid };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, draft?.operacionModo, choferesPropios]);

  useEffect(() => {
    if (draft?.operacionModo === "externo") setViajeEditHint(null);
  }, [draft?.operacionModo]);

  async function cargarProductosCatalogoSiHaceFalta() {
    if (productosCatalogoCargadoRef.current) return;
    productosCatalogoCargadoRef.current = true;
    const fetchFn = configRef.current.fetchProductosCatalogo;
    if (!fetchFn) return;
    try {
      const items = await fetchFn();
      setProductosCatalogo(items);
    } catch {
      setProductosCatalogo([]);
    }
  }

  function startEdit(
    v: Viaje,
    origen: "listado" | "remoto" = "listado",
    listas: MaestroListasViaje = {
      clientes: configRef.current.clientes,
      choferes: configRef.current.choferes,
      transportistas: configRef.current.transportistas,
      vehiculos: configRef.current.vehiculos,
    },
  ) {
    setViajeSnapshot(v);
    setError(null);
    setDestinosError(null);
    setEditingId(v.id);
    const esExterno = !!(v.transportistaId ?? "").trim();
    const esPropio =
      !!(v.choferId ?? "").trim() ||
      (v.vehiculosViaje && v.vehiculosViaje.length > 0);
    const chRow = listas.choferes.find((c) => c.id === v.choferId);
    const choferesPropiosEdit = choferesFlotaPropia(listas.choferes);
    const vehiculosPropiosEdit = vehiculosFlotaPropia(listas.vehiculos);
    const partes: string[] = [];
    if (!esExterno && v.choferId && chRow?.transportistaId) {
      partes.push(
        "El chofer asociado a este viaje figura con transportista externo en su ficha; elegí uno de flota propia o actualizá el chofer.",
      );
    }
    if (!esExterno && v.vehiculosViaje?.length) {
      for (const vv of v.vehiculosViaje) {
        const vr = listas.vehiculos.find((x) => x.id === vv.vehiculoId);
        if (vr?.transportistaId) {
          partes.push(
            "Algún vehículo del viaje figura con transportista externo en su ficha; elegí flota propia o actualizá el maestro.",
          );
          break;
        }
      }
    }
    setViajeEditHint(partes.length ? partes.join(" ") : null);
    const partesFc = isoToFechaHora(v.fechaCarga);
    const partesFd = isoToFechaHora(v.fechaDescarga);

    setDraft({
      numero: v.numero ?? "",
      estado: v.estado ?? "pendiente",
      operacionModo: esExterno ? "externo" : esPropio ? "propio" : null,
      choferId: mantenerIdSiEnLista(v.choferId, choferesPropiosEdit),
      choferExternoId: esExterno
        ? mantenerIdSiEnLista(v.choferId, listas.choferes)
        : "",
      transportistaId: mantenerIdSiEnLista(
        v.transportistaId,
        listas.transportistas,
      ),
      vehiculosRows:
        v.vehiculosViaje && v.vehiculosViaje.length > 0
          ? [...v.vehiculosViaje]
              .sort((a, b) => a.orden - b.orden)
              .map((x) => ({
                tipo: (x.vehiculo?.tipo ?? "tractor").toLowerCase(),
                vehiculoId: esExterno
                  ? String(x.vehiculoId ?? "").trim()
                  : mantenerIdSiEnLista(x.vehiculoId, vehiculosPropiosEdit),
              }))
          : !esExterno
            ? [{ tipo: "tractor", vehiculoId: "" }]
            : [],
      clienteId:
        mantenerIdSiEnLista(v.clienteId, listas.clientes) || v.clienteId || "",
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ""),
      origen: v.origen ?? "",
      destinosRows: destinosRowsDesdeViaje(v),
      fechaCarga: partesFc.fecha,
      horaCarga: partesFc.hora,
      fechaDescarga: partesFd.fecha,
      horaDescarga: partesFd.hora,
      productoItems: productoItemsDesdeViaje(v),
      detalleCarga: v.detalleCarga ?? "",
      observaciones: v.observaciones ?? "",
      monto: formatNumberForMoneda(v.monto, normalizeViajeMoneda(v.monedaMonto)),
      monedaMonto: normalizeViajeMoneda(v.monedaMonto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : "",
      litrosConsumidos:
        v.litrosConsumidos != null ? String(v.litrosConsumidos) : "",
      precioTransportistaExterno: formatNumberForMoneda(
        v.precioTransportistaExterno,
        normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
      ),
      monedaPrecioTransportistaExterno: normalizeViajeMoneda(
        v.monedaPrecioTransportistaExterno,
      ),
      gananciaBrutaManual: formatNumberForMoneda(
        v.gananciaBrutaManual,
        normalizeViajeMoneda(v.monedaGananciaBrutaManual ?? v.monedaMonto),
      ),
      monedaGananciaBrutaManual: normalizeViajeMoneda(
        v.monedaGananciaBrutaManual ?? v.monedaMonto,
      ),
      otrosGastos: (v.otrosGastos ?? []).map(otroGastoDraftFromApi),
      pagosTransportista: (v.pagosTransportista ?? []).map(
        pagoTransportistaDraftFromApi,
      ),
      realizaFlete: !transportistaEfectivoIdDesdeViaje(v),
      transportistaEfectivoId: mantenerIdSiEnLista(
        transportistaEfectivoIdDesdeViaje(v),
        listas.transportistas,
      ),
    });
    // origen es informativo únicamente (deep-link "remoto" vs. fila de listado):
    // no cambia ningún dato adicional del draft respecto a lo ya calculado arriba.
    void origen;
  }

  /** Carga el viaje desde la API antes de abrir el editor (evita datos viejos). */
  async function beginEditViaje(
    v: Viaje,
    origen: "listado" | "remoto" = "listado",
  ) {
    void cargarProductosCatalogoSiHaceFalta();
    let viaje = v;
    if (origen === "listado") {
      try {
        viaje = await apiJson<Viaje>(
          configRef.current.apiUrlParaViaje(v.id),
          () => configRef.current.getToken(),
        );
        configRef.current.onViajeRefetched?.(viaje);
      } catch {
        /* usar fila del listado */
      }
    }
    try {
      const fresh = await configRef.current.refreshMaestroListas();
      const conSesion: MaestroListasViaje = {
        clientes: mergeMaestroPorId(fresh.clientes, sessionMaestro.clientes),
        choferes: mergeMaestroPorId(fresh.choferes, sessionMaestro.choferes),
        transportistas: mergeMaestroPorId(
          fresh.transportistas,
          sessionMaestro.transportistas,
        ),
        vehiculos: mergeMaestroPorId(fresh.vehiculos, sessionMaestro.vehiculos),
      };
      const merged = maestroListasParaEdicionViaje(viaje, conSesion);
      setEdicionMaestro(merged);
      startEdit(viaje, origen, merged);
    } catch {
      const conSesion: MaestroListasViaje = {
        clientes: mergeMaestroPorId(
          configRef.current.clientes,
          sessionMaestro.clientes,
        ),
        choferes: mergeMaestroPorId(
          configRef.current.choferes,
          sessionMaestro.choferes,
        ),
        transportistas: mergeMaestroPorId(
          configRef.current.transportistas,
          sessionMaestro.transportistas,
        ),
        vehiculos: mergeMaestroPorId(
          configRef.current.vehiculos,
          sessionMaestro.vehiculos,
        ),
      };
      const merged = maestroListasParaEdicionViaje(viaje, conSesion);
      setEdicionMaestro(merged);
      startEdit(viaje, origen, merged);
    }
  }

  /** Fusiona entidades creadas fuera de este editor (ej. hand-off desde "Crear viaje") a la sesión. */
  function seedSessionMaestro(incoming: MaestroListasViaje) {
    setSessionMaestro((prev) => ({
      clientes: mergeMaestroPorId(prev.clientes, incoming.clientes),
      choferes: mergeMaestroPorId(prev.choferes, incoming.choferes),
      transportistas: mergeMaestroPorId(
        prev.transportistas,
        incoming.transportistas,
      ),
      vehiculos: mergeMaestroPorId(prev.vehiculos, incoming.vehiculos),
    }));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEdicionMaestro(null);
    setViajeSnapshot(null);
    setViajeEditHint(null);
    setFechaCargaError(null);
    setFechaDescargaError(null);
    setDestinosError(null);
    setTransportistaEfectivoError(null);
  }

  function applyDraftModo(m: NonNullable<ViajeInlineDraft["operacionModo"]>) {
    setDraft((p) =>
      p
        ? {
            ...p,
            operacionModo: m,
            ...(m === "externo"
              ? { choferId: "", vehiculosRows: [] }
              : {
                  transportistaId: "",
                  realizaFlete: true,
                  transportistaEfectivoId: "",
                  choferExternoId: "",
                  pagosTransportista: [],
                  choferId: mantenerIdSiEnLista(p.choferId, choferesPropios),
                  vehiculosRows:
                    p.vehiculosRows.length > 0
                      ? p.vehiculosRows
                      : [{ tipo: "tractor", vehiculoId: "" }],
                }),
          }
        : p,
    );
  }

  function upsertMaestroEdicion<K extends keyof MaestroListasViaje>(
    key: K,
    item: MaestroListasViaje[K][number],
  ) {
    const mergeOne = <T extends { id: string }>(prev: T[]) =>
      mergeMaestroPorId(prev, [item as unknown as T]);
    setSessionMaestro(
      (prev) =>
        ({
          ...prev,
          [key]: mergeOne(prev[key] as { id: string }[]),
        }) as MaestroListasViaje,
    );
    setEdicionMaestro((prev) =>
      prev
        ? ({
            ...prev,
            [key]: mergeOne(prev[key] as { id: string }[]),
          } as MaestroListasViaje)
        : prev,
    );
    configRef.current.onEntityCreated?.(key, item);
  }

  async function saveInline() {
    const viajeId = editingId;
    if (!viajeId || !draft) return;
    if (!draft.numero.trim()) {
      setError("Ingresá el número de viaje.");
      return;
    }
    if (!draft.destinosRows[0]?.etiqueta.trim()) {
      setDestinosError("Ingresá el destino 1.");
      return;
    }
    const externo = draft.operacionModo === "externo";
    if (externo && !draft.transportistaId.trim()) {
      setError("Seleccioná un transportista externo.");
      return;
    }
    const teErr = mensajeErrorTransportistaEfectivoExternoLocal(draft);
    if (teErr) {
      setTransportistaEfectivoError(teErr);
      setError(teErr);
      return;
    }
    setTransportistaEfectivoError(null);
    const vids = vehiculoIdsDesdeRows(draft.vehiculosRows);
    if (!externo && vids.length === 0) {
      setError(
        "Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).",
      );
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(
        draft.choferId,
        vids,
        choferesPropios,
        vehiculosPropios,
      )
    ) {
      setError(
        "En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).",
      );
      return;
    }
    const o = draft.origen.trim();
    if (o) {
      const okO = await esEtiquetaCiudadValida(draft.paisOrigen, o);
      if (!okO) {
        setError(
          "El origen debe elegirse de la lista de ciudades (no se admite texto libre).",
        );
        return;
      }
    }
    const destinosVal = await validarDestinosRows(draft.destinosRows);
    if (!destinosVal.ok) {
      setDestinosError(destinosVal.message);
      return;
    }
    setDestinosError(null);
    const fcError = !draft.fechaCarga.trim() ? "Ingresá la fecha de carga." : null;
    const fdError = !draft.fechaDescarga.trim()
      ? "Ingresá la fecha de descarga."
      : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(fdError);
    if (fcError || fdError) return;
    if (draft.fechaDescarga < draft.fechaCarga) {
      setFechaDescargaError(
        "La fecha de descarga no puede ser anterior a la de carga.",
      );
      return;
    }
    if (draftRequiereGananciaBrutaManual(draft)) {
      const manualPayload = gananciaBrutaManualPayloadFromDraft(draft);
      if (manualPayload.gananciaBrutaManual == null) {
        setError(
          "Ingresá la ganancia bruta manual: las monedas de facturación y del transportista son distintas.",
        );
        return;
      }
    }
    const precioTransportistaNum = parseCurrencyForMoneda(
      draft.precioTransportistaExterno,
      draft.monedaPrecioTransportistaExterno,
    );
    const pagosTransportistaApi = pagosTransportistaDraftsToApi(
      draft.pagosTransportista,
    );
    const pagoTransportistaError = externo
      ? validarPagosTransportistaDraftForm({
          transportistaId: draft.transportistaId.trim(),
          precioTransportistaExterno: draft.precioTransportistaExterno,
          monedaPrecioTransportistaExterno:
            draft.monedaPrecioTransportistaExterno,
          pagosTransportista: draft.pagosTransportista,
        })
      : null;
    if (pagoTransportistaError) {
      setError(pagoTransportistaError);
      return;
    }

    const kmResolved = draft.kmRecorridos.trim()
      ? Number(draft.kmRecorridos.replace(",", "."))
      : undefined;
    const litResolved = draft.litrosConsumidos.trim()
      ? Number(draft.litrosConsumidos.replace(",", "."))
      : undefined;
    setSavingId(viajeId);
    setError(null);
    try {
      const destinosBody = destinosPayloadParaApi(destinosVal.destinos);
      const updated = await apiJson<Viaje>(
        configRef.current.apiUrlParaViaje(viajeId),
        () => configRef.current.getToken(),
        {
          method: "PATCH",
          body: JSON.stringify({
            numero: draft.numero.trim(),
            estado: draft.estado,
            clienteId: draft.clienteId || undefined,
            ...(externo
              ? {
                  transportistaId: draft.transportistaId.trim(),
                  contratanteRealizaFlete: draft.realizaFlete,
                  transportistaEfectivoId: draft.realizaFlete
                    ? null
                    : draft.transportistaEfectivoId.trim() || null,
                  choferId: draft.choferExternoId.trim() || null,
                  vehiculoIds: vids,
                }
              : {
                  transportistaId: null,
                  transportistaEfectivoId: null,
                  choferId: draft.choferId.trim() || null,
                  vehiculoIds: vids,
                }),
            origen: draft.origen.trim() || undefined,
            ...destinosBody,
            fechaCarga: fechaHoraToIso(draft.fechaCarga, draft.horaCarga),
            fechaDescarga: fechaHoraToIso(
              draft.fechaDescarga,
              draft.horaDescarga,
            ),
            productoItems: draft.productoItems.filter((x) =>
              x.productoId.trim(),
            ),
            detalleCarga: draft.detalleCarga.trim() || undefined,
            observaciones: draft.observaciones.trim() || undefined,
            monto: parseCurrencyForMoneda(draft.monto, draft.monedaMonto),
            monedaMonto: draft.monedaMonto,
            kmRecorridos: kmResolved,
            litrosConsumidos: litResolved,
            precioTransportistaExterno: precioTransportistaNum,
            monedaPrecioTransportistaExterno:
              draft.monedaPrecioTransportistaExterno,
            ...gananciaBrutaManualPayloadFromDraft(draft),
            otrosGastos: draft.otrosGastos
              .map(otroGastoDraftToApi)
              .filter(Boolean),
            pagosTransportista: externo ? pagosTransportistaApi : [],
          }),
        },
      );

      let viajeGuardado = viajeConDestinosEnRespuesta(
        updated,
        destinosVal.destinos,
      );
      if (
        etiquetasDestinosDesdeViaje(viajeGuardado).length <
        destinosVal.destinos.length
      ) {
        try {
          viajeGuardado = await apiJson<Viaje>(
            configRef.current.apiUrlParaViaje(viajeId),
            () => configRef.current.getToken(),
          );
        } catch {
          /* mantener respuesta del PATCH */
        }
        viajeGuardado = viajeConDestinosEnRespuesta(
          viajeGuardado,
          destinosVal.destinos,
        );
      }

      configRef.current.onViajeSaved?.(viajeGuardado);
      showToast("Viaje guardado exitosamente", "success");

      const stubs = entidadesMaestroStubsDesdeViaje(updated);
      setSessionMaestro((prev) => ({
        clientes: mergeMaestroPorId(prev.clientes, stubs.clientes),
        choferes: mergeMaestroPorId(prev.choferes, stubs.choferes),
        transportistas: mergeMaestroPorId(
          prev.transportistas,
          stubs.transportistas,
        ),
        vehiculos: mergeMaestroPorId(prev.vehiculos, stubs.vehiculos),
      }));
      cancelEdit();
    } catch (e) {
      setError(friendlyError(e, "viajes"));
      showToast("No se pudo guardar el viaje", "error");
    } finally {
      setSavingId(null);
    }
  }

  return {
    editingId,
    draft,
    setDraft,
    saving: savingId === editingId && editingId !== null,
    error,
    setError,
    fechaCargaError,
    fechaDescargaError,
    destinosError,
    transportistaEfectivoError,
    viajeEditHint,
    edicionMaestro,
    viajeSnapshot,
    choferesPropios,
    vehiculosPropios,
    ayudaFlota,
    opcionesProducto,
    viajesConFactura,
    beginEditViaje,
    cancelEdit,
    saveInline,
    applyDraftModo,
    upsertMaestroEdicion,
    onProductoCreado: (p: Producto) =>
      setProductosCatalogo((prev) => [...prev, p]),
    onDraftFechasPatch: (
      p: Partial<
        Pick<
          ViajeInlineDraft,
          "fechaCarga" | "horaCarga" | "fechaDescarga" | "horaDescarga"
        >
      >,
    ) => {
      setDraft((prev) => (prev ? { ...prev, ...p } : prev));
      if (p.fechaCarga) setFechaCargaError(null);
      if (p.fechaDescarga) setFechaDescargaError(null);
    },
    onClearDestinosError: () => setDestinosError(null),
    onClearTransportistaEfectivoError: () => setTransportistaEfectivoError(null),
    seedSessionMaestro,
  };
}

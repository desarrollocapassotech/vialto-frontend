import { useAuth, useOrganization } from "@clerk/clerk-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TenantOwnerDashboard,
  AlertsPanel,
} from "@/components/tenant/TenantOwnerDashboard";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeEditModal } from "@/components/viajes/ViajeEditModal";
import { TipoFacturaClienteModal } from "@/components/viajes/TipoFacturaClienteModal";
import { EmitirCvlpModal } from "@/components/viajes/EmitirCvlpModal";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import { FacturaCreateModal } from "@/components/facturacion/FacturaEditModal";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useViajeEditor } from "@/hooks/useViajeEditor";
import { useFacturaCreator } from "@/hooks/useFacturaCreator";
import { useToast } from "@/lib/toast";
import { apiJson } from "@/lib/api";
import {
  canAccessCombustible,
  canAccessFacturacion,
  canAccessIntegracionArca,
  canAccessViajes,
} from "@/lib/tenantModules";
import {
  MSG_ARCA_NO_FACTURA_USD,
  MSG_ARCA_NO_LIQUIDA_USD,
  arcaBloqueaFacturarUsd,
  arcaBloqueaLiquidarUsd,
} from "@/lib/arcaUsdRestriction";
import {
  viajePermiteBotonFacturar,
  viajePendienteComprobanteTransportista,
} from "@/lib/viajesComprobantes";
import type { Factura, Producto, Viaje } from "@/types/api";

export function TenantHomePage() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { tenant, loading, error } = useCurrentTenant();
  const dash = useTenantOwnerDashboard();
  const maestro = useMaestroData();
  const { showToast } = useToast();
  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);
  const [loadingFacturaId, setLoadingFacturaId] = useState<string | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [loadingViajeId, setLoadingViajeId] = useState<string | null>(null);
  const [abriendoEditorViaje, setAbriendoEditorViaje] = useState(false);
  const [facturaLetraViaje, setFacturaLetraViaje] = useState<Viaje | null>(
    null,
  );
  const [abriendoFacturar, setAbriendoFacturar] = useState(false);
  const [emitirCvlpViaje, setEmitirCvlpViaje] = useState<Viaje | null>(null);
  const [crearLiqViaje, setCrearLiqViaje] = useState<Viaje | null>(null);

  const hasArca = canAccessIntegracionArca(tenant?.modules ?? []);
  const facturaCreator = useFacturaCreator({
    getToken,
    apiUrlViajes: "/api/viajes",
    apiUrlFacturasCreate: "/api/facturacion/facturas",
    hasArca,
    showComprobanteAdjunto: !hasArca,
  });

  const viajeEditor = useViajeEditor({
    getToken,
    apiUrlParaViaje: (id) => `/api/viajes/${encodeURIComponent(id)}`,
    clientes: maestro.clientes,
    choferes: maestro.choferes,
    transportistas: maestro.transportistas,
    vehiculos: maestro.vehiculos,
    refreshMaestroListas: async () => {
      const [clientes, choferes, transportistas, vehiculos] = await Promise.all(
        [
          maestro.refreshClientes(),
          maestro.refreshChoferes(),
          maestro.refreshTransportistas(),
          maestro.refreshVehiculos(),
        ],
      );
      return { clientes, choferes, transportistas, vehiculos };
    },
    fetchProductosCatalogo: async () => {
      const d = await apiJson<{ items: Producto[] }>(
        "/api/stock/productos/paginated?page=1&pageSize=100&filtroActivo=activos",
        () => getToken(),
      );
      return d.items;
    },
  });

  async function handleViewFactura(id: string) {
    setLoadingFacturaId(id);
    try {
      const factura = await apiJson<Factura>(
        `/api/facturacion/facturas/${encodeURIComponent(id)}`,
        () => getToken(),
      );
      setViewingFactura(factura);
    } catch {
      // silencioso
    } finally {
      setLoadingFacturaId(null);
    }
  }

  async function handleViewViaje(id: string) {
    setLoadingViajeId(id);
    try {
      const viaje = await apiJson<Viaje>(
        `/api/viajes/${encodeURIComponent(id)}`,
        () => getToken(),
      );
      setViewingViaje(viaje);
    } catch {
      // silencioso
    } finally {
      setLoadingViajeId(null);
    }
  }

  const companyName =
    tenant?.name?.trim() || organization?.name?.trim() || "empresa";

  const alertas = dash.data?.alertas;
  const showAlertsBlock =
    tenant != null &&
    (canAccessFacturacion(tenant.modules) ||
      canAccessCombustible(tenant.modules) ||
      canAccessViajes(tenant.modules)) &&
    alertas != null &&
    (alertas.facturasVencidas.cantidad > 0 ||
      alertas.viajesSinFactura.cantidad > 0 ||
      (alertas.cargasSospechosas?.cantidad ?? 0) > 0 ||
      (alertas.margenBajo?.cantidad ?? 0) > 0);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
            Panel de {companyName}
          </h1>
        </div>

        {showAlertsBlock && alertas && (
          <AlertsPanel
            alertas={alertas}
            onViewFactura={(id) => void handleViewFactura(id)}
            loadingFacturaId={loadingFacturaId}
            onViewViaje={(id) => void handleViewViaje(id)}
            loadingViajeId={loadingViajeId}
            shouldClose={
              viewingFactura !== null ||
              viewingViaje !== null ||
              viajeEditor.editingId !== null ||
              facturaLetraViaje !== null ||
              facturaCreator.creating ||
              emitirCvlpViaje !== null ||
              crearLiqViaje !== null
            }
          />
        )}
      </div>

      {!organization && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          Elegí una empresa para cargar el inicio con sus módulos contratados.
        </div>
      )}

      {error && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      {organization && loading && !error && (
        <p className="mt-6 text-sm text-vialto-steel">
          Cargando datos de tu empresa…
        </p>
      )}

      {organization && !loading && !error && tenant && (
        <TenantOwnerDashboard
          tenantId={tenant.id}
          modules={tenant.modules}
          dash={dash}
          onViewViaje={(id) => void handleViewViaje(id)}
          loadingViajeId={loadingViajeId}
        />
      )}

      {viewingFactura && (
        <FacturaViewModal
          factura={viewingFactura}
          onClose={() => setViewingFactura(null)}
          onEditar={() => {
            const id = viewingFactura.id;
            setViewingFactura(null);
            navigate("/facturacion", { state: { expandFacturaId: id } });
          }}
        />
      )}

      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          editando={abriendoEditorViaje}
          facturando={abriendoFacturar}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const v = viewingViaje;
            void (async () => {
              setAbriendoEditorViaje(true);
              try {
                await viajeEditor.beginEditViaje(v, "remoto");
                setViewingViaje(null);
              } finally {
                setAbriendoEditorViaje(false);
              }
            })();
          }}
          onFacturar={
            tenant &&
            canAccessFacturacion(tenant.modules) &&
            viajePermiteBotonFacturar(viewingViaje)
              ? () => {
                  const v = viewingViaje;
                  if (arcaBloqueaFacturarUsd(hasArca, v.monedaMonto)) {
                    showToast(MSG_ARCA_NO_FACTURA_USD, "error");
                    return;
                  }
                  setViewingViaje(null);
                  // Tipo A/B solo aplica con integración ARCA.
                  if (hasArca) {
                    setFacturaLetraViaje(v);
                    return;
                  }
                  void (async () => {
                    setAbriendoFacturar(true);
                    try {
                      facturaCreator.prepararDraftParaViaje(v);
                      await facturaCreator.ensureViajesLoaded();
                      facturaCreator.abrir();
                    } finally {
                      setAbriendoFacturar(false);
                    }
                  })();
                }
              : undefined
          }
          onLiquidar={
            tenant &&
            canAccessViajes(tenant.modules) &&
            viajePendienteComprobanteTransportista(viewingViaje)
              ? () => {
                  const v = viewingViaje;
                  if (
                    arcaBloqueaLiquidarUsd(
                      hasArca,
                      v.monedaPrecioTransportistaExterno,
                    )
                  ) {
                    showToast(MSG_ARCA_NO_LIQUIDA_USD, "error");
                    return;
                  }
                  if (hasArca) {
                    setEmitirCvlpViaje(v);
                  } else {
                    setCrearLiqViaje(v);
                  }
                  setViewingViaje(null);
                }
              : undefined
          }
        />
      )}

      {emitirCvlpViaje && (
        <EmitirCvlpModal
          viaje={emitirCvlpViaje}
          onClose={() => setEmitirCvlpViaje(null)}
          onEmitido={() => setEmitirCvlpViaje(null)}
        />
      )}

      {crearLiqViaje && (
        <CrearLiquidacionManualModal
          viajeInicial={crearLiqViaje}
          transportistas={maestro.transportistas}
          hasArca={hasArca}
          getToken={getToken}
          onSuccess={() => setCrearLiqViaje(null)}
          onClose={() => setCrearLiqViaje(null)}
        />
      )}

      {facturaLetraViaje && (
        <TipoFacturaClienteModal
          viaje={facturaLetraViaje}
          busy={abriendoFacturar}
          onClose={() => setFacturaLetraViaje(null)}
          onConfirm={(letra) => {
            const v = facturaLetraViaje;
            void (async () => {
              setAbriendoFacturar(true);
              try {
                facturaCreator.prepararDraftParaViaje(v, letra);
                await facturaCreator.ensureViajesLoaded();
                facturaCreator.abrir();
                setFacturaLetraViaje(null);
              } finally {
                setAbriendoFacturar(false);
              }
            })();
          }}
        />
      )}

      <FacturaCreateModal
        open={facturaCreator.creating}
        draft={facturaCreator.draft}
        setDraft={facturaCreator.setDraft}
        clientes={maestro.clientes}
        transportistas={maestro.transportistas}
        viajes={facturaCreator.viajes}
        viajesNueva={facturaCreator.viajesNueva}
        viajesLoading={facturaCreator.viajesLoading}
        onClose={facturaCreator.cancelar}
        onSave={() => void facturaCreator.handleCreate()}
        saving={facturaCreator.saving}
        error={facturaCreator.error}
        showComprobanteAdjunto={!hasArca}
      />

      {viajeEditor.editingId &&
        viajeEditor.draft &&
        viajeEditor.viajeSnapshot && (
          <ViajeEditModal
            open
            draft={viajeEditor.draft}
            setDraft={viajeEditor.setDraft}
            snapshotViaje={viajeEditor.viajeSnapshot}
            opcionesProducto={viajeEditor.opcionesProducto}
            clientes={viajeEditor.edicionMaestro?.clientes ?? maestro.clientes}
            choferes={viajeEditor.edicionMaestro?.choferes ?? maestro.choferes}
            transportistas={
              viajeEditor.edicionMaestro?.transportistas ??
              maestro.transportistas
            }
            vehiculos={
              viajeEditor.edicionMaestro?.vehiculos ?? maestro.vehiculos
            }
            choferesPropios={viajeEditor.choferesPropios}
            vehiculosPropios={viajeEditor.vehiculosPropios}
            viajesConFactura={viajeEditor.viajesConFactura}
            onModoChange={viajeEditor.applyDraftModo}
            ayudaFlota={viajeEditor.ayudaFlota}
            viajeEditHint={viajeEditor.viajeEditHint}
            fechaCargaError={viajeEditor.fechaCargaError}
            fechaDescargaError={viajeEditor.fechaDescargaError}
            destinosError={viajeEditor.destinosError}
            onClearDestinosError={viajeEditor.onClearDestinosError}
            transportistaEfectivoError={viajeEditor.transportistaEfectivoError}
            onClearTransportistaEfectivoError={
              viajeEditor.onClearTransportistaEfectivoError
            }
            onDraftFechasPatch={viajeEditor.onDraftFechasPatch}
            onClose={viajeEditor.cancelEdit}
            onSave={() => void viajeEditor.saveInline()}
            saving={viajeEditor.saving}
            error={viajeEditor.error}
            getToken={getToken}
            onProductoCreado={viajeEditor.onProductoCreado}
            onClienteCreado={(c) =>
              viajeEditor.upsertMaestroEdicion("clientes", c)
            }
            onTransportistaCreado={(t) =>
              viajeEditor.upsertMaestroEdicion("transportistas", t)
            }
            onChoferCreado={(c) =>
              viajeEditor.upsertMaestroEdicion("choferes", c)
            }
            onVehiculoCreado={(v) =>
              viajeEditor.upsertMaestroEdicion("vehiculos", v)
            }
          />
        )}
    </div>
  );
}

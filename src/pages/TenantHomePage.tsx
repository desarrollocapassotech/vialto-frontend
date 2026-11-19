import { useAuth, useOrganization, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { mutate } from "swr";
import { isOrgAdmin } from "@/lib/roleLabels";
import { useNavigate } from "react-router-dom";
import { TenantOwnerDashboard } from "@/components/tenant/TenantOwnerDashboard";
import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { ViajeEditModal } from "@/components/viajes/ViajeEditModal";
import {
  type FacturaLetra,
  facturaLetraFromCondicionIva,
} from "@/lib/arcaCbteTipo";
import { CrearLiquidacionManualModal } from "@/components/liquidaciones/CrearLiquidacionManualModal";
import { FacturaCreateModal } from "@/components/facturacion/FacturaCreateModal";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useViajeEditor } from "@/hooks/useViajeEditor";
import { useFacturaCreator } from "@/hooks/useFacturaCreator";
import {
  idSistemaHabilitado,
  idPropio1Habilitado,
  idPropio2Habilitado,
  idPropio2Label,
  labelIdentificacionPersonalizadaViajes,
} from "@/lib/viajesFlota";
import { useToast } from "@/lib/toast";
import { apiJson } from "@/lib/api";
import {
  canAccessEmisionFacturasArca,
  canAccessEmisionLiquidoProductoArca,
  canAccessFacturacion,
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
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
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
  const [abriendoFacturar, setAbriendoFacturar] = useState(false);
  const [crearLiqViaje, setCrearLiqViaje] = useState<Viaje | null>(null);

  const hasFacturasArca = canAccessEmisionFacturasArca(tenant?.modules ?? []);
  const hasLiquidoProductoArca = canAccessEmisionLiquidoProductoArca(
    tenant?.modules ?? [],
  );
  const facturaCreator = useFacturaCreator({
    getToken,
    apiUrlViajes: "/api/viajes",
    apiUrlFacturasCreate: "/api/facturacion/facturas",
    hasArca: hasFacturasArca,
    showComprobanteAdjunto: !hasFacturasArca,
  });

  const viajeEditor = useViajeEditor({
    getToken,
    apiUrlParaViaje: (id) => `/api/viajes/${encodeURIComponent(id)}`,
    clientes: maestro.clientes,
    choferes: maestro.choferes,
    transportistas: maestro.transportistas,
    vehiculos: maestro.vehiculos,
    hasFacturasArca: hasFacturasArca,
    validarCiudades: tenant?.recomendacionCiudadesHabilitada !== false,
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

  const mostrarDashboard = Boolean(organization && !loading && !error && tenant);

  return (
    <div className="w-full">
      {/* Con el dashboard, el título lo dibuja él (al lado del filtro de período). */}
      {!mostrarDashboard && (
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
          Panel de {companyName}
        </h1>
      )}

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
        <CargandoVialto mensaje="Cargando el panel de tu empresa…" />
      )}

      {mostrarDashboard && organization && tenant && (
        <TenantOwnerDashboard
          titulo={`Panel de ${companyName}`}
          tenantId={organization.id}
          tenant={tenant}
          dash={dash}
          onViewViaje={(id) => void handleViewViaje(id)}
          loadingViajeId={loadingViajeId}
          onViewFactura={(id) => void handleViewFactura(id)}
          loadingFacturaId={loadingFacturaId}
          puedeEditar={isOrgAdmin({ orgRole, publicMetadata: user?.publicMetadata })}
          onGuardarBloques={async (dashboardBloques) => {
            const url = `/api/tenants/${encodeURIComponent(organization.id)}`;
            await apiJson(`${url}/dashboard-bloques`, () => getToken(), {
              method: "PATCH",
              body: JSON.stringify({ dashboardBloques }),
            });
            // Misma key que useCurrentTenant: el panel se redibuja con lo guardado.
            await mutate(url);
          }}
        />
      )}

      {viewingFactura && (
        <FacturaViewModal
          getToken={getToken}
          factura={viewingFactura}
          idPropio2Habilitado={idPropio2Habilitado(maestro.tenant)}
          idPropio2Label={idPropio2Label(maestro.tenant)}
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
          hasLiquidoProductoArca={hasLiquidoProductoArca}
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
            (canAccessFacturacion(tenant.modules) || hasFacturasArca) &&
            viajePermiteBotonFacturar(viewingViaje)
              ? () => {
                  const v = viewingViaje;
                  if (arcaBloqueaFacturarUsd(hasFacturasArca, v.monedaMonto)) {
                    showToast(MSG_ARCA_NO_FACTURA_USD, "error");
                    return;
                  }
                  setViewingViaje(null);
                  let letra: FacturaLetra | undefined;
                  if (hasFacturasArca) {
                    const cliente = maestro.clientes?.find((c) => c.id === v.clienteId);
                    letra = facturaLetraFromCondicionIva(cliente?.condicionIva ?? null);
                  }
                  void (async () => {
                    setAbriendoFacturar(true);
                    try {
                      facturaCreator.prepararDraftParaViaje(v, letra);
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
                      hasLiquidoProductoArca,
                      v.monedaPrecioTransportistaExterno,
                    )
                  ) {
                    showToast(MSG_ARCA_NO_LIQUIDA_USD, "error");
                    return;
                  }
                  setCrearLiqViaje(v);
                  setViewingViaje(null);
                }
              : undefined
          }
        />
      )}

      {crearLiqViaje && (
        <CrearLiquidacionManualModal
          viajeInicial={crearLiqViaje}
          transportistas={maestro.transportistas}
          hasLiquidoProductoArca={hasLiquidoProductoArca}
          getToken={getToken}
          idSistemaHabilitado={idSistemaHabilitado(maestro.tenant)}
          idPropio1Habilitado={idPropio1Habilitado(maestro.tenant)}
          idPropio1Label={labelIdentificacionPersonalizadaViajes(maestro.tenant)}
          idPropio2Habilitado={idPropio2Habilitado(maestro.tenant)}
          idPropio2Label={idPropio2Label(maestro.tenant)}
          opcionesProveedor={maestro.tenant?.opcionesProveedorLiquidacion}
          onDataSaved={() => {
            void maestro.refreshTransportistas();
            void maestro.refreshClientes();
          }}
          onSuccess={() => setCrearLiqViaje(null)}
          onClose={() => setCrearLiqViaje(null)}
        />
      )}

      <FacturaCreateModal
        open={facturaCreator.creating}
        draft={facturaCreator.draft}
        setDraft={facturaCreator.setDraft}
        clientes={maestro.clientes}
        viajes={facturaCreator.viajes}
        viajesNueva={facturaCreator.viajesNueva}
        viajesLoading={facturaCreator.viajesLoading}
        onClose={facturaCreator.cancelar}
        onSave={
          hasFacturasArca
            ? undefined
            : () => void facturaCreator.handleCreate()
        }
        saving={hasFacturasArca ? false : facturaCreator.saving}
        error={hasFacturasArca ? null : facturaCreator.error}
        showComprobanteAdjunto={!hasFacturasArca}
        hasArca={hasFacturasArca}
        idSistemaHabilitado={idSistemaHabilitado(maestro.tenant)}
        idPropio1Habilitado={idPropio1Habilitado(maestro.tenant)}
        idPropio1Label={labelIdentificacionPersonalizadaViajes(maestro.tenant)}
        idPropio2Habilitado={idPropio2Habilitado(maestro.tenant)}
        idPropio2Label={idPropio2Label(maestro.tenant)}
        getToken={getToken}
        facturasCreateUrl="/api/facturacion/facturas"
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
            choferesExterno={viajeEditor.choferesExterno}
            vehiculosPropios={viajeEditor.vehiculosPropios}
            onModoChange={viajeEditor.applyDraftModo}
            ayudaFlota={viajeEditor.ayudaFlota}
            viajeEditHint={viajeEditor.viajeEditHint}
            fechaCargaError={viajeEditor.fechaCargaError}
            fechaDescargaError={viajeEditor.fechaDescargaError}
            destinosError={viajeEditor.destinosError}
            onClearDestinosError={viajeEditor.onClearDestinosError}
            clientesRowErrors={viajeEditor.clientesRowErrors}
            onClearClientesRowErrors={viajeEditor.onClearClientesRowErrors}
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
            tenant={maestro.tenant}
            hasLiquidoProductoArca={hasLiquidoProductoArca}
            hasFacturasArca={hasFacturasArca}
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

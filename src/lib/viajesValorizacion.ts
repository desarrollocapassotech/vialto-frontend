import type { Viaje } from "@/types/api";

export interface EstadoValorizacionViaje {
  valorizado: boolean;
  faltaCliente: boolean;
  faltaTransportista: boolean;
  mensajePendiente: string | null;
}

export function evaluarValorizacionViaje(
  viaje: Pick<
    Viaje,
    | "monto"
    | "cantidadFactura"
    | "precioUnitarioFactura"
    | "transportistaId"
    | "transportistaEfectivoId"
    | "precioTransportistaExterno"
    | "cantidadTransportista"
    | "precioUnitarioTransportista"
  > & {
    clientesViaje?: Array<{
      monto?: number | null;
      cantidad?: number | null;
      precioUnitario?: number | null;
    }>;
  },
): EstadoValorizacionViaje {
  const tieneMontoPrincipal =
    (typeof viaje.monto === "number" && viaje.monto > 0) ||
    (typeof viaje.cantidadFactura === "number" &&
      viaje.cantidadFactura > 0 &&
      typeof viaje.precioUnitarioFactura === "number" &&
      viaje.precioUnitarioFactura > 0);

  let faltaCliente = !tieneMontoPrincipal;

  if (
    !faltaCliente &&
    Array.isArray(viaje.clientesViaje) &&
    viaje.clientesViaje.length > 0
  ) {
    const algunClienteSinMonto = viaje.clientesViaje.some((c) => {
      const tiene =
        (typeof c.monto === "number" && c.monto > 0) ||
        (typeof c.cantidad === "number" &&
          c.cantidad > 0 &&
          typeof c.precioUnitario === "number" &&
          c.precioUnitario > 0);
      return !tiene;
    });
    if (algunClienteSinMonto) {
      faltaCliente = true;
    }
  }

  const tieneTransportistaExterno = Boolean(
    viaje.transportistaId?.trim() || viaje.transportistaEfectivoId?.trim(),
  );

  let faltaTransportista = false;
  if (tieneTransportistaExterno) {
    const tieneMontoTransp =
      (typeof viaje.precioTransportistaExterno === "number" &&
        viaje.precioTransportistaExterno > 0) ||
      (typeof viaje.cantidadTransportista === "number" &&
        viaje.cantidadTransportista > 0 &&
        typeof viaje.precioUnitarioTransportista === "number" &&
        viaje.precioUnitarioTransportista > 0);
    faltaTransportista = !tieneMontoTransp;
  }

  const valorizado = !faltaCliente && !faltaTransportista;

  let mensajePendiente: string | null = null;
  if (faltaCliente && faltaTransportista) {
    mensajePendiente = "Faltan cargar los montos del cliente y del transportista";
  } else if (faltaCliente) {
    mensajePendiente = "Falta cargar el monto del cliente";
  } else if (faltaTransportista) {
    mensajePendiente = "Falta cargar el monto del transportista";
  }

  return {
    valorizado,
    faltaCliente,
    faltaTransportista,
    mensajePendiente,
  };
}


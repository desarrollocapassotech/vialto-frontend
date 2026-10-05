import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { BellOff, ChevronDown, ChevronRight, Settings, type LucideIcon } from "lucide-react";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { resolveNotificacionRoute } from "@/lib/notificacionRoutes";
import {
  avisosSinAgrupar,
  detalleCorto,
  EVENTO_NOTIFICACIONES_VISTAS,
  fechaRelativa,
  MAX_AVISOS_SIN_AGRUPAR,
  tipoNotificacionUI,
} from "@/lib/notificacionTipos";
import type {
  NotificacionFeed,
  NotificacionFeedGrupo,
  NotificacionFeedItem,
} from "@/types/notificaciones";

/** Avisos por grupo al cargar: al menos MAX_AVISOS_SIN_AGRUPAR, para tener todos cuando se listan sin agrupar. */
const POR_TIPO = MAX_AVISOS_SIN_AGRUPAR;
const VER_MAS_LIMIT = 5;
/** Cuánto queda resaltado un aviso no visto antes de desmarcarse. */
const RESALTE_MS = 4000;

export function NotificacionesPage() {
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const [searchParams] = useSearchParams();
  const tipoPedido = searchParams.get("tipo");
  const [grupos, setGrupos] = useState<NotificacionFeedGrupo[] | null>(null);
  /** Carga abierta en modal sin salir de la página (avisos de carga sospechosa). */
  const [cargaAbiertaId, setCargaAbiertaId] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<NotificacionFeedGrupo[]>(
          `/api/notificaciones/feed/agrupado?porTipo=${POR_TIPO}`,
          () => getToken(),
        );
        if (cancelled) return;
        setGrupos(data);
        // Abiertos de entrada: el pedido por URL (?tipo=, desde la campana); si no, los que
        // tienen algo nuevo; si no hay nada nuevo, el más reciente.
        const conNuevas = data.filter((g) => g.noLeidas > 0).map((g) => g.tipo);
        setAbiertos(
          new Set(
            tipoPedido && data.some((g) => g.tipo === tipoPedido)
              ? [tipoPedido]
              : conNuevas.length > 0
                ? conNuevas
                : data.slice(0, 1).map((g) => g.tipo),
          ),
        );
        setError(null);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "notificaciones"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tipoPedido]);

  // Abrir un grupo con novedades = verlo: se marca entero como visto en el backend (así el
  // contador baja aunque el grupo tenga cientos de avisos y solo se muestren algunos), pero
  // los que están en pantalla quedan resaltados RESALTE_MS para que se note qué era nuevo.
  const gruposVistos = useRef(new Set<string>());
  const timeouts = useRef<number[]>([]);
  useEffect(() => () => timeouts.current.forEach((t) => window.clearTimeout(t)), []);
  const sueltos = grupos ? avisosSinAgrupar(grupos) : null;
  useEffect(() => {
    if (!grupos) return;
    // Sin agrupar (pocos avisos): todo está a la vista, así que todos los tipos cuentan como abiertos.
    const todoVisible = avisosSinAgrupar(grupos) !== null;
    const tipos = grupos
      .filter(
        (g) =>
          (todoVisible || abiertos.has(g.tipo)) &&
          g.noLeidas > 0 &&
          !gruposVistos.current.has(g.tipo),
      )
      .map((g) => g.tipo);
    if (tipos.length === 0) return;

    for (const tipo of tipos) {
      gruposVistos.current.add(tipo);
      apiJson("/api/notificaciones/feed/marcar-leidas", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ tipo }),
      })
        .then(() => window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES_VISTAS)))
        .catch(() => gruposVistos.current.delete(tipo));
    }

    timeouts.current.push(
      window.setTimeout(() => {
        setGrupos(
          (prev) =>
            prev?.map((g) =>
              tipos.includes(g.tipo)
                ? { ...g, noLeidas: 0, items: g.items.map((i) => ({ ...i, leido: true })) }
                : g,
            ) ?? prev,
        );
      }, RESALTE_MS),
    );
  }, [grupos, abiertos, getToken]);

  function toggle(tipo: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  /** Trae los siguientes VER_MAS_LIMIT avisos del tipo y los suma al final del grupo. */
  async function verMas(tipo: string) {
    const offset = grupos?.find((g) => g.tipo === tipo)?.items.length ?? 0;
    try {
      const data = await apiJson<NotificacionFeed>(
        `/api/notificaciones/feed?tipo=${encodeURIComponent(tipo)}&limit=${VER_MAS_LIMIT}&offset=${offset}`,
        () => getToken(),
      );
      setGrupos(
        (prev) =>
          prev?.map((g) => (g.tipo === tipo ? { ...g, items: [...g.items, ...data.items] } : g)) ?? prev,
      );
    } catch (e) {
      setError(friendlyError(e, "notificaciones"));
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Notificaciones
        </h1>
        <Link
          to="/configuracion/notificaciones"
          className="inline-flex items-center gap-1.5 rounded border border-black/15 bg-white px-3 py-1.5 text-xs uppercase tracking-wider text-vialto-steel hover:border-black/30 hover:text-vialto-charcoal"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
          Ajustes
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {grupos === null && !error && <p className="text-sm text-vialto-steel">Cargando…</p>}

        {grupos?.length === 0 && (
          <div className="flex flex-col items-center gap-2 border border-dashed border-black/15 bg-white px-4 py-12 text-center">
            <BellOff className="h-6 w-6 text-vialto-steel/60" aria-hidden />
            <p className="text-sm text-vialto-steel">No hay avisos por ahora.</p>
          </div>
        )}

        {sueltos && sueltos.length > 0 && (
          // Pocos avisos en total: una sola lista, sin acordeones. El ícono indica el tipo.
          <ul className="divide-y divide-black/5 border border-black/10 bg-white">
            {sueltos.map((item) => (
              <AvisoFila
                key={item.id}
                item={item}
                titulo={item.titulo}
                icono={tipoNotificacionUI(item.tipo, item.label).icono}
                onAbrirCarga={orgId ? setCargaAbiertaId : undefined}
              />
            ))}
          </ul>
        )}

        {!sueltos && grupos?.map((g) => (
          <GrupoAcordeon
            key={g.tipo}
            grupo={g}
            abierto={abiertos.has(g.tipo)}
            onToggle={() => toggle(g.tipo)}
            onVerMas={() => void verMas(g.tipo)}
            onAbrirCarga={orgId ? setCargaAbiertaId : undefined}
          />
        ))}
      </div>

      {cargaAbiertaId && orgId && (
        <CargaCombustibleViewModal
          cargaId={cargaAbiertaId}
          tenantId={orgId}
          onClose={() => setCargaAbiertaId(null)}
        />
      )}
    </div>
  );
}

function GrupoAcordeon({
  grupo,
  abierto,
  onToggle,
  onVerMas,
  onAbrirCarga,
}: {
  grupo: NotificacionFeedGrupo;
  abierto: boolean;
  onToggle: () => void;
  onVerMas: () => void;
  onAbrirCarga?: (cargaId: string) => void;
}) {
  const { nombre, icono: Icono, limpiarTitulo } = tipoNotificacionUI(grupo.tipo, grupo.label);
  const panelId = `notif-grupo-${grupo.tipo}`;
  const faltan = grupo.total - grupo.items.length;

  return (
    <section className="border border-black/10 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-vialto-mist/60"
      >
        <Icono className="h-5 w-5 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 text-sm font-medium text-vialto-charcoal">{nombre}</span>
        {grupo.noLeidas > 0 && (
          <span className="rounded-full bg-vialto-fire px-2 py-0.5 text-[11px] font-semibold text-white">
            {grupo.noLeidas} {grupo.noLeidas === 1 ? "nueva" : "nuevas"}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-vialto-steel transition-transform ${abierto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {abierto && (
        <div id={panelId}>
          <ul className="divide-y divide-black/5 border-t border-black/10">
            {grupo.items.map((item) => (
              <AvisoFila
                key={item.id}
                item={item}
                titulo={limpiarTitulo(item.titulo)}
                onAbrirCarga={onAbrirCarga}
              />
            ))}
          </ul>
          {faltan > 0 && (
            <button
              type="button"
              onClick={onVerMas}
              className="w-full border-t border-black/10 px-4 py-2.5 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/60 hover:text-vialto-charcoal"
            >
              Ver más
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AvisoFila({
  item,
  titulo,
  icono: Icono,
  onAbrirCarga,
}: {
  item: NotificacionFeedItem;
  titulo: string;
  /** Solo en la lista sin agrupar: indica el tipo (en un grupo ya lo dice el encabezado). */
  icono?: LucideIcon;
  onAbrirCarga?: (cargaId: string) => void;
}) {
  const navigate = useNavigate();
  // Cargas sospechosas: el detalle se abre en modal acá mismo, sin salir de Notificaciones.
  const abrirEnModal =
    item.tipo === "combustible.cargaSospechosa" && !!item.entidadId && !!onAbrirCarga;
  const to = abrirEnModal ? null : resolveNotificacionRoute(item);
  const onClick = abrirEnModal
    ? () => onAbrirCarga(item.entidadId)
    : to
      ? () => navigate(to)
      : undefined;
  const contenido = (
    <>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors duration-1000 ${item.leido ? "bg-transparent" : "bg-vialto-fire"}`}
        aria-label={item.leido ? undefined : "Nueva"}
      />
      {Icono && (
        <Icono className="mt-0.5 h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-vialto-charcoal">{titulo}</span>
        <span className="block truncate text-xs text-vialto-steel" title={item.detalle}>
          {detalleCorto(item.detalle)}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs text-vialto-steel">
        {fechaRelativa(item.enviadoAt)}
      </span>
      {onClick && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-vialto-steel/60" aria-hidden />}
    </>
  );

  return (
    // Resaltado de "no visto": se desvanece cuando el aviso pasa a leído (ver RESALTE_MS).
    <li className={`transition-colors duration-1000 ${item.leido ? "" : "bg-orange-50"}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-vialto-mist/60"
        >
          {contenido}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-4 py-2.5">{contenido}</div>
      )}
    </li>
  );
}

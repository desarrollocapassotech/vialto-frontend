import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Bell, BellOff, ChevronRight, Settings } from "lucide-react";
import { apiJson } from "@/lib/api";
import {
  avisosSinAgrupar,
  EVENTO_NOTIFICACIONES_VISTAS,
  fechaRelativa,
  MAX_AVISOS_SIN_AGRUPAR,
  tipoNotificacionUI,
} from "@/lib/notificacionTipos";
import type { NotificacionFeedGrupo } from "@/types/notificaciones";

const POLL_MS = 60_000;

/**
 * Campana del menú superior: el único contador de avisos del sistema — cuenta solo los no
 * vistos. El desplegable lista los avisos sueltos si son pocos (MAX_AVISOS_SIN_AGRUPAR), o
 * un resumen por tipo si son más; cada fila lleva a /notificaciones con ese tipo abierto,
 * donde se marcan como vistos.
 */
export function NotificationBell() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [grupos, setGrupos] = useState<NotificacionFeedGrupo[] | null>(null);
  const noLeidas = grupos?.reduce((s, g) => s + g.noLeidas, 0) ?? 0;
  // El desplegable muestra solo lo no visto; el historial completo está en /notificaciones.
  const sueltos = grupos ? avisosSinAgrupar(grupos)?.filter((i) => !i.leido) ?? null : null;
  const gruposConNuevas = grupos?.filter((g) => g.noLeidas > 0) ?? [];
  const sinNuevas = sueltos ? sueltos.length === 0 : gruposConNuevas.length === 0;
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGrupos = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      // porTipo=MAX_AVISOS_SIN_AGRUPAR: con pocos avisos en total se listan sueltos, y así ya
      // vienen todos; con muchos, solo se usan los totales por grupo.
      const data = await apiJson<NotificacionFeedGrupo[]>(
        `/api/notificaciones/feed/agrupado?porTipo=${MAX_AVISOS_SIN_AGRUPAR}`,
        () => getToken(),
      );
      setGrupos(data);
    } catch {
      // silencioso: si falla, la campana simplemente no muestra novedades hasta el próximo poll
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void fetchGrupos();
    const id = setInterval(() => void fetchGrupos(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchGrupos]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // La página de Notificaciones avisa cuando marca avisos como vistos: actualizar ya.
  useEffect(() => {
    const onVistas = () => void fetchGrupos();
    window.addEventListener(EVENTO_NOTIFICACIONES_VISTAS, onVistas);
    return () => window.removeEventListener(EVENTO_NOTIFICACIONES_VISTAS, onVistas);
  }, [fetchGrupos]);

  // Abrir la campana NO marca nada como visto: un aviso cuenta como visto recién cuando
  // se muestra en la página de Notificaciones.
  function handleToggle() {
    setOpen((prev) => !prev);
  }

  function irA(ruta: string) {
    setOpen(false);
    navigate(ruta);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-vialto-fire px-1 text-[10px] font-semibold leading-none text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-md border border-black/10 bg-white text-vialto-charcoal shadow-lg">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
            <span className="text-sm font-semibold">Notificaciones</span>
            <button
              type="button"
              onClick={() => irA("/configuracion/notificaciones")}
              aria-label="Ajustes de notificaciones"
              title="Ajustes"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          {sinNuevas ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="h-5 w-5 text-vialto-steel/60" aria-hidden />
              <p className="text-sm text-vialto-steel">Sin notificaciones nuevas</p>
            </div>
          ) : sueltos ? (
            // Pocos avisos en total: uno por fila, sin agrupar.
            <ul className="divide-y divide-black/5">
              {sueltos.map((item) => {
                const { icono: Icono } = tipoNotificacionUI(item.tipo, item.label);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => irA(`/notificaciones?tipo=${encodeURIComponent(item.tipo)}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-vialto-mist"
                    >
                      <span className="relative shrink-0">
                        <Icono className="h-4 w-4 text-vialto-steel" strokeWidth={1.75} aria-hidden />
                        {!item.leido && (
                          <span
                            className="absolute -left-1.5 -top-1 h-2 w-2 rounded-full bg-vialto-fire"
                            aria-label="Nueva"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.titulo}</span>
                      <span className="shrink-0 text-[11px] text-vialto-steel">
                        {fechaRelativa(item.enviadoAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="divide-y divide-black/5">
              {gruposConNuevas.map((g) => {
                const { nombre, icono: Icono } = tipoNotificacionUI(g.tipo, g.label);
                return (
                  <li key={g.tipo}>
                    <button
                      type="button"
                      onClick={() => irA(`/notificaciones?tipo=${encodeURIComponent(g.tipo)}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-vialto-mist"
                    >
                      <Icono className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm">{nombre}</span>
                      {g.noLeidas > 0 && (
                        <span className="shrink-0 rounded-full bg-vialto-fire px-2 py-0.5 text-[11px] font-semibold text-white">
                          {g.noLeidas} {g.noLeidas === 1 ? "nueva" : "nuevas"}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-vialto-steel/60" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => irA("/notificaciones")}
            className="block w-full border-t border-black/10 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}

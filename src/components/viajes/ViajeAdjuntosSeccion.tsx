import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { VisorFotos, type FotoVisor } from "@/components/ui/VisorFotos";
import { abrirAdjuntoEnPestana } from "@/lib/abrirAdjunto";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { adjuntosActivosViaje } from "@/lib/viajesAdjuntos";
import type { Viaje, ViajeAdjunto } from "@/types/api";

/** Mismo tope que valida el backend (`ViajesService.addAdjunto`). */
const MAX_ADJUNTOS_VIAJE = 3;
const MAX_BYTES_ADJUNTOS_VIAJE = 10 * 1024 * 1024;

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

function adjuntosUrl(viajeId: string, tenantId?: string, adjuntoId?: string) {
  const sufijo = adjuntoId ? `/${encodeURIComponent(adjuntoId)}` : "";
  return tenantId
    ? `/api/platform/viajes/${encodeURIComponent(viajeId)}/adjuntos${sufijo}?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/viajes/${encodeURIComponent(viajeId)}/adjuntos${sufijo}`;
}

/**
 * Documentos del viaje (remito, carta de porte, fotos…) en el detalle: hasta 3 y 10 MB
 * entre todos, cada uno con título obligatorio. Se guardan al momento (no esperan a
 * "Editar"); `puedeEditar` decide si se muestran agregar/quitar.
 */
export function ViajeAdjuntosSeccion({
  viaje,
  tenantId,
  puedeEditar,
  onViajeActualizado,
}: {
  viaje: Viaje;
  /** Solo superadmin: empresa elegida (rutas `/api/platform`). */
  tenantId?: string;
  puedeEditar: boolean;
  onViajeActualizado?: (viaje: Viaje) => void;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [adjuntos, setAdjuntos] = useState<ViajeAdjunto[]>(adjuntosActivosViaje(viaje));
  const [agregando, setAgregando] = useState(false);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [confirmarQuitarId, setConfirmarQuitarId] = useState<string | null>(null);
  const [visorUrl, setVisorUrl] = useState<string | null>(null);

  // Las fotos se ven en el visor (pasando entre todas las del viaje); los documentos en pestaña nueva.
  const fotos: FotoVisor[] = adjuntos
    .filter((a) => a.mimeType?.startsWith("image/"))
    .map((a) => ({ url: a.url, titulo: a.titulo }));

  const usados = adjuntos.reduce((acc, a) => acc + (a.bytes || 0), 0);
  const disponibles = MAX_BYTES_ADJUNTOS_VIAJE - usados;
  const puedeAgregar =
    puedeEditar && adjuntos.length < MAX_ADJUNTOS_VIAJE && disponibles > 0;

  function aplicar(updated: Viaje) {
    setAdjuntos(adjuntosActivosViaje(updated));
    onViajeActualizado?.(updated);
  }

  async function quitar(a: ViajeAdjunto) {
    setQuitandoId(a.id);
    try {
      const updated = await apiJson<Viaje>(
        adjuntosUrl(viaje.id, tenantId, a.id),
        () => getToken(),
        { method: "DELETE" },
      );
      aplicar(updated);
      showToast("Documento quitado", "success");
    } catch (e) {
      showToast(friendlyError(e, "viajes"), "error");
    } finally {
      setQuitandoId(null);
      setConfirmarQuitarId(null);
    }
  }

  if (!puedeEditar && adjuntos.length === 0) return null;

  return (
    <div className="py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel">
          Documentos
          <span className="ml-2 font-normal normal-case tracking-normal">
            ({adjuntos.length}/{MAX_ADJUNTOS_VIAJE} · {fmtBytes(usados)} de 10 MB)
          </span>
        </p>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            disabled={!puedeAgregar}
            title={
              puedeAgregar
                ? undefined
                : adjuntos.length >= MAX_ADJUNTOS_VIAJE
                  ? "Ya hay 3 documentos: quitá uno para agregar otro."
                  : "Se llegó al límite de 10 MB."
            }
            className="inline-flex h-8 items-center gap-1.5 border border-black/20 px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Agregar documento
          </button>
        )}
      </div>

      {adjuntos.length === 0 ? (
        <p className="text-sm text-vialto-steel">Sin documentos.</p>
      ) : (
        <ul className="divide-y divide-black/5 rounded border border-black/10 bg-white">
          {adjuntos.map((a) => {
            const esImagen = a.mimeType?.startsWith("image/");
            const Icono = esImagen ? ImageIcon : FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                <Icono className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
                <button
                  type="button"
                  onClick={() =>
                    esImagen
                      ? setVisorUrl(a.url)
                      : void abrirAdjuntoEnPestana({ url: a.url }, () => getToken(), a.titulo)
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm text-vialto-charcoal hover:text-vialto-fire hover:underline">
                    {a.titulo}
                  </span>
                  <span className="block truncate text-[11px] text-vialto-steel">
                    {a.nombre} · {fmtBytes(a.bytes)}
                  </span>
                </button>
                {puedeEditar &&
                  (confirmarQuitarId === a.id ? (
                    <span className="inline-flex shrink-0 items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => void quitar(a)}
                        disabled={quitandoId === a.id}
                        className="uppercase tracking-wider text-red-700 hover:underline disabled:opacity-50"
                      >
                        {quitandoId === a.id ? "Quitando…" : "Quitar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmarQuitarId(null)}
                        disabled={quitandoId === a.id}
                        className="uppercase tracking-wider text-vialto-steel hover:underline"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmarQuitarId(a.id)}
                      aria-label={`Quitar ${a.titulo}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      {visorUrl && (
        <VisorFotos
          fotos={fotos}
          indiceInicial={Math.max(0, fotos.findIndex((f) => f.url === visorUrl))}
          onClose={() => setVisorUrl(null)}
        />
      )}

      {agregando && (
        <AgregarDocumentoViajeModal
          viaje={{ ...viaje, adjuntos }}
          tenantId={tenantId}
          onClose={() => setAgregando(false)}
          onAgregado={(updated) => {
            aplicar(updated);
            setAgregando(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal "Agregar documento" del viaje: título (obligatorio) + archivo, dentro del espacio
 * que queda de los 10 MB. Sube y guarda al confirmar. Lo usan el detalle del viaje, el
 * menú de acciones y el clip de la grilla.
 */
export function AgregarDocumentoViajeModal({
  viaje,
  tenantId,
  onClose,
  onAgregado,
}: {
  viaje: Viaje;
  /** Solo superadmin: empresa elegida (rutas `/api/platform`). */
  tenantId?: string;
  onClose: () => void;
  onAgregado: (viaje: Viaje) => void;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const disponibles =
    MAX_BYTES_ADJUNTOS_VIAJE -
    adjuntosActivosViaje(viaje).reduce((acc, a) => acc + (a.bytes || 0), 0);

  async function onGuardar({ titulo, file }: { titulo: string; file: File }) {
    const form = new FormData();
    form.append("file", file);
    form.append("titulo", titulo);
    const updated = await apiJson<Viaje>(
      adjuntosUrl(viaje.id, tenantId),
      () => getToken(),
      { method: "POST", body: form },
    );
    showToast("Documento agregado", "success");
    onAgregado(updated);
  }

  const [titulo, setTitulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function guardar() {
    const errs: Record<string, string> = {};
    if (!titulo.trim()) errs.titulo = "Ingresá un título para el documento.";
    if (!file) errs.file = "Adjuntá el archivo.";
    else if (file.size > disponibles) {
      errs.file = `El archivo pesa ${fmtBytes(file.size)} y quedan ${fmtBytes(disponibles)} de los 10 MB del viaje.`;
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSaving(true);
    try {
      await onGuardar({ titulo: titulo.trim(), file: file! });
    } catch (e) {
      setError(friendlyError(e, "viajes"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title="Agregar documento"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <ErrorPieModal error={error} fieldErrors={fieldErrors} />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${viewModalBtnGhost} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving}
            className={viewModalBtnPrimary}
          >
            {saving ? "Subiendo…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Título</CrudFieldLabel>
          <CrudInput
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={saving}
            maxLength={120}
            placeholder="Ej. Remito de carga"
            error={fieldErrors.titulo}
          />
        </label>
        <ComprobanteAdjuntoField
          file={file}
          onFileChange={setFile}
          disabled={saving}
          label={
            <>
              Archivo <span className="text-red-500">*</span>
            </>
          }
        />
      </div>
    </ViewModalShell>
  );
}

import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { isComprobanteFile } from "@/lib/comprobanteUpload";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { nombreAdjunto } from "@/lib/mantenimientoLabels";

const MAX_ADJUNTOS = 10;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Adjuntos de una OT (factura, fotos): cada archivo se sube primero a
 * `POST mantenimiento/ordenes/adjuntos` y la URL devuelta se guarda en la orden.
 */
export function AdjuntosOrdenField({
  value,
  onChange,
  getToken,
  tenantId,
  readOnly = false,
}: {
  value: string[];
  onChange?: (next: string[]) => void;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(files: FileList | null) {
    if (!files || files.length === 0 || !onChange) return;
    setError(null);
    const lista = Array.from(files);
    if (value.length + lista.length > MAX_ADJUNTOS) {
      setError(`Máximo ${MAX_ADJUNTOS} adjuntos por orden.`);
      return;
    }
    const invalido = lista.find((f) => !isComprobanteFile(f) || f.size > MAX_BYTES);
    if (invalido) {
      setError(`"${invalido.name}" no se puede adjuntar: tiene que ser PDF o imagen de hasta 10 MB.`);
      return;
    }
    setSubiendo(true);
    const nuevas: string[] = [];
    try {
      for (const file of lista) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiJson<{ url: string }>(mantUrl("ordenes/adjuntos", tenantId), () => getToken(), {
          method: "POST",
          body: form,
        });
        nuevas.push(res.url);
      }
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      if (nuevas.length) onChange([...value, ...nuevas]);
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      {value.length === 0 && readOnly && <p className="text-sm text-vialto-steel">Sin adjuntos.</p>}
      {value.length > 0 && (
        <ul className="grid gap-1.5">
          {value.map((url) => (
            <li key={url} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-vialto-charcoal underline decoration-black/20 hover:decoration-vialto-fire"
              >
                {nombreAdjunto(url)}
              </a>
              {!readOnly && onChange && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((u) => u !== url))}
                  aria-label={`Quitar ${nombreAdjunto(url)}`}
                  className="ml-auto inline-flex h-7 w-7 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => void subir(e.target.files)}
          />
          <button
            type="button"
            disabled={subiendo || value.length >= MAX_ADJUNTOS}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 border border-black/20 px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
          >
            {subiendo ? <Spinner className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />}
            {subiendo ? "Subiendo…" : "Adjuntar factura o foto"}
          </button>
        </div>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

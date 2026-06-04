type MissingGroup = { fields: string[]; entityId?: string };

const FIELD_LABELS: Record<string, string> = {
  micNumero: 'N° de MIC',
  crtNumero: 'N° de CRT',
  fechaEmision: 'Fecha de emisión',
  ncm: 'NCM',
  bultos: 'Cantidad de bultos',
  tipoBultos: 'Tipo de bultos',
  pesoBrutoKg: 'Peso bruto',
  valorFot: 'Valor FOT',
  flete: 'Flete internacional',
  aduanaPartida: 'Aduana de partida',
  aduanaDestino: 'Aduana de destino',
  razonSocial: 'Razón social',
  idFiscal: 'CUIT / RUT',
  calle: 'Calle',
  numero: 'Número de domicilio',
  ciudad: 'Ciudad',
  pais: 'País',
  condicionPago: 'Condición de pago del flete',
  monedaFot: 'Moneda FOT',
  monedaFlete: 'Moneda del flete',
};

const ACTOR_LABELS: Record<string, string> = {
  remitente: 'Remitente',
  destinatario: 'Destinatario',
  consignatario: 'Consignatario',
  notificarA: 'Notificar a',
};

function labelForPropertyPath(path: string): string {
  const parts = path.split('.');
  if (parts.length === 2 && ACTOR_LABELS[parts[0]]) {
    const field = FIELD_LABELS[parts[1]] ?? parts[1];
    return `${ACTOR_LABELS[parts[0]]}: ${field}`;
  }
  return FIELD_LABELS[path] ?? path;
}

/** Traduce mensajes típicos de class-validator (inglés) al español. */
function translateValidatorLine(line: string): string {
  const t = line.trim();
  if (!t) return t;

  const pathMatch = /^([\w.]+)\s+(.+)$/i.exec(t);
  if (pathMatch) {
    const [, path, rest] = pathMatch;
    const label = labelForPropertyPath(path);
    const r = rest.toLowerCase();
    if (r.includes('should not be empty') || r.includes('must not be empty')) {
      return `Completá ${label}.`;
    }
    if (r.includes('must be a number')) {
      return `${label} debe ser un número.`;
    }
    if (r.includes('must not be less than')) {
      return `${label} no puede ser negativo.`;
    }
    if (r.includes('must be one of the following')) {
      return `Elegí un valor válido para ${label}.`;
    }
    return `Revisá ${label}: ${rest}.`;
  }

  const lower = t.toLowerCase();
  if (lower === 'bad request') return 'Revisá los datos del formulario e intentá de nuevo.';
  if (lower.includes('should not be empty') || lower.includes('must not be empty')) {
    return 'Hay campos obligatorios sin completar. Revisá el formulario.';
  }
  if (lower.includes('must be a number')) return 'Algún valor numérico no es válido.';
  if (lower.includes('must not be less than')) return 'Algún monto o cantidad no puede ser negativo.';

  return t;
}

function formatMissingGroups(groups: Record<string, MissingGroup>): string {
  const lines = Object.entries(groups).map(([grupo, entry]) => {
    const campos = entry.fields.join(', ');
    return `${grupo}: faltan ${campos}.`;
  });
  return lines.join(' ');
}

/**
 * Mensaje amigable en español para errores al generar o validar MIC/CRT.
 */
export function formatMicCrtExportError(
  message: unknown,
  missingGroups?: Record<string, MissingGroup> | null,
): string {
  const parts: string[] = [];

  if (typeof message === 'string' && message.trim()) {
    parts.push(translateValidatorLine(message));
  } else if (Array.isArray(message)) {
    const translated = message
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .map(translateValidatorLine);
    if (translated.length > 0) parts.push(translated.join(' '));
  }

  if (missingGroups && Object.keys(missingGroups).length > 0) {
    const mg = formatMissingGroups(missingGroups);
    if (mg) parts.push(mg);
  }

  if (parts.length > 0) return parts.join(' ');

  return 'No se pudo generar el PDF. Revisá los datos del formulario e intentá de nuevo.';
}

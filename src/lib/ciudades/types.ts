/** Código ISO 3166-1 alpha-2 de países con buscador de ciudades implementado o previsto. */
export type PaisCodigo = 'AR' | 'UY';

export type CiudadOpcion = {
  id: string;
  /** Valor guardado en origen/destino (incluye país cuando aplica). */
  label: string;
};

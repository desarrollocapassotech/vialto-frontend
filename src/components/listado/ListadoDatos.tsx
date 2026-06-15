import type { ReactNode } from 'react';
import { ListadoFiltrosSheet } from '@/components/listado/ListadoFiltrosSheet';
import {
  listadoCardActionsClass,
  listadoCardClass,
  listadoCardFieldLabelClass,
  listadoCardFieldValueClass,
  listadoCardListClass,
  listadoCardPrimaryClass,
  listadoDatosWrapperClass,
  listadoTablaBodyRowClass,
  listadoTablaClass,
  listadoTablaEmptyCellClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
  listadoTablaWrapperClass,
} from '@/lib/listadoTabla';

export type ListadoColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Título principal de la tarjeta en mobile. */
  primary?: boolean;
  /** Etiqueta en la tarjeta mobile (default: header). */
  cardLabel?: ReactNode;
  /** false = solo tabla desktop */
  showInCard?: boolean;
  thClassName?: string;
  tdClassName?: string;
};

export type ListadoDatosProps<T> = {
  columns: ListadoColumn<T>[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  emptyMessage: string;
  loadingMessage?: string;
  className?: string;
  /** Thead personalizado (p. ej. columnas especiales). Solo desktop. */
  tableHead?: ReactNode;
  /** @deprecated Usar `filters`. */
  mobileToolbar?: ReactNode;
  /** Contenido del panel de filtros (botón + sheet). */
  filters?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  clearFiltersDisabled?: boolean;
  filtersTitle?: string;
  /** Tarjeta mobile personalizada (anula el layout por columnas). */
  renderMobileCard?: (row: T) => ReactNode;
  /** Fila de tabla desktop personalizada (anula celdas por columnas). */
  renderTableRow?: (row: T) => ReactNode;
  renderActions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  actionsThClassName?: string;
  actionsTdClassName?: string;
  /** Colspan para filas vacío/carga cuando thead es personalizado. */
  tableColSpan?: number;
};

function ListadoCardField({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(6.5rem,38%)_1fr] items-start gap-x-3 gap-y-0.5">
      <dt className={listadoCardFieldLabelClass}>{label}</dt>
      <dd className={listadoCardFieldValueClass}>{value}</dd>
    </div>
  );
}

export function ListadoDatos<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  loadingMessage = 'Cargando…',
  className = '',
  tableHead,
  mobileToolbar,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  clearFiltersDisabled,
  filtersTitle,
  renderMobileCard,
  renderTableRow,
  renderActions,
  actionsHeader = 'Acciones',
  actionsThClassName = `${listadoTablaThClass} text-right`,
  actionsTdClassName = `${listadoTablaTdClass} text-right`,
  tableColSpan,
}: ListadoDatosProps<T>) {
  const loading = rows == null;
  const isEmpty = !loading && rows.length === 0;
  const colSpan = tableColSpan ?? columns.length + (renderActions ? 1 : 0);
  const primaryCol = columns.find((c) => c.primary) ?? columns[0];
  const cardColumns = columns.filter(
    (c) => c.showInCard !== false && c.id !== primaryCol?.id,
  );

  function renderDefaultMobileCard(row: T) {
    return (
      <article key={rowKey(row)} className={listadoCardClass}>
        {primaryCol && (
          <div className={listadoCardPrimaryClass}>{primaryCol.cell(row)}</div>
        )}
        {cardColumns.length > 0 && (
          <dl className="flex flex-col gap-2.5">
            {cardColumns.map((col) => (
              <ListadoCardField
                key={col.id}
                label={col.cardLabel ?? col.header}
                value={col.cell(row)}
              />
            ))}
          </dl>
        )}
        {renderActions && (
          <div className={listadoCardActionsClass}>{renderActions(row)}</div>
        )}
      </article>
    );
  }

  const filterBar = filters ? (
    <div className="mb-3 lg:hidden">
      <ListadoFiltrosSheet
        activeCount={activeFilterCount}
        title={filtersTitle}
        onClear={onClearFilters}
        clearDisabled={clearFiltersDisabled}
      >
        {filters}
      </ListadoFiltrosSheet>
    </div>
  ) : mobileToolbar ? (
    <div className="mb-3 border-b border-black/5 p-3 lg:hidden">{mobileToolbar}</div>
  ) : null;

  return (
    <div className={className}>
      {filterBar}

      <div className={[listadoDatosWrapperClass].filter(Boolean).join(' ')}>

      <div className={listadoCardListClass}>
        {loading && (
          <p className="px-1 py-6 text-center text-sm text-vialto-steel">{loadingMessage}</p>
        )}
        {isEmpty && (
          <p className="px-1 py-6 text-center text-sm text-vialto-steel">{emptyMessage}</p>
        )}
        {!loading &&
          rows.map((row) =>
            renderMobileCard ? (
              <div key={rowKey(row)}>{renderMobileCard(row)}</div>
            ) : (
              renderDefaultMobileCard(row)
            ),
          )}
      </div>

      <div className={`${listadoTablaWrapperClass} hidden lg:block border-0 shadow-none rounded-none`}>
        <table className={listadoTablaClass}>
          <thead>
            {tableHead ?? (
              <tr className={listadoTablaHeadRowClass}>
                {columns.map((col) => (
                  <th key={col.id} className={col.thClassName ?? listadoTablaThClass}>
                    {col.header}
                  </th>
                ))}
                {renderActions && (
                  <th className={actionsThClassName}>{actionsHeader}</th>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan} className={listadoTablaEmptyCellClass}>
                  {loadingMessage}
                </td>
              </tr>
            )}
            {isEmpty && (
              <tr>
                <td colSpan={colSpan} className={listadoTablaEmptyCellClass}>
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) =>
                renderTableRow ? (
                  renderTableRow(row)
                ) : (
                  <tr key={rowKey(row)} className={listadoTablaBodyRowClass}>
                    {columns.map((col) => (
                      <td key={col.id} className={col.tdClassName ?? listadoTablaTdClass}>
                        {col.cell(row)}
                      </td>
                    ))}
                    {renderActions && (
                      <td className={actionsTdClassName}>{renderActions(row)}</td>
                    )}
                  </tr>
                ),
              )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import {
  filtrarChoferes,
  filtrarClientesPorQuery,
  filtrarTransportistas,
  filtrarVehiculos,
} from '@/components/forms/maestroSearchFilters';
import type { Chofer, Cliente, Transportista, Vehiculo } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

type BaseProps = {
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  'aria-label'?: string;
};

export function ClienteSearchSelect({
  clientes,
  value,
  onChange,
  disabled,
  className,
  inputClassName = INPUT,
  placeholderCerrado = 'Elegí un cliente…',
  placeholderBuscar = 'Buscar por nombre o ID Fiscal…',
  allowEmptyValue = false,
  emptyListChoiceLabel = 'Sin selección',
  id,
  'aria-label': ariaLabel,
}: BaseProps & {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  placeholderCerrado?: string;
  placeholderBuscar?: string;
  /** Permite dejar sin cliente (`value === ''`), con fila para vaciar en el panel. */
  allowEmptyValue?: boolean;
  emptyListChoiceLabel?: string;
}) {
  return (
    <SearchableEntitySelect<Cliente>
      items={clientes}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      filterItems={filtrarClientesPorQuery}
      getPrimaryLabel={(c) => c.nombre}
      getSecondaryLabel={(c) => c.idFiscal}
      placeholderCerrado={placeholderCerrado}
      placeholderBuscar={placeholderBuscar}
      allowEmptyValue={allowEmptyValue}
      emptyListChoiceLabel={emptyListChoiceLabel}
      searchAriaLabel="Filtrar clientes"
      noItemsSlot={
        <div className={`${inputClassName} flex items-center text-vialto-steel`} aria-label={ariaLabel}>
          Sin clientes cargados
        </div>
      }
      id={id}
      aria-label={ariaLabel}
    />
  );
}

export function ChoferSearchSelect({
  choferes,
  value,
  onChange,
  disabled,
  className,
  inputClassName = INPUT,
  id,
  'aria-label': ariaLabel,
}: BaseProps & {
  choferes: Chofer[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <SearchableEntitySelect<Chofer>
      items={choferes}
      value={value}
      onChange={onChange}
      disabled={disabled || choferes.length === 0}
      className={className}
      inputClassName={inputClassName}
      filterItems={filtrarChoferes}
      getPrimaryLabel={(c) => c.nombre}
      getSecondaryLabel={(c) => (c.dni ? `DNI ${c.dni}` : c.telefono) ?? null}
      placeholderCerrado="Elegí un chofer…"
      placeholderBuscar="Buscar chofer…"
      searchAriaLabel="Filtrar choferes"
      noItemsSlot={
        <div className={`${inputClassName} flex items-center text-vialto-steel`} aria-label={ariaLabel}>
          Sin choferes de flota propia
        </div>
      }
      id={id}
      aria-label={ariaLabel}
    />
  );
}

export function TransportistaSearchSelect({
  transportistas,
  value,
  onChange,
  disabled,
  className,
  inputClassName = INPUT,
  placeholderCerrado = 'Elegí un transportista…',
  placeholderBuscar = 'Buscar transportista…',
  emptyListChoiceLabel = 'Elegí un transportista…',
  id,
  'aria-label': ariaLabel,
}: BaseProps & {
  transportistas: Transportista[];
  value: string;
  onChange: (id: string) => void;
  placeholderCerrado?: string;
  placeholderBuscar?: string;
  emptyListChoiceLabel?: string;
}) {
  return (
    <SearchableEntitySelect<Transportista>
      items={transportistas}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      filterItems={filtrarTransportistas}
      getPrimaryLabel={(t) => t.nombre}
      getSecondaryLabel={(t) => t.cuit}
      placeholderCerrado={placeholderCerrado}
      placeholderBuscar={placeholderBuscar}
      searchAriaLabel="Filtrar transportistas"
      allowEmptyValue
      emptyListChoiceLabel={emptyListChoiceLabel}
      id={id}
      aria-label={ariaLabel}
    />
  );
}

export function VehiculoPatenteSearchSelect({
  vehiculos,
  value,
  onChange,
  disabled,
  sinOpciones,
  className,
  inputClassName = INPUT,
  placeholderCerrado = 'Elegí patente…',
  id,
  'aria-label': ariaLabel,
}: BaseProps & {
  vehiculos: Vehiculo[];
  value: string;
  onChange: (id: string) => void;
  /** Sin candidatos para el tipo elegido */
  sinOpciones: boolean;
  placeholderCerrado?: string;
}) {
  if (sinOpciones) {
    return (
      <div className={className}>
        <div
          className={`${inputClassName} flex items-center text-vialto-steel`}
          aria-label={ariaLabel}
        >
          Sin vehículos de este tipo…
        </div>
      </div>
    );
  }

  return (
    <SearchableEntitySelect<Vehiculo>
      items={vehiculos}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      filterItems={filtrarVehiculos}
      getPrimaryLabel={(v) => v.patente}
      getSecondaryLabel={(v) => [v.marca, v.modelo].filter(Boolean).join(' · ') || null}
      placeholderCerrado={placeholderCerrado}
      placeholderBuscar="Buscar patente o marca…"
      searchAriaLabel="Filtrar vehículos"
      allowEmptyValue
      emptyListChoiceLabel="Elegí patente…"
      id={id}
      aria-label={ariaLabel}
    />
  );
}

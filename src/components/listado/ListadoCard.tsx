import type { ReactNode } from 'react';
import {
  listadoCardActionsClass,
  listadoCardClass,
  listadoCardFieldLabelClass,
  listadoCardFieldValueClass,
  listadoCardPrimaryClass,
} from '@/lib/listadoTabla';

export function ListadoCard({
  primary,
  fields,
  actions,
}: {
  primary?: ReactNode;
  fields?: Array<{ label: ReactNode; value: ReactNode }>;
  actions?: ReactNode;
}) {
  return (
    <article className={listadoCardClass}>
      {primary != null && primary !== false && (
        <div className={listadoCardPrimaryClass}>{primary}</div>
      )}
      {fields && fields.length > 0 && (
        <dl className="flex flex-col gap-2.5">
          {fields.map((field, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(6.5rem,38%)_1fr] items-start gap-x-3 gap-y-0.5"
            >
              <dt className={listadoCardFieldLabelClass}>{field.label}</dt>
              <dd className={listadoCardFieldValueClass}>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className={listadoCardActionsClass}>{actions}</div>}
    </article>
  );
}

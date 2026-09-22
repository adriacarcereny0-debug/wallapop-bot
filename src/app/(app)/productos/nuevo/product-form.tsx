'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { PRODUCT_CONDITION } from '@/lib/labels';
import { createProduct, type FormState } from './actions';

const INITIAL: FormState = { error: null, fieldErrors: {} };

export function ProductForm() {
  const [state, action] = useActionState(createProduct, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.error && (
        <Notice tone="danger" title={state.error}>
          Corrige los campos indicados y vuelve a enviar el formulario.
        </Notice>
      )}

      <Surface className="p-5">
        <h2 className="text-sm font-semibold">Identificación</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Nombre" required error={state.fieldErrors.name} span />
          <Field name="brand" label="Marca" error={state.fieldErrors.brand} />
          <Field name="model" label="Modelo" error={state.fieldErrors.model} />
          <Field
            name="sku"
            label="SKU"
            required
            hint="Identificador interno único. Es el que enlaza tu catálogo con Wallapop."
            error={state.fieldErrors.sku}
          />
          <Field
            name="stock"
            label="Stock"
            type="number"
            defaultValue="1"
            error={state.fieldErrors.stock}
          />
        </div>
      </Surface>

      <Surface className="p-5">
        <h2 className="text-sm font-semibold">Clasificación</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="category"
            label="Categoría"
            required
            defaultValue="Electrónica"
            error={state.fieldErrors.category}
          />
          <Field name="subcategory" label="Subcategoría" error={state.fieldErrors.subcategory} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Estado</span>
            <select name="condition" defaultValue="good" className={inputClass}>
              {Object.entries(PRODUCT_CONDITION).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Surface>

      <Surface className="p-5">
        <h2 className="text-sm font-semibold">Precios</h2>
        <p className="mt-1 text-xs text-muted">
          El objetivo y el mínimo son internos. El asistente de negociación nunca recomendará
          bajar del mínimo, y ninguno de los dos se muestra al comprador.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field
            name="purchasePrice"
            label="Precio de compra"
            hint="650 o 650,50"
            error={state.fieldErrors.purchasePrice}
          />
          <Field
            name="targetPrice"
            label="Precio objetivo"
            error={state.fieldErrors.targetPrice}
          />
          <Field name="minPrice" label="Precio mínimo" error={state.fieldErrors.minPrice} />
        </div>
      </Surface>

      <Surface className="p-5">
        <h2 className="text-sm font-semibold">Contenido</h2>
        <div className="mt-4 flex flex-col gap-4">
          <TextArea
            name="features"
            label="Características"
            rows={4}
            placeholder={'Batería: 91 %\nAccesorios: Caja + cable'}
            hint="Una por línea, con el formato «Clave: valor». La IA sólo usará estas."
          />
          <TextArea
            name="publicDescription"
            label="Descripción pública"
            rows={3}
            hint="Se usará como base del anuncio."
          />
          <TextArea
            name="internalNotes"
            label="Notas internas"
            rows={2}
            hint="Privadas. Nunca salen de la aplicación."
          />
        </div>
      </Surface>

      <div className="flex flex-wrap gap-2">
        <SubmitButton />
        <Link href="/productos" className={buttonClass('ghost')}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary')}>
      {pending ? 'Guardando…' : 'Crear producto'}
    </button>
  );
}

const inputClass = 'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm';

function Field({
  name,
  label,
  type = 'text',
  required,
  hint,
  error,
  defaultValue,
  span,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  span?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${span ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? 'border-danger' : ''}`}
      />
      {error ? (
        <span className="text-2xs text-danger">{error}</span>
      ) : (
        hint && <span className="text-2xs text-faint">{hint}</span>
      )}
    </label>
  );
}

function TextArea({
  name,
  label,
  rows,
  hint,
  placeholder,
}: {
  name: string;
  label: string;
  rows: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <textarea name={name} rows={rows} placeholder={placeholder} className={inputClass} />
      {hint && <span className="text-2xs text-faint">{hint}</span>}
    </label>
  );
}

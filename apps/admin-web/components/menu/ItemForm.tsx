import { Button } from '@/components/ui/Button';
import { Card, CardLabel } from '@/components/ui/Card';
import { tr } from '@/lib/i18n';
import type { Json } from '@/lib/types';

const INPUT =
  'w-full rounded-[8px] border border-line bg-surface-container px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/40';

export type ItemFormValues = {
  id?: string;
  category_id: string;
  name: Json;
  description: Json;
  price: number;
  image_url: string | null;
  available: boolean;
  popular: boolean;
  sort_order: number;
};

/**
 * Shared create/edit form for a menu item.
 *
 * Names and descriptions are bilingual because the kiosk and storefront can
 * both run in English (003_i18n_jsonb.sql). Spanish is required; English is
 * optional and falls back to Spanish at render time.
 *
 * Price is shown in currency units and converted to integer cents server-side —
 * the schema never stores a float.
 */
export function ItemForm({
  action,
  restaurantId,
  categories,
  values,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  restaurantId: string;
  categories: Array<{ id: string; name: Json }>;
  values: ItemFormValues;
  submitLabel: string;
}) {
  return (
    <Card as="section" className="p-5">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre (ES) *">
            <input
              name="name_es"
              required
              maxLength={120}
              defaultValue={tr(values.name, 'es')}
              className={INPUT}
            />
          </Field>
          <Field label="Name (EN)">
            <input
              name="name_en"
              maxLength={120}
              defaultValue={tr(values.name, 'en')}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descripción (ES)">
            <textarea
              name="description_es"
              rows={3}
              maxLength={500}
              defaultValue={tr(values.description, 'es')}
              className={`${INPUT} resize-y`}
            />
          </Field>
          <Field label="Description (EN)">
            <textarea
              name="description_en"
              rows={3}
              maxLength={500}
              defaultValue={tr(values.description, 'en')}
              className={`${INPUT} resize-y`}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Precio *">
            <input
              name="price"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={(values.price / 100).toFixed(2)}
              className={INPUT}
            />
          </Field>
          <Field label="Categoría *">
            <select name="category_id" defaultValue={values.category_id} className={INPUT}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {tr(category.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Orden">
            <input
              name="sort_order"
              type="number"
              min={0}
              max={9999}
              defaultValue={values.sort_order}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label="Imagen (URL)">
          <input
            name="image_url"
            type="url"
            placeholder="https://…"
            defaultValue={values.image_url ?? ''}
            className={INPUT}
          />
        </Field>

        <div className="flex flex-wrap gap-5">
          <Check name="available" label="Disponible" defaultChecked={values.available} />
          <Check name="popular" label="Destacar como popular" defaultChecked={values.popular} />
        </div>

        <div>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <CardLabel className="mb-1.5">{label}</CardLabel>
      {children}
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-primary">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-[15px] accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

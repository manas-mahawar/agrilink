'use client';

import * as React from 'react';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/form-controls';
import { InfoTip } from '@/components/ui/overlays';
import { Notice } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { CATEGORIES, LOCALITIES } from '@/content/reference';
import { QUALITY_GRADES, QUALITY_LABEL } from '@/domain/listings';
import { formatINR, paiseToRupeeInput, parseRupeesToPaise } from '@/domain/money';
import { pricePerKgPaise, UNIT_HELP, UNIT_LABEL, UNITS, type Unit } from '@/domain/units';
import { todayIST } from '@/lib/utils';
import { createListingAction, updateListingAction } from '@/server/actions/listings';
import type { OwnListingDetail } from '@/server/data/dashboard';

const qtyInput = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function ListingForm({ listing }: { listing?: OwnListingDetail }) {
  const editing = Boolean(listing);
  const { state, pending, formProps, fieldErrors: fe, formError } = useFormAction(editing ? updateListingAction : createListingAction);
  const [unit, setUnit] = React.useState<Unit>(listing?.unit ?? 'quintal');
  const [price, setPrice] = React.useState(listing ? paiseToRupeeInput(listing.pricePerUnitPaise) : '');
  const [availability, setAvailability] = React.useState(listing?.availabilityType ?? 'pre_harvest');
  const pricePaise = parseRupeesToPaise(price);
  const unitLocked = Boolean(listing && (listing.quantityReserved > 0 || listing.quantitySold > 0));
  const archived = listing?.status === 'archived';

  return (
    <form {...formProps} className="flex flex-col gap-6">
      {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
      {state?.ok ? <Notice tone="ok">{state.message}</Notice> : null}
      <FormError message={formError} />
      {archived ? <Notice tone="info">Archived listings can’t be edited.</Notice> : null}

      <fieldset disabled={archived} className="flex flex-col gap-6">
        <Section title="The crop">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="l-category" label="Category" error={fe?.categoryId}>
              {(p) => (
                <Select {...p} name="categoryId" defaultValue={listing?.categoryId ?? ''} required>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="l-name" label="Produce name" hint="For example: Tomato, Potato, Onion" error={fe?.produceName}>
              {(p) => <Input {...p} name="produceName" defaultValue={listing?.produceName} maxLength={60} required />}
            </Field>
            <Field id="l-variety" label="Variety" optional hint="For example: Kufri Pukhraj, Punjab Ratta" error={fe?.variety}>
              {(p) => <Input {...p} name="variety" defaultValue={listing?.variety} maxLength={60} />}
            </Field>
            <Field id="l-locality" label="Village or nearest town" hint="Buyers see this, not your exact farm location." error={fe?.localityId}>
              {(p) => (
                <Select {...p} name="localityId" defaultValue={listing?.localityId ?? ''} required>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {LOCALITIES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (~{l.kmFromPatiala} km from Patiala)
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field id="l-desc" label="Description" optional hint="Growing method, packing, picking schedule — anything a buyer should know." error={fe?.description}>
            {(p) => <Textarea {...p} name="description" rows={4} maxLength={2000} defaultValue={listing?.description} />}
          </Field>
        </Section>

        <Section title="Quantity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="l-unit"
              label={
                <span className="inline-flex items-center gap-1.5">
                  Unit <InfoTip label="About units">{UNIT_HELP.quintal} {UNIT_HELP.tonne}</InfoTip>
                </span>
              }
              hint={unitLocked ? 'The unit can’t change once quantity has been reserved or sold.' : undefined}
              error={fe?.unit}
            >
              {(p) => (
                <>
                  <Select {...p} name="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} disabled={unitLocked}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABEL[u].plural} ({UNIT_LABEL[u].short})
                      </option>
                    ))}
                  </Select>
                  {unitLocked ? <input type="hidden" name="unit" value={unit} /> : null}
                </>
              )}
            </Field>
            <Field
              id="l-qty"
              label={`Expected quantity (${UNIT_LABEL[unit].plural})`}
              hint={listing && listing.quantityReserved + listing.quantitySold > 0 ? `${listing.quantityReserved + listing.quantitySold} already reserved or sold.` : undefined}
              error={fe?.quantityTotal}
            >
              {(p) => <Input {...p} name="quantityTotal" inputMode="decimal" defaultValue={qtyInput(listing?.quantityTotal)} required />}
            </Field>
            <Field id="l-min" label={`Minimum order (${UNIT_LABEL[unit].plural})`} error={fe?.minOrderQty}>
              {(p) => <Input {...p} name="minOrderQty" inputMode="decimal" defaultValue={qtyInput(listing?.minOrderQty)} required />}
            </Field>
            <Field id="l-max" label={`Maximum order (${UNIT_LABEL[unit].plural})`} optional error={fe?.maxOrderQty}>
              {(p) => <Input {...p} name="maxOrderQty" inputMode="decimal" defaultValue={qtyInput(listing?.maxOrderQty)} />}
            </Field>
          </div>
        </Section>

        <Section title="Price">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="l-price"
              label={`Asking price (₹ per ${UNIT_LABEL[unit].singular})`}
              hint={pricePaise && unit !== 'kg' ? `= ${formatINR(pricePerKgPaise(pricePaise, unit))} per kg` : 'Buyers can offer a different price; you decide.'}
              error={fe?.price}
            >
              {(p) => <Input {...p} name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />}
            </Field>
          </div>
        </Section>

        <Section title="Timing">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Is the crop ready?</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['pre_harvest', 'Not yet — before harvest'],
                  ['ready_now', 'Ready now'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3.5 has-[:checked]:border-forest has-[:checked]:bg-sage-soft">
                  <input type="radio" name="availabilityType" value={v} checked={availability === v} onChange={() => setAvailability(v)} className="accent-forest" />
                  <span className="text-[15px]">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="l-harvest"
              label="Expected harvest date"
              optional={availability === 'ready_now'}
              error={fe?.expectedHarvestDate}
            >
              {(p) => <Input {...p} name="expectedHarvestDate" type="date" min={editing ? undefined : todayIST()} defaultValue={listing?.expectedHarvestDate} />}
            </Field>
            <Field id="l-until" label="Available until" optional error={fe?.availableUntil}>
              {(p) => <Input {...p} name="availableUntil" type="date" defaultValue={listing?.availableUntil} />}
            </Field>
          </div>
        </Section>

        <Section title="Quality">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="l-grade" label="Declared quality" hint="Describe it honestly — buyers can report misleading listings." error={fe?.qualityGrade}>
              {(p) => (
                <Select {...p} name="qualityGrade" defaultValue={listing?.qualityGrade ?? 'grade_a'}>
                  {QUALITY_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {QUALITY_LABEL[g]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="l-qnotes" label="Quality notes" optional error={fe?.qualityNotes}>
              {(p) => <Textarea {...p} name="qualityNotes" rows={2} maxLength={500} defaultValue={listing?.qualityNotes} />}
            </Field>
          </div>
        </Section>

        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          {editing ? (
            <SubmitButton size="lg" pending={pending} pendingLabel="Saving…">
              Save changes
            </SubmitButton>
          ) : (
            <>
              <SubmitButton size="lg" name="publish" value="active" pending={pending} pendingLabel="Publishing…">
                Publish listing
              </SubmitButton>
              <SubmitButton size="lg" variant="secondary" name="publish" value="draft" pending={pending} pendingLabel="Saving…">
                Save as draft
              </SubmitButton>
            </>
          )}
        </div>
        {!editing ? <p className="-mt-3 text-sm text-muted">You can add photos on the next screen.</p> : null}
      </fieldset>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

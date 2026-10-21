'use client';

import { Field, FormError, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Notice } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { BUYER_TYPE_LABEL, BUYER_TYPES } from '@/domain/validation';
import { updateProfileAction } from '@/server/actions/account';

export interface ProfileValues {
  displayName: string;
  organisationName: string;
  buyerType: string;
  district: string;
  village: string;
  bio: string;
  phone: string;
}

export function ProfileForm({ accountType, values }: { accountType: 'farmer' | 'buyer'; values: ProfileValues }) {
  const { state, pending, formProps, formError, fieldErrors: fe } = useFormAction(updateProfileAction);
  return (
    <form {...formProps} className="flex flex-col gap-5 rounded-lg border border-line bg-white p-5 sm:p-6">
      {state?.ok ? <Notice tone="ok">{state.message}</Notice> : null}
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="p-name" label="Your name" error={fe?.displayName}>
          {(p) => <Input {...p} name="displayName" defaultValue={values.displayName} maxLength={80} required />}
        </Field>
        <Field id="p-phone" label="Mobile number" optional hint="Private. Shared only with the other side of a confirmed order." error={fe?.phone}>
          {(p) => <Input {...p} name="phone" type="tel" defaultValue={values.phone} />}
        </Field>
        {accountType === 'buyer' ? (
          <>
            <Field id="p-org" label="Business name" error={fe?.organisationName}>
              {(p) => <Input {...p} name="organisationName" defaultValue={values.organisationName} maxLength={120} />}
            </Field>
            <Field id="p-btype" label="Type of business" optional error={fe?.buyerType}>
              {(p) => (
                <Select {...p} name="buyerType" defaultValue={values.buyerType}>
                  <option value="">Choose…</option>
                  {BUYER_TYPES.map((b) => (
                    <option key={b} value={b}>
                      {BUYER_TYPE_LABEL[b]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        ) : null}
        <Field id="p-district" label="District" optional error={fe?.district}>
          {(p) => <Input {...p} name="district" defaultValue={values.district} maxLength={80} />}
        </Field>
        <Field id="p-village" label="Village or town" optional hint={accountType === 'farmer' ? 'Shown on your public profile.' : undefined} error={fe?.village}>
          {(p) => <Input {...p} name="village" defaultValue={values.village} maxLength={80} />}
        </Field>
      </div>
      <Field id="p-bio" label={accountType === 'farmer' ? 'About your farm' : 'About your business'} optional hint={accountType === 'farmer' ? 'Shown on your public profile. Don’t include your phone number or exact address.' : undefined} error={fe?.bio}>
        {(p) => <Textarea {...p} name="bio" rows={4} maxLength={600} defaultValue={values.bio} />}
      </Field>
      <SubmitButton className="self-start" pending={pending} pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}

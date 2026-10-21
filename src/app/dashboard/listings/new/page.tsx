import type { Metadata } from 'next';
import { ListingForm } from '@/components/dashboard/listing-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireFarmer } from '@/server/auth';

export const metadata: Metadata = { title: 'New listing' };

export default async function NewListingPage() {
  await requireFarmer('/dashboard/listings/new');
  return (
    <>
      <PageHeader title="New listing" description="Tell buyers what you are growing, how much you expect, when it will be ready and your asking price." />
      <ListingForm />
    </>
  );
}

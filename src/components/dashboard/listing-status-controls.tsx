'use client';

import { Archive, Pause, Play, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { canOwnerMoveListing, type ListingStatus } from '@/domain/listings';
import { deleteDraftListingAction, setListingStatusAction } from '@/server/actions/listings';

export function ListingStatusControls({
  listingId,
  status,
  quantityAvailable,
  hiddenByAdmin,
  compact = false,
}: {
  listingId: string;
  status: ListingStatus;
  quantityAvailable: number;
  hiddenByAdmin: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const can = (to: ListingStatus) => canOwnerMoveListing(status, to, quantityAvailable, hiddenByAdmin);
  const set = (to: 'active' | 'paused' | 'archived') =>
    startTransition(async () => {
      const res = await setListingStatusAction(listingId, to);
      if (res.ok) toast.success(res.message ?? 'Updated');
      else toast.error(res.error);
    });
  const size = compact ? 'sm' : 'md';

  return (
    <div className="flex flex-wrap gap-2">
      {can('active') ? (
        <Button size={size} disabled={pending} onClick={() => set('active')}>
          <Play /> {status === 'draft' ? 'Publish' : 'Resume'}
        </Button>
      ) : null}
      {can('paused') ? (
        <Button size={size} variant="secondary" disabled={pending} onClick={() => set('paused')}>
          <Pause /> Pause
        </Button>
      ) : null}
      {can('archived') && status !== 'draft' ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button size={size} variant="ghost" disabled={pending}>
              <Archive /> Archive
            </Button>
          </DialogTrigger>
          <DialogContent title="Archive this listing?" description="It will be removed from the marketplace and any open offers on it will be closed. Existing orders are not affected. This can’t be undone.">
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Keep listing</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger" onClick={() => set('archived')}>
                  Archive listing
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {status === 'draft' ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button size={size} variant="ghost" className="text-danger" disabled={pending}>
              <Trash2 /> Delete draft
            </Button>
          </DialogTrigger>
          <DialogContent title="Delete this draft?" description="The draft and its photos will be deleted permanently.">
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteDraftListingAction(listingId);
                    if (res && !res.ok) toast.error(res.error);
                  })
                }
              >
                Delete draft
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

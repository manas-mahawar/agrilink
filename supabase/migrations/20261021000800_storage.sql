-- Storage buckets and object policies.
-- Paths:  listing-images/<farmer_id>/<listing_id>/<random>.webp
--         avatars/<user_id>/<random>.webp
-- Buckets are public-read (photos are meant to be seen on the marketplace); writes are
-- restricted to the owner's folder, image types only, with size limits enforced by Storage.
-- The app re-encodes every upload on the server (strips EXIF/GPS metadata) before storing it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.owns_listing_folder(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.listings l
    where l.id = p_listing_id and l.farmer_id = auth.uid() and l.status <> 'archived'
  );
$$;
revoke execute on function public.owns_listing_folder(uuid) from public, anon, authenticated;
grant execute on function public.owns_listing_folder(uuid) to authenticated;

create policy "listing-images: farmers upload to their own listing folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.owns_listing_folder(public.try_uuid((storage.foldername(name))[2]))
  );

create policy "listing-images: farmers read their own object rows"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "listing-images: farmers delete their own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users read their own object rows"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users delete their own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

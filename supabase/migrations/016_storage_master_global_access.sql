drop policy if exists intorna_media_insert on storage.objects;
drop policy if exists intorna_media_select on storage.objects;
drop policy if exists intorna_media_update on storage.objects;
drop policy if exists intorna_media_delete on storage.objects;

create policy intorna_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'intorna-media'
  and (
    private.is_platform_admin()
    or (storage.foldername(name))[1] in (
      select sm.studio_id::text from public.studio_members sm
      where sm.user_id = (select auth.uid()) and sm.active
    )
  )
);

create policy intorna_media_select on storage.objects
for select to authenticated
using (
  bucket_id = 'intorna-media'
  and (
    private.is_platform_admin()
    or (storage.foldername(name))[1] in (
      select sm.studio_id::text from public.studio_members sm
      where sm.user_id = (select auth.uid()) and sm.active
    )
  )
);

create policy intorna_media_update on storage.objects
for update to authenticated
using (
  bucket_id = 'intorna-media'
  and (
    private.is_platform_admin()
    or (storage.foldername(name))[1] in (
      select sm.studio_id::text from public.studio_members sm
      where sm.user_id = (select auth.uid()) and sm.active
    )
  )
)
with check (
  bucket_id = 'intorna-media'
  and (
    private.is_platform_admin()
    or (storage.foldername(name))[1] in (
      select sm.studio_id::text from public.studio_members sm
      where sm.user_id = (select auth.uid()) and sm.active
    )
  )
);

create policy intorna_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'intorna-media'
  and (
    private.is_platform_admin()
    or (storage.foldername(name))[1] in (
      select sm.studio_id::text from public.studio_members sm
      where sm.user_id = (select auth.uid()) and sm.active
    )
  )
);

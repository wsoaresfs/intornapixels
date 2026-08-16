create policy platform_integrations_no_client_access
on public.platform_integrations
for all
to anon, authenticated
using (false)
with check (false);

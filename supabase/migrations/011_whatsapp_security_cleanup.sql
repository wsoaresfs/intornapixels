-- v7: mantém configuração global invisível para clientes e limpa alertas de segurança
create policy whatsapp_platform_config_no_client_access on public.whatsapp_platform_config for select to authenticated using(false);
revoke all on vault.decrypted_secrets from anon, authenticated;

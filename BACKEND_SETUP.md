# Backend do Intorná Pixels v11

## 1. Banco e autenticação
1. Crie o projeto no Supabase.
2. Execute todos os SQLs de `supabase/migrations/`, em ordem numérica.
3. Em Authentication > URL Configuration, defina a URL pública e os redirects exatos de `/portal/`, `/app/` e `/admin/`.
4. Crie o primeiro usuário administrador e registre seu UUID em `platform_admins`:

```sql
insert into public.platform_admins(user_id) values ('UUID-DO-USUARIO');
```

As migrações ativam RLS, criam helpers no schema privado e aplicam permissões explícitas do Data API.

## 2. Edge Functions

Implante as funções listadas em `supabase/functions/DEPLOYED_FUNCTIONS.md`. As funções de webhook e portal público usam `--no-verify-jwt`; as demais exigem sessão:

```bash
supabase functions deploy bootstrap-account
supabase functions deploy admin-control
supabase functions deploy create-asaas-subscription
supabase functions deploy cancel-asaas-subscription
supabase functions deploy generate-image
supabase functions deploy manage-client-portal
supabase functions deploy referral-program
supabase functions deploy whatsapp-connect
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-media
supabase functions deploy asaas-webhook --no-verify-jwt
supabase functions deploy client-portal --no-verify-jwt
supabase functions deploy client-checkout --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

## 3. Segredos

Configure no ambiente seguro das Edge Functions:
- `ASAAS_API_KEY`;
- `ASAAS_BASE_URL` (sandbox durante os testes);
- `ASAAS_WEBHOOK_TOKEN`;
- `OPENAI_API_KEY` para geração de imagens;
- `SUPABASE_URL` e chave backend disponibilizada pelo projeto.

Tokens do WhatsApp e Meta App Secret são armazenados no Supabase Vault pelo fluxo administrativo. Consulte `WHATSAPP_META_SETUP.md`.

## 4. Frontend

Em `shared/supabase-config.js`, mantenha somente:
- URL pública do projeto;
- Publishable Key/Anon Key pública.

Publique a pasta inteira na Vercel ou em outra hospedagem estática com HTTPS. Não exponha Service Role, Secret Key, token Meta, chave Asaas ou chave de IA.

## 5. Teste obrigatório antes da produção
- cadastro, confirmação de e-mail e login;
- criação e isolamento entre dois estúdios;
- Funil Comercial, orçamento e conversão em pedido;
- sincronização após sair e entrar novamente;
- cobrança no sandbox e confirmação pelo webhook;
- portal do cliente e checkout;
- envio/recebimento pelo WhatsApp;
- geração de imagem com limite mensal;
- bloqueio de usuário não administrador em `/admin/` e `admin-control`.

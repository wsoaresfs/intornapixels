# Intorná Pixels v4 — Banco online + cobrança recorrente

## Stack escolhida
- Frontend: Netlify (pode continuar como está)
- Banco/Auth: Supabase (Postgres + Auth + RLS)
- Backend seguro: Supabase Edge Functions
- Cobrança recorrente: Asaas

## 1. Criar Supabase
1. Crie um projeto em supabase.com.
2. Abra SQL Editor e execute `supabase/migrations/001_intorna_pixels_saas.sql`.
3. Em Authentication, crie seu usuário administrador.
4. Copie o UUID do usuário e execute:
   `insert into public.platform_admins(user_id) values ('UUID-AQUI');`
5. Em Authentication > URL Configuration, configure a URL publicada do Netlify:
   - **Site URL:** use o domínio oficial publicado.
   - **Redirect URLs:** autorize o mesmo domínio, incluindo `/portal/` e o fluxo `/portal/?mode=recovery`.
   - Sem isso, links de confirmação/recuperação podem voltar para uma URL antiga/local.

## 2. Segredos das Edge Functions
No Supabase, configure os Secrets (não salve no frontend):
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` para testes
- `ASAAS_WEBHOOK_TOKEN` com 32+ caracteres

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam disponíveis/configurados no ambiente das funções conforme seu projeto; confirme no painel antes do deploy.

## 3. Deploy das funções
Com Supabase CLI:
- `supabase functions deploy create-asaas-subscription`
- `supabase functions deploy asaas-webhook --no-verify-jwt`
- `supabase functions deploy cancel-asaas-subscription`

O webhook precisa aceitar chamadas sem JWT porque o chamador é o Asaas; a função valida o header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`.

## 4. Criar webhook no Asaas
Configure a URL:
`https://SEU-PROJETO.supabase.co/functions/v1/asaas-webhook`

Use o mesmo token seguro configurado em `ASAAS_WEBHOOK_TOKEN`.
Eventos mínimos recomendados para o MVP:
- PAYMENT_CREATED
- PAYMENT_CONFIRMED
- PAYMENT_RECEIVED
- PAYMENT_OVERDUE
- PAYMENT_REFUNDED
- PAYMENT_DELETED

## 5. Teste primeiro no Sandbox
Mantenha `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` até concluir os testes de assinatura, webhook, atraso e cancelamento.
Somente depois troque para a URL de produção indicada pela documentação atual do Asaas e use a chave de produção.

## 6. Banco multiestúdio
O schema usa `studio_id` em todas as tabelas de negócio e Row Level Security. Um usuário autenticado só acessa dados dos estúdios em que é membro. Administradores da plataforma são definidos separadamente em `platform_admins`.

## 7. Migração da versão local
A v3 ainda usa LocalStorage. Não apague os dados atuais antes de exportar backup.
A próxima etapa de frontend é trocar as operações de `shared/platform.js` por Supabase Auth e consultas às tabelas criadas acima.

## 8. Segurança
- Nunca coloque `service_role` ou chave Asaas no Netlify/JavaScript público.
- Toda criação/cancelamento de assinatura deve passar por Edge Function.
- Webhook deve validar `asaas-access-token`.
- RLS deve permanecer habilitado.
- Use HTTPS (Netlify e Supabase já fornecem).


## Atualização v7.1 — WhatsApp sem WABA
A versão de lançamento usa WhatsApp direto por link (`wa.me`) e não depende de WABA/Cloud API. A Inbox oficial da Meta permanece apenas como infraestrutura futura e não é carregada pela interface. Consulte `WHATSAPP_SEM_WABA.md`.

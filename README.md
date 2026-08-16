# Intorná Pixels v7.7 — Estrutura Vercel

Estrutura preparada para migrar o frontend do **Netlify para a Vercel**, mantendo o **Supabase como backend**.

## Arquitetura

- `public/` — único diretório publicado pela Vercel.
- `supabase/` — migrations e Edge Functions; não é publicado como conteúdo estático.
- `docs/` — documentação e histórico; não é publicado.
- `vercel.json` — configuração de rotas, headers, trailing slash e diretório de saída.

## Produção

- Frontend/PWA: Vercel
- Auth/Postgres/Storage/Vault/Edge Functions: Supabase
- IA: Google Gemini Image + OpenAI
- Pagamentos: Asaas
- WAHA: opcional, somente Master

## Rotas preservadas

- `/portal/` — autenticação
- `/app/` — operação do estúdio
- `/admin/` — Central Administrativa Master
- `/cliente/` — portal/área do cliente
- `/entrar` → `/portal/`
- `/painel` → `/app/`
- `/administracao` → `/admin/`

## Vercel

O projeto é estático e não exige build. `vercel.json` define `public/` como Output Directory. Ao importar na Vercel, use o preset **Other** e mantenha a raiz do repositório como Root Directory.

## Supabase Auth

Depois do primeiro deploy, atualize Authentication → URL Configuration com o domínio real da Vercel. Consulte `docs/SUPABASE_AUTH_VERCEL.md`.

## Segurança

Nenhuma chave privada deve ser colocada na Vercel ou em `public/`. A chave publicável do Supabase pode permanecer em `public/shared/supabase-config.js`; as credenciais Google, OpenAI, Asaas e WAHA permanecem no Vault/Edge Functions do Supabase.

## Pendência funcional conhecida

A migração para Vercel não corrige automaticamente a pendência atual da Edge Function `generate-image`. Ela deve ser tratada separadamente antes do lançamento comercial.

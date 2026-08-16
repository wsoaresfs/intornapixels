# Checklist de Go-Live — Vercel

## Antes do deploy

- [ ] `vercel.json` na raiz.
- [ ] `public/` contém todo o frontend.
- [ ] `supabase/` fica fora de `public/`.
- [ ] Nenhum secret dentro de `public/`.
- [ ] Service Worker com cache `v7-7-vercel`.

## Primeiro deploy

- [ ] Criar projeto na Vercel.
- [ ] Framework Preset = Other.
- [ ] Root Directory = raiz.
- [ ] Output Directory = `public`.
- [ ] Fazer deploy.
- [ ] Abrir `/`, `/portal/`, `/app/` e `/admin/`.

## Supabase

- [ ] Atualizar Site URL.
- [ ] Adicionar redirect `/portal/`.
- [ ] Adicionar redirect `/portal/?mode=recovery`.
- [ ] Manter URLs Netlify apenas durante transição.

## Testes

- [ ] Cadastro novo.
- [ ] Confirmação de e-mail.
- [ ] Login/logout.
- [ ] Recuperação de senha.
- [ ] Master acessa Admin.
- [ ] Usuário comum entra somente no próprio estúdio.
- [ ] Upload de imagem de referência.
- [ ] Portal do cliente.
- [ ] PWA instala/abre corretamente.
- [ ] Testar em Android e iPhone.

## Integrações

- [ ] Google conectado.
- [ ] Corrigir e validar `generate-image`.
- [ ] OpenAI conectar/testar.
- [ ] Asaas sandbox conectar/testar.
- [ ] Webhook Asaas configurar/testar.
- [ ] WAHA, se fizer parte do lançamento.

## Corte definitivo

- [ ] Configurar domínio próprio na Vercel, se houver.
- [ ] Repetir URLs do domínio próprio no Supabase Auth.
- [ ] Teste completo de produção.
- [ ] Remover redirects antigos do Netlify do Supabase.
- [ ] Desativar site antigo somente após validação.

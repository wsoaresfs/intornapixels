# Migração do Intorná Pixels: Netlify → Vercel

## O que muda

Somente a camada de hospedagem do frontend. O Supabase continua sendo o backend oficial.

### Antes
- Frontend: Netlify
- Backend: Supabase

### Depois
- Frontend: Vercel
- Backend: Supabase

Não é necessário migrar banco, Auth, Storage, Vault ou Edge Functions.

## Estrutura preparada

A Vercel publica somente `public/`. Isso evita expor por engano migrations, código das Edge Functions e documentos internos.

`vercel.json` já contém:
- `outputDirectory: public`;
- trailing slash para preservar `/portal/`, `/app/`, `/admin/` e `/cliente/`;
- redirects de conveniência;
- headers básicos de segurança;
- noindex nas áreas autenticadas;
- regra de atualização imediata para `sw.js`.

## Configuração do projeto na Vercel

Ao criar/importar o projeto:

- Framework Preset: **Other**
- Root Directory: `.`
- Build Command: vazio
- Output Directory: `public` (já definido em `vercel.json`)
- Install Command: vazio
- Production Branch: `main` se usar GitHub

A Vercel suporta sites HTML/CSS/JS estáticos sem etapa de build.

## Domínio

No primeiro deploy a Vercel fornecerá um domínio `*.vercel.app`. Depois, se houver domínio próprio, configure-o no projeto e também no Supabase Auth.

Não hardcode o domínio Vercel no frontend. O portal já usa `location.origin` para confirmação e recuperação de senha.

## Variáveis na Vercel

Na versão atual, nenhuma variável secreta é necessária na Vercel.

Não copie para Vercel:
- Service Role do Supabase;
- Google API Key;
- OpenAI API Key;
- Asaas API Key;
- token de webhook Asaas;
- WAHA API Key.

Esses segredos pertencem ao Supabase Vault/Edge Functions.

## Service Worker

O cache foi alterado para `intorna-pixels-v7-7-vercel` e agora evita interceptar Supabase/CDNs/APIs externas. Navegações usam network-first para diminuir risco de uma versão antiga continuar aparecendo após deploy.

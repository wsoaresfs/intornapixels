# Deploy na Vercel — passo a passo

## Caminho recomendado: GitHub + Vercel

1. Crie um repositório privado no GitHub.
2. Envie todo o conteúdo da pasta `INTORNA_PIXELS_v7_7_VERCEL` para a raiz do repositório.
3. Na Vercel, escolha **Add New → Project** e importe o repositório.
4. Em Framework Preset, escolha **Other**.
5. Confirme que Output Directory é `public`.
6. Clique em Deploy.
7. Abra o endereço fornecido pela Vercel e teste `/portal/`.
8. Só então atualize as URLs do Supabase Auth conforme `SUPABASE_AUTH_VERCEL.md`.

## Vercel CLI (alternativo)

Com Node.js e Vercel CLI instalados, na raiz do projeto:

`vercel`

Para promover à produção:

`vercel --prod`

O arquivo `vercel.json` mantém a configuração versionada no próprio projeto.

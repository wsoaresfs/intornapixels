# Intorná Pixels RC22.5 — Catálogos de amostra

## Fluxo

1. O usuário abre **Catálogos** no painel do estúdio.
2. Cria um catálogo específico ou usa o modelo **Catálogo geral**.
3. Envia as imagens e classifica cada uma por tipo de ensaio.
4. Publica o catálogo e copia o link ou abre o WhatsApp.
5. O cliente filtra os modelos, amplia uma imagem e responde com **Gostei deste modelo**.

## Privacidade e segurança

- os catálogos e itens pertencem ao estúdio e usam RLS;
- os arquivos permanecem no bucket privado `intorna-media`;
- o link público contém um token UUID não sequencial;
- a Edge Function entrega somente catálogos publicados;
- cada imagem recebe um link assinado temporário de uma hora;
- o acesso público possui limite de requisições;
- o token não concede acesso direto às tabelas nem ao Storage.

## Componentes

- `backend/migrations/rc22_5_sample_catalogs.sql`
- `backend/migrations/rc22_5_catalog_indexes.sql`
- `backend/public-catalog/index.ts`
- `app/features-v25-catalogs.js`
- `catalogo/index.html`

## Ordem de publicação

1. aplicar a migração;
2. publicar a Edge Function `public-catalog` sem verificação JWT do gateway;
3. publicar o frontend;
4. criar um catálogo, adicionar fotos, publicar e testar o link em janela anônima.

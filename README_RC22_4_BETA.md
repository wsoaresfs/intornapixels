# Intorná Pixels RC22.4 — Beta controlado

Data: 23/08/2026

## Objetivo

Validar o produto com três usuários reais antes do lançamento comercial, priorizando o fluxo para iniciantes:

1. informar apenas o assunto do anúncio;
2. receber um prompt completo;
3. gerar no ChatGPT ou diretamente pela API individual;
4. importar a arte e avaliar na Meta AI;
5. gerar uma V2 a partir do feedback;
6. relatar dúvidas e erros dentro do aplicativo.

## Regras desta fase

- acesso somente por convite;
- capacidade inicial de 3 participantes;
- beta gratuito, sem assinatura ou cobrança Asaas;
- cada usuário usa sua própria chave da API OpenAI para geração direta;
- ChatGPT Plus pode ser usado no fluxo manual, sem chave de API;
- aceite versionado dos Termos e da Política de Privacidade;
- dados isolados por estúdio com RLS;
- suporte e feedback acompanhados pela Central Administrativa.

## Componentes novos

- `backend/beta-access/index.ts`: cadastro público protegido por convite, limite e rate limit;
- `backend/bootstrap-account/index.ts`: criação de estúdio somente para convidado ou administrador;
- `backend/migrations/rc22_4_controlled_beta.sql`: participantes, consentimentos, capacidade e segredo no Vault;
- `app/features-v24-beta.js`: onboarding, sinalização do beta e feedback;
- `admin/features-v24-beta.js`: acompanhamento dos três participantes;
- `termos.html` e `privacidade.html`: documentos específicos do beta.

## Publicação

Aplicar primeiro a migração, guardar o código com `set_platform_integration_secret('beta_invite', ...)`, publicar as Edge Functions e somente depois publicar o frontend.

Não colocar o código de convite no GitHub, HTML, JavaScript, logs ou variáveis públicas.

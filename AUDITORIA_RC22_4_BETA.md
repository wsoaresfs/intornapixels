# Auditoria RC22.4 Beta

## Verificações executadas

- JavaScript do frontend validado com `node --check`;
- TypeScript das Edge Functions validado com o parser nativo do Node;
- `vercel.json` validado como JSON;
- páginas principais verificadas quanto à estrutura HTML;
- `beta-access` publicado com `verify_jwt=false` e autenticação própria por convite;
- `bootstrap-account` publicado com `verify_jwt=true`;
- teste público de status retornou 3 vagas disponíveis;
- teste de convite inválido retornou HTTP 403 sem criar usuário;
- RLS confirmado em `beta_participants` e `legal_consents`;
- convite confirmado no Supabase Vault;
- capacidade confirmada em 3 e beta habilitado;
- área de cobrança ocultada e marcada como desativada no frontend.

## Segurança

- segredo do convite não está no repositório;
- senhas exigem 10 caracteres, maiúscula, minúscula e número;
- cadastro tem rate limit por IP;
- consentimentos jurídicos têm versão e horário gerados no servidor;
- usuário comum sem convite não ganha estúdio no bootstrap;
- chave OpenAI continua individual e criptografada no Vault;
- bucket de mídia permanece privado.

## Aviso conhecido

O Supabase informa que a proteção contra senhas vazadas está desabilitada. No plano atual ela não está disponível; a senha forte continua obrigatória no cadastro do beta.

## Fora do beta

- cobrança real Asaas;
- divulgação aberta sem convite;
- WhatsApp oficial da Meta;
- garantias comerciais/SLA;
- escala além de três participantes.

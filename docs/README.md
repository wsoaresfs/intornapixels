# Intorná Pixels v5

Versão online do SaaS Intorná Pixels.

## Arquitetura
- Frontend/PWA: Netlify
- Banco e Auth: Supabase/Postgres
- Backend: Supabase Edge Functions
- Cobrança recorrente: Asaas

## Áreas
- `/portal/` — login e criação de conta
- `/app/` — operação do estúdio
- `/admin/` — central administrativa da plataforma

## Recursos em nuvem
Clientes, pedidos, extras, checklists, chamados, planos, assinaturas, pagamentos, configurações e administração são persistidos no Supabase com isolamento por estúdio via RLS.

## Primeiro acesso
A primeira conta confirmada e autenticada que executar o onboarding será cadastrada como administrador principal e receberá um estúdio inicial.

## Cobrança
As Edge Functions do Asaas já fazem parte do projeto e do backend implantado. Para habilitar transações é obrigatório configurar os Secrets do Asaas no Supabase e o webhook no painel do Asaas. Consulte `ATUALIZACAO_V5_SUPABASE_CLOUD.txt`.

## Publicação no Netlify
Publique o conteúdo deste projeto mantendo `index.html` na raiz. O arquivo ZIP de entrega já é criado dessa forma.

## Segurança
- Chave publishable do Supabase pode estar no frontend e é protegida pelas políticas RLS.
- Nunca exponha Secret Key/Service Role do Supabase.
- Nunca exponha `ASAAS_API_KEY`.
- Fotografias do módulo de marca-d'água continuam processadas localmente no navegador nesta versão.


## Atualização v7.1 — WhatsApp sem WABA
A versão de lançamento usa WhatsApp direto por link (`wa.me`) e não depende de WABA/Cloud API. A Inbox oficial da Meta permanece apenas como infraestrutura futura e não é carregada pela interface. Consulte `WHATSAPP_SEM_WABA.md`.


## Atualização v7.2 — WAHA Teste (somente administrador)

Esta versão adiciona um painel experimental de WAHA dentro da aba WhatsApp, disponível apenas para o administrador da plataforma. O objetivo é testar QR, conversas e envio de mensagens usando uma instância WAHA própria, sem liberar essa função para os estúdios assinantes.


## Atualização v7.3 — Master com acesso geral

A Central Administrativa agora inclui **Clientes & Pedidos** para o administrador master. O master pode pesquisar clientes de todos os estúdios, editar cadastro, telefone, e-mail, cidade, data importante, etapa e observações, abrir a operação do estúdio, visualizar pedidos vinculados, alterar status/pagamento e excluir clientes com confirmação reforçada. As permissões continuam protegidas pelas políticas RLS existentes do Supabase e pelo requisito de administrador da plataforma.

## Atualização v7.4 — Cadastro e login resilientes

A v7.4 corrige o onboarding e a autenticação: recuperação automática de contas sem vínculo com estúdio, proteção contra cadastro duplicado, reenvio de confirmação, mensagens de login mais claras e fluxo completo de redefinição de senha.

O `bootstrap-account` v3 deve estar implantado no Supabase (já implantado no projeto principal). Antes de publicar em produção, confira a **Authentication > URL Configuration** para garantir que o domínio publicado e `/portal/` estejam autorizados como destino dos e-mails de confirmação e recuperação.

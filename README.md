# Intorná Pixels v11 — Comercial, Orçamentos e Produção

SaaS multiestúdio para organizar vendas, produção e entrega de ensaios fotográficos criados com IA.

## Novidades v10 — Funil Comercial
- quadro Kanban com etapas do novo lead ao fechamento;
- origem, campanha, valor provável e anotações por oportunidade;
- filtros, busca, atalhos para WhatsApp e orçamento;
- movimentação por arrastar no computador e setas no celular;
- Performance de Vendas filtrável por origem e campanha;
- faturamento calculado pela data em que o pedido foi marcado como pago.

## Novidades v11 — Orçamentos Inteligentes
- cálculo automático de pacote, adicionais e desconto;
- validade e status da proposta;
- envio de mensagem pronta pelo WhatsApp;
- impressão ou salvamento em PDF;
- indicadores de negociação e valor em aberto;
- conversão direta do orçamento em pedido, sem redigitar dados;
- sincronização no workspace online do estúdio.

## Recursos anteriores
- Central de Produção Kanban com prazos, pagamentos e ações rápidas;
- Performance com faturamento, conversão, CPL, CPA, ticket, resultado e ROAS;
- WhatsApp Inbox oficial da Meta;
- AI Director, geração de imagens, galeria e portal do cliente;
- prévias com marca-d'água e venda de fotos extras;
- painel administrativo, planos, cobrança Asaas, suporte e auditoria.

## Arquitetura
- Frontend/PWA: Vercel ou hospedagem estática compatível;
- Banco, autenticação, arquivos e Vault: Supabase;
- Backend: Supabase Edge Functions;
- Cobrança: Asaas;
- Mensageria: WhatsApp Cloud API oficial da Meta.

## Áreas
- `/portal/` — cadastro e login;
- `/app/` — operação do estúdio;
- `/admin/` — administração da plataforma;
- `/cliente/` — galeria e checkout do cliente.

## Instalação
1. Execute, em ordem, todos os arquivos de `supabase/migrations/`.
2. Implante as funções de `supabase/functions/`.
3. Configure os segredos descritos em `BACKEND_SETUP.md`.
4. Configure `shared/supabase-config.js` com URL e Publishable Key.
5. Publique o conteúdo desta pasta preservando `index.html` na raiz.

Nunca coloque Secret Key, Service Role, chave Asaas, token Meta ou chave de IA no frontend.

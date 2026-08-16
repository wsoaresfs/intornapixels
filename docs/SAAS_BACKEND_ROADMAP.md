# Roadmap técnico — Intorná Pixels SaaS

## Fase 1 — Validação

Publicar o MVP estático, convidar de 10 a 30 usuários e validar:

- cadastro e fluxo de pedidos;
- utilidade do gerador de prompts;
- disposição a pagar R$ 19,90;
- recursos mais usados;
- principais dúvidas e dificuldades.

## Fase 2 — Backend e contas

### Stack recomendada

- Frontend: Next.js.
- Hospedagem: Vercel.
- Banco, login e arquivos: Supabase.
- Cobrança Brasil: Asaas ou Mercado Pago.
- E-mail transacional: Resend.
- Monitoramento: Sentry.

### Tabelas principais

- `studios`: nome, plano, status, data de renovação.
- `profiles`: usuário, estúdio, função e permissões.
- `clients`: clientes pertencentes ao estúdio.
- `orders`: pedidos, pacote, total, prazo e status.
- `packages`: pacotes próprios de cada estúdio.
- `subscriptions`: assinatura, gateway e situação.
- `usage_monthly`: uso e limites mensais.
- `prompt_templates`: biblioteca geral e privada.
- `quality_checks`: revisões por pedido.
- `audit_logs`: ações relevantes e segurança.

## Fase 3 — Cobrança recorrente

- Plano Gratuito: 10 ensaios e 5 clientes.
- Start: R$ 19,90/mês e 30 ensaios.
- Pro: R$ 39,90/mês e 150 ensaios.
- Studio: R$ 69,90/mês e limite elevado.

O gateway deve enviar webhooks para ativar, renovar, suspender ou cancelar o plano.

## Fase 4 — Arquivos e LGPD

- Consentimento e finalidade de uso das fotos.
- Criptografia e links temporários.
- Política de retenção e exclusão.
- Isolamento de dados por estúdio.
- Exportação e portabilidade.
- Termos e política revisados por advogado.

## Fase 5 — Crescimento

- Programa de indicação.
- Teste grátis do Start.
- Onboarding guiado.
- Modelos de WhatsApp e catálogos.
- Marketplace de prompts e referências.
- Academy com cursos para iniciantes.


## Atualização v7.1 — WhatsApp sem WABA
A versão de lançamento usa WhatsApp direto por link (`wa.me`) e não depende de WABA/Cloud API. A Inbox oficial da Meta permanece apenas como infraestrutura futura e não é carregada pela interface. Consulte `WHATSAPP_SEM_WABA.md`.

# Intorná Pixels v7 — Ativação do WhatsApp Cloud API

A v7 já contém banco, Inbox, webhooks e Edge Functions. A integração usa a WhatsApp Cloud API oficial.

## 1. Aplicativo Meta da plataforma
Na conta administrativa do Intorná Pixels, abra **WhatsApp > Configurar WhatsApp Cloud API**. Em **Aplicativo Meta da plataforma**, informe:

- Meta App ID
- Meta App Secret
- versão da Graph API utilizada no seu aplicativo

O App Secret é enviado ao backend e guardado no Supabase Vault; não fica salvo no navegador.

## 2. Webhook
Na mesma tela, o Intorná Pixels mostra:

- Callback URL
- Verify Token

Copie esses valores para a configuração de Webhooks do aplicativo Meta e assine o campo **messages**.

O Verify Token é criado automaticamente e guardado no Vault. Se o App Secret estiver configurado, o backend também valida `X-Hub-Signature-256` nos POSTs recebidos.

## 3. Conectar o número do estúdio
Você precisará obter no WhatsApp Manager / painel do aplicativo Meta:

- WABA ID
- Phone Number ID
- Access Token com permissões necessárias para WhatsApp Business

Cole esses dados na tela e clique em **Conectar e validar**. O token é guardado criptografado no Supabase Vault.

Ao conectar, o Intorná Pixels também tenta assinar o aplicativo na WABA (`/{WABA_ID}/subscribed_apps`).

## 4. Teste
Envie uma mensagem de outro celular para o número conectado. A mensagem deve aparecer na Inbox. Ao abrir a conversa, o sistema marca a conversa como lida e tenta refletir o status no WhatsApp.

## 5. Futuro: Embedded Signup
A estrutura multiestúdio já separa cada conexão por `studio_id`. Para onboarding comercial sem colar tokens manualmente, habilite o Embedded Signup da Meta depois da App Review e dos acessos avançados exigidos para um Tech Provider/Solution Partner.

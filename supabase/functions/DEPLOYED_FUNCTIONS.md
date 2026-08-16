# Edge Functions do Intorná Pixels

Funções presentes no projeto:
- bootstrap-account
- admin-control
- create-asaas-subscription
- cancel-asaas-subscription
- asaas-webhook
- manage-client-portal
- client-portal
- client-checkout
- generate-image
- referral-program
- whatsapp-connect
- whatsapp-webhook
- whatsapp-send
- whatsapp-media
- integration-admin
- waha-test

As funções autenticadas devem manter `verify_jwt = true`. Webhooks/portais públicos usam autenticação própria quando `verify_jwt = false`.

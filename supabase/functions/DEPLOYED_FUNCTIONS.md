# Edge Functions incluídas no pacote

## Core / pagamentos / portal
- bootstrap-account — JWT obrigatório
- admin-control — JWT obrigatório
- create-asaas-subscription — JWT obrigatório
- cancel-asaas-subscription — JWT obrigatório
- asaas-webhook — webhook público com autenticação própria
- manage-client-portal — JWT obrigatório
- client-portal — endpoint público com token do portal
- client-checkout — endpoint público com token do portal
- generate-image — JWT obrigatório
- referral-program — JWT obrigatório

## WhatsApp v7
- whatsapp-connect — JWT obrigatório; configuração/validação da conexão Meta
- whatsapp-webhook — público para verificação e eventos da Meta; valida assinatura quando App Secret estiver configurado
- whatsapp-send — JWT obrigatório; texto, templates e mark-as-read
- whatsapp-media — JWT obrigatório; proxy de mídia da Cloud API

Antes de publicar, confirme no painel do Supabase se todas aparecem como ativas e se os segredos necessários estão configurados.

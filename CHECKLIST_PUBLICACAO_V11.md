# Checklist de publicação v11

- [ ] Executar todas as migrações em ordem, incluindo `002_admin_foundation.sql` e `012_data_api_grants.sql`.
- [ ] Implantar todas as Edge Functions; confirmar `admin-control`.
- [ ] Configurar URL, redirects e Publishable Key do Supabase.
- [ ] Validar cadastro, login e isolamento entre estúdios.
- [ ] Criar um lead, mover no funil e filtrar a Performance por origem/campanha.
- [ ] Criar, enviar, imprimir e converter um orçamento em pedido.
- [ ] Reabrir o app e confirmar que funil e orçamentos permaneceram sincronizados.
- [ ] Testar Asaas em sandbox antes da chave de produção.
- [ ] Testar WhatsApp Webhook, envio, recebimento e mídia.
- [ ] Testar geração de imagem e limites do plano.
- [ ] Atualizar cache/service worker e verificar o app no celular.

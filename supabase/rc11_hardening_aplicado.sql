-- JÁ APLICADO NO SUPABASE DE PRODUÇÃO em 19/08/2026.
-- Registro documental da RC11. Não reaplique cegamente.

-- 1. Redução de privilégios desnecessários do navegador
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- 2. client_payments recebeu purchase_key + índice único parcial para impedir cobrança duplicada pendente.
-- 3. reserve_ai_quota/release_ai_quota foram criadas para reserva atômica de cota de IA.
-- 4. Edge Functions atualizadas em produção:
--    whatsapp-webhook v4 (fail-closed sem App Secret/assinatura)
--    generate-image v3 (cota atômica + validação de tenant)
--    client-checkout v5 (idempotência de cobrança)

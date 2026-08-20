# Intorná Pixels — RC11 Auditoria Geral

## Escopo auditado
Frontend publicado na Vercel, autenticação, Supabase/Postgres/RLS, Storage, Edge Functions, IA, WhatsApp, Asaas, portal do cliente, checkout, PWA/service worker, sincronização multi-dispositivo e Marketing Performance.

## Achados críticos — corrigidos no backend de produção

1. **Webhook WhatsApp aceitava POST sem assinatura quando Meta App Secret não estava configurado — CRÍTICO.**
   - Correção: `whatsapp-webhook` v4 agora falha fechado. Sem App Secret retorna indisponível; assinatura inválida retorna 401.
   - Situação atual: seguro, porém entrada do WhatsApp fica bloqueada até o Master cadastrar o Meta App Secret.

2. **Cota de geração de imagem sujeita a corrida concorrente — ALTO.**
   - Correção: reserva atômica de cota com lock no banco; rollback da cota em erro; liberação do excedente se o provedor retornar menos imagens.

3. **Geração de imagem aceitava `orderId`/referência sem validação explícita do mesmo estúdio — ALTO.**
   - Correção: `generate-image` v3 valida pedido e prefixo das referências no tenant correto e limita prompt a 12.000 caracteres.

4. **Checkout podia gerar duas cobranças Asaas iguais por duplo clique/chamadas simultâneas — ALTO.**
   - Correção: `client-checkout` v5 + `purchase_key` e índice único parcial. Compra pendente igual é reutilizada ou bloqueada enquanto está sendo criada.

5. **Papéis de navegador tinham privilégios SQL desnecessários TRUNCATE/REFERENCES/TRIGGER — MÉDIO/ALTO.**
   - Correção: privilégios revogados nas tabelas atuais e nos defaults futuros.

## Achados críticos de frontend — pacote RC11 preparado

6. **`features-v7.js` existe no deployment e no cache PWA, mas nunca é carregado pelo bootstrap — ALTO.**
   - Impacto: Inbox WhatsApp Cloud API, templates, mídia, vínculo CRM/pedidos e configuração Meta ficam invisíveis.
   - RC11: instalador passa a carregar `features-v7.js` logo após `features-v6.js`.

7. **Sincronização cloud usa o navegador como espelho autoritativo completo — CRÍTICO para múltiplos aparelhos.**
   - Impacto: um aparelho desatualizado pode apagar registros criados em outro aparelho/integração e sobrescrever campos não editados localmente.
   - RC11: `cloud-rc11-patch.js` muda para delta sync: somente registros/campos realmente alterados são gravados; só registros que existiam no baseline local e foram explicitamente removidos são apagados.

8. **RC10 Marketing não reconhece o cliente Supabase real do app — ALTO.**
   - Causa: procurava `window.supabaseClient`, mas produção usa `window.IntornaCloud.client` e `window.INTORNA_CTX.studioId`.
   - RC11: corrigido em `features-v11.js`.

9. **Landing page descreve o produto como mais básico do que o backend real — COMERCIAL.**
   - Ainda precisa ser atualizada no repositório fonte para anunciar corretamente cloud, IA, portal, checkout e WhatsApp.

## Pontos verificados e considerados bons
- Todas as tabelas públicas estão com RLS ativo.
- Bucket `intorna-media` é privado, limite 15 MB, apenas JPEG/PNG/WebP e políticas por estúdio.
- Funções sensíveis SECURITY DEFINER não estão executáveis por `anon`/`authenticated`.
- Portal do cliente usa token aleatório e só armazena SHA-256; suporta expiração/desativação.
- Links de mídia do portal são assinados e temporários.
- Asaas webhook valida `asaas-access-token` e usa tabela de eventos para idempotência.
- Vercel não apresentou runtime errors no período auditado.

## Pendências deliberadas
- **Meta App Secret:** precisa ser cadastrado pelo Master; até lá o webhook WhatsApp fica bloqueado por segurança.
- **Proteção contra senhas vazadas:** Security Advisor do Supabase ainda mostra este aviso de configuração do Auth.
- **Frontend na Vercel:** o pacote está pronto, mas o conector GitHub desta sessão não possui acesso ao repositório privado `wsoaresfs/intornapixels`; não foi feito deploy destrutivo sem o fonte.
- **Landing page:** deve ser reescrita junto com a aplicação da RC11 no repositório.

## Resultado
A fundação de dados está bem protegida. Os maiores riscos encontrados eram de integração, concorrência e sincronização — e os três problemas de backend mais perigosos já foram corrigidos em produção. A próxima aplicação do pacote RC11 no repositório fecha o principal risco de perda de dados multi-dispositivo e reativa funcionalidades já existentes no deployment.

# WAHA Teste — configuração rápida

## Objetivo
Ativar uma caixa de teste do WAHA somente para o administrador da plataforma, dentro da aba WhatsApp do Intorná Pixels.

## 1) Suba uma instância WAHA
Você precisa ter uma instância WAHA rodando em um servidor seu.
Exemplo comum: Docker em VPS / Railway / Render / outro host.

Você precisará de:
- URL base do WAHA
- API Key (`X-Api-Key`)
- Nome da sessão (ex.: `default`)

## 2) Publicar a nova versão do Intorná Pixels
Publique o ZIP `INTORNA_PIXELS_v7_2_WAHA_TEST_NETLIFY.zip` no Netlify.

## 3) Publicar a Edge Function nova no Supabase
Função nova:
- `waha-test`

Pasta:
- `supabase/functions/waha-test/index.ts`

## 4) Como usar no app
1. Entre com sua conta administrativa.
2. Abra a aba **WhatsApp**.
3. Role até o bloco **WAHA Teste Experimental**.
4. Preencha:
   - URL do WAHA
   - API Key
   - Sessão
5. Clique em **Salvar no aparelho**.
6. Clique em **Iniciar sessão**.
7. Clique em **Atualizar QR**.
8. Escaneie o QR com o WhatsApp no celular.
9. Quando conectar, clique em **Atualizar** na área de conversas.
10. Selecione uma conversa e envie uma mensagem.

## 5) Observações
- É um modo de teste, pensado somente para o administrador.
- Não foi exposto aos assinantes do SaaS.
- Se quiser, depois podemos transformar isso em uma integração mais estruturada.

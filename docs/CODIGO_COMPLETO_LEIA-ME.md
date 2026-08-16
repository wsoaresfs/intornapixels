# Intorná Pixels — código-fonte completo (snapshot v7.6)

Este pacote reúne o frontend, o painel administrativo, o portal do cliente, as Edge Functions do Supabase, migrations SQL e documentação técnica do projeto.

## Segurança
- Nenhuma chave privada de OpenAI, Google, Asaas ou WAHA está incluída.
- Credenciais de produção devem ser cadastradas pelo painel Master e armazenadas no Supabase Vault.
- A chave publishable do Supabase pode aparecer no frontend porque é uma credencial pública de navegador; a segurança dos dados depende das políticas RLS.

## Estrutura
- `/app` — painel operacional do estúdio.
- `/admin` — Central Administrativa / Master.
- `/portal` — cadastro e login dos estúdios.
- `/cliente` — portal público do cliente.
- `/shared` — cliente Supabase e utilitários comuns.
- `/supabase/functions` — Edge Functions.
- `/supabase/migrations` — schema e alterações do banco.
- `/assets` — identidade visual e imagens.

## Estado do snapshot
Este snapshot corresponde à base v7.6 e inclui as alterações de Storage/RLS feitas após a publicação para permitir que o Master opere arquivos de qualquer estúdio sem liberar acesso global para usuários comuns.

### Pendência conhecida no momento do snapshot
O fluxo `generate-image` estava retornando um status não-2xx ao chamar o provedor de imagem. O código implantado naquele momento está preservado neste pacote para auditoria/reprodução; a investigação/correção do endpoint de geração ainda estava em andamento quando este snapshot foi solicitado.

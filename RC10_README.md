# Intorná Pixels RC10 — Operação & Crescimento

## O que esta RC acrescenta

- Módulo **Marketing Performance** encaixável no painel existente.
- KPIs: investimento, leads, vendas, receita atribuída, CTR, CPC, CPL, CPA, conversão e ROAS.
- Filtros de 7, 30 e 90 dias.
- Leitura por canal: Meta Ads, Google Ads e TikTok Ads.
- Diagnóstico automático simples para gargalos de criativo, tráfego e fechamento.
- Meta mensal de faturamento e barra de progresso.
- Registro manual diário com persistência no Supabase quando autenticado.
- Fallback local para teste quando o Supabase/app não estiver disponível.
- Exportação CSV.
- Botão de sincronização automática via Edge Function `marketing-sync`.

## Backend já executado

No projeto Supabase `Intorna`, já foram adicionadas as tabelas:

- `marketing_connections`
- `marketing_snapshots`
- `marketing_goals`

As três usam RLS e políticas por `studio_id` reaproveitando os helpers privados já existentes do Intorná.

Também foi implantada a Edge Function `marketing-sync` com JWT obrigatório. Nesta RC, a sincronização automática é restrita ao **Master**, evitando que credenciais de mídia sejam expostas ou usadas por contas de estúdio sem controle.

## Como acoplar ao frontend mais recente

1. Copie `features-v10.css` para o frontend publicado.
2. Carregue o CSS depois do estilo principal.
3. Copie `features-v10.js` e carregue-o **depois** dos scripts atuais (v8/v9).
4. O addon procura `.nav`/`.side-nav`, `.container` e o estúdio atual.
5. Para nuvem, exponha o cliente Supabase já autenticado em uma das variáveis suportadas: `window.INTORNA_SUPABASE`, `window.supabaseClient` ou `window.sb`.
6. Informe o estúdio em `window.INTORNA_STUDIO_ID` ou mantenha o objeto atual em `window.currentStudio.id`.

## Sincronização automática

O botão `Sincronizar anúncios` chama `marketing-sync` com `sync_all`. Sem secrets, a função retorna quais provedores ainda precisam ser configurados; os dados manuais continuam funcionando normalmente.

A configuração das credenciais está descrita em `ENV_MARKETING.txt`.

## Teste isolado

Abra `rc10-marketing-demo.html` em um servidor local para validar o visual e os cálculos sem tocar no frontend publicado.

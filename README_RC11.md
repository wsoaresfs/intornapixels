# INTORNÁ PIXELS — RC11 AUDITORIA GERAL

Esta RC é um pacote de **hardening + recuperação de funcionalidades + sincronização segura**.

## O que já está LIVE no backend
- WhatsApp webhook v4: assinatura obrigatória / fail-closed.
- Generate Image v3: cota atômica, tenant validation, rollback de cota.
- Client Checkout v5: bloqueio de cobrança duplicada.
- Privilégios SQL de navegador reduzidos.
- Marketing backend RC10 mantido.

## O que este ZIP aplica ao repositório frontend
1. Copia `shared/cloud-rc11-patch.js`.
2. Copia `app/features-v11.js` e CSS.
3. Carrega `features-v7.js` (WhatsApp Cloud API que já existia mas estava órfã).
4. Carrega Marketing RC11 ligado ao `IntornaCloud.client` real.
5. Invalida o cache PWA para distribuir a atualização.
6. Troca a sincronização destrutiva por delta sync.

## Aplicação local
Na raiz do repositório Intorná Pixels:

```bash
python APLICAR_RC11.py .
```

Depois revise o diff, teste e só então publique.

## Importante
Não substitua a produção apenas com arquivos avulsos sem revisar o `git diff`. O pacote foi feito para ser aplicado sobre o fonte que gerou o deployment atual.

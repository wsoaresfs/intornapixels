# Arquitetura de produção — Intorná Pixels na Vercel

```text
Usuário
  ↓ HTTPS
Vercel Edge CDN
  ↓
public/ (HTML, CSS, JS, PWA)
  ↓ JWT / HTTPS
Supabase
  ├─ Auth
  ├─ PostgreSQL + RLS
  ├─ Storage privado + RLS
  ├─ Vault
  └─ Edge Functions
       ├─ bootstrap-account
       ├─ admin-control
       ├─ integration-admin
       ├─ generate-image
       ├─ create/cancel Asaas subscription
       ├─ client-checkout
       ├─ asaas-webhook
       ├─ client portal
       └─ WAHA / WhatsApp
            ↓
       Google / OpenAI / Asaas / WAHA
```

## Fronteira de segurança

A Vercel recebe somente artefatos públicos. Toda operação privilegiada continua no Supabase.

Isso significa que a migração de hospedagem não exige duplicar secrets nem criar Vercel Functions para o backend atual.

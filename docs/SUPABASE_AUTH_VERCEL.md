# Supabase Auth — URLs para Vercel

Faça esta etapa somente depois de conhecer o domínio final fornecido pela Vercel.

No Supabase:

**Authentication → URL Configuration**

## Site URL

Use:

`https://SEU-DOMINIO.vercel.app/`

ou, quando estiver configurado:

`https://SEU-DOMINIO-PROPRIO/`

## Redirect URLs

Autorize pelo menos:

`https://SEU-DOMINIO.vercel.app/portal/`

`https://SEU-DOMINIO.vercel.app/portal/?mode=recovery`

Se usar domínio próprio, cadastre também as mesmas duas rotas nesse domínio.

## Durante a migração

Enquanto o Netlify ainda estiver atendendo usuários, mantenha temporariamente os redirects antigos e os novos. Depois de validar a Vercel, remova os redirects antigos para reduzir superfícies desnecessárias.

## Teste obrigatório

1. criar nova conta;
2. receber confirmação;
3. confirmar e retornar ao domínio Vercel;
4. entrar;
5. sair;
6. pedir recuperação de senha;
7. abrir o e-mail;
8. definir nova senha;
9. entrar novamente.

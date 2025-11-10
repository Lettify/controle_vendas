# ⚠️ IMPORTANTE: Configurar Variáveis de Ambiente no Vercel

## O erro 500 geralmente ocorre por falta de variáveis de ambiente!

### Passo a Passo:

1. **Acesse o Vercel Dashboard**
   - Vá em: https://vercel.com/dashboard
   - Clique no seu projeto

2. **Settings → Environment Variables**
   - No menu lateral, clique em "Settings"
   - Procure a seção "Environment Variables"

3. **Adicione as variáveis:**

   **DATABASE_URL**
   ```
   Nome: DATABASE_URL
   Valor: postgresql://postgres:[SUA-SENHA]@[SEU-PROJECT-REF].supabase.co:5432/postgres
   Environment: Production, Preview, Development (marcar todos)
   ```

   **JWT_SECRET**
   ```
   Nome: JWT_SECRET
   Valor: (copie o valor do seu arquivo .env local)
   Environment: Production, Preview, Development (marcar todos)
   ```

4. **Redeploy**
   - Após adicionar as variáveis, vá em "Deployments"
   - Clique nos 3 pontinhos (...) do último deploy
   - Clique em "Redeploy"

## Verificar se está funcionando:

Após o redeploy, acesse:
```
https://seu-site.vercel.app/api/trpc/auth.me
```

Se retornar JSON (mesmo que vazio), a API está funcionando! ✅

## Se ainda der erro:

Verifique os logs no Vercel:
- Vá em "Deployments"
- Clique no deployment mais recente
- Clique em "Functions"
- Veja os logs da function `api/trpc/[trpc]`

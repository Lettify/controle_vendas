# Deploy no Vercel

Este projeto está configurado para deploy completo (frontend + backend) no Vercel.

## Configuração

### 1. Variáveis de Ambiente no Vercel

Adicione as seguintes variáveis no dashboard do Vercel (Settings → Environment Variables):

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=your-secret-key-here
```

### 2. Build Settings

O Vercel detectará automaticamente as configurações do `vercel.json`:

- **Build Command**: `npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `npm install`

### 3. Deploy

```bash
# Commit e push para o repositório
git add .
git commit -m "Configurar deploy no Vercel"
git push

# Ou use o CLI do Vercel
vercel --prod
```

## Estrutura da API

O backend roda como Serverless Functions do Vercel:

- **Endpoint de Produção**: `https://seu-site.vercel.app/api/trpc`
- **Endpoint Local**: `http://localhost:3000/trpc`

## Configurações Otimizadas

### Banco de Dados
- Connection pooling configurado para serverless (max: 1)
- `prepare: false` para compatibilidade com Vercel
- Timeouts otimizados para cold starts

### Performance
- Code splitting automático (React e tRPC vendors separados)
- Cache de assets estáticos (1 ano)
- Região: São Paulo (gru1) - ajuste se necessário

## Troubleshooting

### Cold Starts
A primeira requisição após inatividade pode demorar 2-5 segundos. Isso é normal em serverless functions.

### Cookies não funcionam
Certifique-se de que seu domínio está usando HTTPS. O Vercel fornece HTTPS automaticamente.

### Database connection error
Verifique se a variável `DATABASE_URL` está configurada corretamente no Vercel e se o Supabase permite conexões da região do Vercel.

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em modo dev (frontend + backend)
npm run dev

# Build local para testar
npm run build
```

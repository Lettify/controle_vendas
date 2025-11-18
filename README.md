# Controle de Rendimento de Vendas

Aplicação web para controle diário de vendas e rendimento de funcionários com autenticação por código único.

## Características

- ✅ Autenticação por código único (sem dependência de OAuth)
- ✅ Gerenciamento de funcionários (criar, editar, ativar/desativar)
- ✅ Registro de vendas diárias
- ✅ Estatísticas e relatórios de vendas
- ✅ Interface de administração para gerenciar códigos de acesso
- ✅ Banco de dados MySQL com Drizzle ORM
- ✅ API tRPC com tipos end-to-end
- ✅ Frontend React com Tailwind CSS

## Tecnologias

- **Frontend**: React 19, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express, tRPC, TypeScript
- **Banco de Dados**: MySQL com Drizzle ORM
- **Autenticação**: JWT com códigos de acesso únicos

## Instalação Local

### Pré-requisitos

- Node.js 18+
- MySQL 8.0+
- npm ou yarn

### Passos de Instalação

1. Clone ou extraia o projeto:
```bash
cd controle-vendas
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```
DATABASE_URL=mysql://user:password@localhost:3306/controle_vendas
JWT_SECRET=sua-chave-secreta-aqui
PORT=3000
VITE_API_URL=http://localhost:3000
```

4. Crie o banco de dados:
```bash
mysql -u root -p -e "CREATE DATABASE controle_vendas;"
```

5. Execute as migrações do banco de dados:
```bash
npm run db:push
```

6. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Uso

### Primeiro Acesso

1. Acesse http://localhost:5173
2. Você será redirecionado para a página de login
3. Como não há códigos gerados ainda, você precisa acessar o banco de dados diretamente

### Gerar Códigos de Acesso (Admin)

Para gerar códigos de acesso, você pode:

1. **Via Interface Web** (após fazer login como admin):
   - Acesse "Administração" > "Gerenciar Códigos"
   - Clique em "Gerar Novo Código"

2. **Via SQL Direto** (para primeiro acesso):
```sql
-- Criar um usuário admin
INSERT INTO users (id, name, email, role, createdAt, lastSignedIn) 
VALUES ('admin-id', 'Admin', 'admin@example.com', 'admin', NOW(), NOW());

-- Gerar um código de acesso
INSERT INTO access_codes (id, code, companyId, createdBy, isActive) 
VALUES ('code-id', 'ADMIN123', 'default-company', 'admin-id', true);
```

3. Faça login com o código `ADMIN123`

### Fluxo de Uso

1. **Gerenciar Funcionários**: Adicione seus vendedores/operadores
2. **Registrar Vendas**: Registre as vendas diárias por funcionário
3. **Visualizar Estatísticas**: Acompanhe o desempenho mensal
4. **Gerar Códigos**: Como admin, gere códigos para novos usuários

## Estrutura do Projeto

```
controle-vendas/
├── client/                 # Frontend React
│   └── src/
│       ├── pages/         # Páginas da aplicação
│       ├── components/    # Componentes reutilizáveis
│       ├── hooks/         # Custom hooks
│       └── lib/           # Utilitários
├── server/                # Backend Express + tRPC
│   ├── routers.ts        # Definição das APIs tRPC
│   ├── db.ts             # Funções de banco de dados
│   └── _core/            # Configuração tRPC
├── drizzle/              # Schema e migrações do banco
├── shared/               # Código compartilhado
└── vite.config.ts        # Configuração do Vite
```

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor e cliente
npm run dev:server      # Apenas servidor
npm run dev:client      # Apenas cliente

# Build
npm run build           # Compila para produção

# Banco de Dados
npm run db:push         # Aplica migrações
npm run db:generate     # Gera tipos do schema
npm run db:migrate      # Executa migrações

# Validação
npm run lint            # Verifica tipos TypeScript
```

## Deployment

Para fazer deploy em produção:

1. Configure as variáveis de ambiente em seu servidor
2. Execute `npm run build`
3. Inicie com `npm start` (você pode precisar criar um script de start)
4. Configure um reverse proxy (nginx/Apache) apontando para http://localhost:3000

## Deploy na Vercel

Este projeto suporta deploy automático na Vercel via integração com GitHub.

### Passos para Deploy Automático

1. **Conecte o repositório ao Vercel**
   - No painel da Vercel, crie um novo projeto e selecione o repositório `Lettify/controle_vendas`.
   - Escolha a branch principal (`main`).

2. **Configure as variáveis de ambiente**
   - No painel do projeto na Vercel, vá em Settings > Environment Variables.
   - Adicione as seguintes variáveis para o ambiente `Production`:
     - `JWT_SECRET` (obrigatório, valor forte e aleatório)
     - `DATABASE_URL` (string de conexão do banco de dados)
     - `NODE_ENV=production`

3. **Deploy automático**
   - A cada commit/push na branch `main`, a Vercel irá disparar um novo deploy automaticamente.
   - Você pode acompanhar o progresso e logs pelo painel da Vercel.

### Verificando status do deploy via terminal

1. Instale as dependências (inclui a CLI da Vercel):
   ```bash
   npm install
   ```
2. Faça login na Vercel CLI (se necessário):
   ```bash
   npx vercel login
   ```
3. Veja os últimos deploys:
   ```bash
   npm run vercel-status
   ```
   Isso mostrará os deploys das últimas 24h. Para mais detalhes, acesse o painel da Vercel.

### Dicas
- Se o deploy falhar por falta de `JWT_SECRET`, o log mostrará erro de configuração.
- Para redeploy manual, clique em "Redeploy" no painel da Vercel ou faça um novo commit/push.
- Sempre mantenha suas variáveis de ambiente atualizadas e nunca exponha segredos no código.

## Autenticação por Código

O sistema usa códigos únicos para autenticação:

- Cada código é uma string aleatória (ex: `ABC12345`)
- Códigos podem expirar ou ser desativados
- Cada código só pode ser usado uma vez
- Após usar um código, o usuário recebe um JWT válido por 7 dias

## Segurança

- Senhas não são usadas (autenticação por código)
- JWTs são armazenados em cookies HTTP-only
- Todos os dados sensíveis são validados no backend
- Use HTTPS em produção

## Troubleshooting

### Erro de conexão com banco de dados
- Verifique se MySQL está rodando
- Confirme as credenciais em `.env`
- Verifique se o banco de dados foi criado

### Página em branco no frontend
- Verifique o console do navegador (F12)
- Verifique se o backend está rodando em http://localhost:3000
- Limpe o cache do navegador

### Código não funciona
- Verifique se o código está ativo no banco de dados
- Verifique se o código não expirou
- Verifique se o código já foi usado

## Suporte

Para dúvidas ou problemas, consulte:
- Documentação do tRPC: https://trpc.io
- Documentação do Drizzle: https://orm.drizzle.team
- Documentação do React: https://react.dev

## Licença

ISC

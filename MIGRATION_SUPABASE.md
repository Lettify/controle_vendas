# Migração para Supabase (PostgreSQL)

## Passos para migrar do MySQL para Supabase

### 1. Obter a String de Conexão do Supabase

1. Acesse seu projeto no [Supabase](https://supabase.com)
2. Vá em **Project Settings** > **Database**
3. Na seção **Connection string**, copie a **URI** (formato: `postgresql://postgres:[password]@[host]:5432/postgres`)
4. Substitua `[password]` pela senha do seu banco de dados

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
DATABASE_URL="postgresql://postgres:[SUA-SENHA]@[SEU-PROJETO].supabase.co:5432/postgres"
JWT_SECRET="sua-chave-secreta-aqui"
```

### 3. Instalar Dependências

```bash
npm install
```

Isso irá:
- Remover `mysql2`
- Instalar `postgres` (driver PostgreSQL)

### 4. Gerar e Aplicar Migrations

```bash
# Gerar as migrations baseadas no schema
npm run db:generate

# Aplicar as migrations no Supabase
npm run db:push
```

### 5. Verificar no Supabase

1. Vá para o **Table Editor** no Supabase
2. Você deve ver as tabelas criadas:
   - `users`
   - `access_codes`
   - `employees`
   - `daily_sales`

### 6. Executar a Aplicação

```bash
npm run dev
```

## Principais Mudanças Realizadas

### 1. **drizzle.config.ts**
- Mudou de `dialect: "mysql"` para `dialect: "postgresql"`
- Removeu valor padrão para DATABASE_URL (obrigatório no Supabase)

### 2. **drizzle/schema.ts**
- Substituiu imports de `drizzle-orm/mysql-core` para `drizzle-orm/pg-core`
- Mudou `mysqlTable` para `pgTable`
- Mudou `mysqlEnum` para `pgEnum`
- Nomes de colunas agora usam `snake_case` (padrão PostgreSQL)
- Adicionou `withTimezone: true` nos timestamps
- Removeu `onUpdateNow()` (não suportado nativamente no PostgreSQL)

### 3. **server/db.ts**
- Mudou de `drizzle-orm/mysql2` para `drizzle-orm/postgres-js`
- Adicionou import do driver `postgres`
- Substituiu `onDuplicateKeyUpdate` por `onConflictDoUpdate` (sintaxe PostgreSQL)
- Configurou connection pooling com `max: 10`

### 4. **package.json**
- Removeu `mysql2`
- Adicionou `postgres`

## Diferenças Importantes

### MySQL vs PostgreSQL

| Recurso | MySQL | PostgreSQL |
|---------|-------|------------|
| Enum | `mysqlEnum()` | `pgEnum()` |
| Auto Update | `onUpdateNow()` | Não suportado (usar trigger) |
| Upsert | `onDuplicateKeyUpdate` | `onConflictDoUpdate` |
| Nomes de Colunas | camelCase | snake_case (recomendado) |
| Timestamp | `timestamp()` | `timestamp({ withTimezone: true })` |

## Migração de Dados (Opcional)

Se você tem dados no MySQL local e quer migrá-los:

1. **Exportar dados do MySQL:**
```bash
mysqldump -u root -p controle_vendas > backup.sql
```

2. **Converter para PostgreSQL:**
- Use ferramentas como [pgloader](https://pgloader.io/)
- Ou ajuste manualmente o SQL para sintaxe PostgreSQL

3. **Importar no Supabase:**
- Use o SQL Editor do Supabase
- Ou use `psql` com a connection string

## Troubleshooting

### Erro: "relation does not exist"
- Execute `npm run db:push` para criar as tabelas

### Erro: "password authentication failed"
- Verifique se a senha na DATABASE_URL está correta
- Resete a senha no painel do Supabase se necessário

### Erro: "max connection pool exceeded"
- Verifique se você está usando connection pooling
- Considere usar Supabase Connection Pooler para produção

## Recursos Adicionais

- [Documentação Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

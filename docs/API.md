# API — EuChef

Contrato HTTP atual do backend e fluxo de autenticação da SPA.

## Visão geral

| Item                         | Valor                   |
| ---------------------------- | ----------------------- |
| URL-base local direta        | `http://localhost:8081` |
| URL-base pelo frontend/Nginx | `http://localhost:5173` |
| Formato                      | JSON UTF-8              |
| API de negócio               | `/api/v1`               |
| Autenticação                 | sessão HTTP server-side |
| Perfis                       | `USER`, `ADMIN`         |
| Persistência                 | PostgreSQL 17 + Flyway  |

A SPA usa a mesma origem do Nginx. O navegador recebe apenas um cookie de sessão `HttpOnly`; senhas e tokens de autenticação não são armazenados no browser. Operações mutáveis exigem CSRF.

## Autenticação

### Fluxo

1. obtenha o token CSRF com `GET /api/v1/auth/csrf` e preserve o cookie;
2. envie o token no header informado pela resposta, normalmente `X-CSRF-TOKEN`;
3. registre uma conta ou faça login;
4. preserve o cookie de sessão nas requisições seguintes;
5. finalize com `POST /api/v1/auth/logout`, também com CSRF.

### Exemplo com curl e jq

```bash
BASE_URL='http://localhost:5173'
COOKIE_JAR='euchef-cookies.txt'

CSRF_TOKEN=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  "$BASE_URL/api/v1/auth/csrf" | jq -r '.token')

curl -i -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -d '{"displayName":"Ana Souza","email":"ana@example.com","password":"uma-senha-local-123"}' \
  "$BASE_URL/api/v1/auth/register"

curl -i -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -d '{"email":"ana@example.com","password":"uma-senha-local-123"}' \
  "$BASE_URL/api/v1/auth/login"

curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/v1/auth/me"
```

O cadastro público sempre cria `USER`; o cliente não escolhe o papel. Contas `ADMIN` devem ser promovidas por uma operação administrativa controlada fora da API pública.

### Endpoints de autenticação

| Método | Caminho                 | Acesso      | CSRF | Sucesso |
| ------ | ----------------------- | ----------- | ---- | ------- |
| `GET`  | `/api/v1/auth/csrf`     | público     | não  | `200`   |
| `POST` | `/api/v1/auth/register` | público     | sim  | `201`   |
| `POST` | `/api/v1/auth/login`    | público     | sim  | `200`   |
| `GET`  | `/api/v1/auth/me`       | autenticado | não  | `200`   |
| `POST` | `/api/v1/auth/logout`   | autenticado | sim  | `204`   |

Registro:

```json
{
  "displayName": "Ana Souza",
  "email": "ana@example.com",
  "password": "uma-senha-local-123"
}
```

Resposta autenticada, sem hash de senha:

```json
{
  "id": 1,
  "displayName": "Ana Souza",
  "email": "ana@example.com",
  "role": "USER"
}
```

O e-mail é normalizado para minúsculas. A senha deve ter entre 12 e 128 caracteres no registro e é persistida somente como hash BCrypt adaptativo.

> **Risco residual temporariamente aceito:** um e-mail já registrado retorna `409 EMAIL_ALREADY_REGISTERED`, permitindo confirmar a existência de uma conta. O contrato é permitido apenas em desenvolvimento e homologação privada. Antes de exposição pública, o cadastro deve migrar para verificação de e-mail fora de banda e retornar uma resposta indistinguível para endereços novos e existentes. Rate limiting reduz exploração em massa, mas não corrige a enumeração.

## Ingredientes

Todos os endpoints exigem `USER` ou `ADMIN`; `POST`, `PUT` e `DELETE` exigem CSRF.

| Método   | Caminho                    | Resultado                 |
| -------- | -------------------------- | ------------------------- |
| `GET`    | `/api/v1/ingredients`      | `200`, página             |
| `POST`   | `/api/v1/ingredients`      | `201`, ingrediente criado |
| `GET`    | `/api/v1/ingredients/{id}` | `200`                     |
| `PUT`    | `/api/v1/ingredients/{id}` | `200`                     |
| `DELETE` | `/api/v1/ingredients/{id}` | `204`                     |

Exemplo mínimo de criação:

```json
{
  "name": "Arroz integral",
  "description": "Grão integral",
  "defaultUnit": "GRAM"
}
```

Nutrição por 100 g e sazonalidade são opcionais e aparecem no schema OpenAPI local.

A listagem aceita `page` (base zero, padrão `0`), `size` (padrão `20`, máximo `100`) e `q` (trecho literal do nome, até 100 caracteres). A pesquisa não diferencia maiúsculas e minúsculas; `%`, `_` e `!` são tratados literalmente. Exemplo: `GET /api/v1/ingredients?q=frango&page=0&size=20` encontra `Peito de frango`. Um índice trigram PostgreSQL sustenta a busca por trecho.

## Receitas

Todos os endpoints exigem `USER` ou `ADMIN`; `POST`, `PUT` e `DELETE` exigem CSRF.

| Método   | Caminho                | Resultado                |
| -------- | ---------------------- | ------------------------ |
| `GET`    | `/api/v1/recipes`      | `200`, página de resumos |
| `POST`   | `/api/v1/recipes`      | `201`, receita criada    |
| `GET`    | `/api/v1/recipes/{id}` | `200`                    |
| `PUT`    | `/api/v1/recipes/{id}` | `200`                    |
| `DELETE` | `/api/v1/recipes/{id}` | `204`                    |

Ingredientes e receitas formam um catálogo compartilhado entre usuários autenticados. Cada receita expõe `author.id` e `author.displayName`, sem divulgar o e-mail do autor. A criação atribui a receita ao usuário autenticado. Somente o autor ou um usuário `ADMIN` pode atualizar ou excluir a receita; os demais recebem `403 ACCESS_DENIED`. Receitas anteriores à introdução da autoria permanecem preservadas e são atribuídas à conta técnica desabilitada `Catálogo EuChef`.

A listagem aceita `page` (base zero, padrão `0`), `size` (padrão `20`, máximo `100`) e `q` (trecho literal do nome, até 100 caracteres), com ordenação estável por nome e ID. A busca não diferencia maiúsculas e minúsculas; `%`, `_` e `!` são tratados literalmente. Cada item é um resumo sem `ingredients` e `preparationSteps`; obtenha o agregado completo em `GET /api/v1/recipes/{id}`.

O contrato completo inclui `author` somente para leitura e aceita `youtubeVideoUrl` opcional, limitado a 500 caracteres e exclusivamente a URLs HTTPS de `youtube.com/watch?v=...` ou `youtu.be/...` com um ID de vídeo de 11 caracteres. A interface converte esse valor para um embed com privacidade aprimorada em `youtube-nocookie.com`, exibido depois dos ingredientes e do modo de preparo. `preparationTimeMinutes` informa o tempo estimado em minutos, entre `0` e `10080`.

Listagens paginadas usam o envelope estável:

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0,
  "hasNext": false,
  "hasPrevious": false
}
```

Ao criar ou atualizar uma receita, todos os IDs de ingredientes são validados em lote. IDs ausentes retornam `404 INGREDIENTS_NOT_FOUND`; a mensagem continua legível para humanos e `details.missingIngredientIds` contém a lista numérica para clientes. Repetir o mesmo `ingredientId` na receita retorna `400 VALIDATION_ERROR`, com a chave `ingredientIdsUnique` em `fieldErrors`.

## Planejamento semanal

Todos os endpoints exigem `USER` ou `ADMIN`; `POST`, `PUT` e `DELETE` exigem CSRF. O planejamento e sua lista de compras são privados por usuário autenticado, mesmo que o catálogo de receitas ainda seja compartilhado.

| Método   | Caminho                                                     | Resultado                         |
| -------- | ----------------------------------------------------------- | --------------------------------- |
| `GET`    | `/api/v1/weekly-plans/{weekStart}`                          | `200`, planejamento da semana     |
| `GET`    | `/api/v1/weekly-plans/{weekStart}/shopping-list`            | `200`, ingredientes consolidados  |
| `POST`   | `/api/v1/weekly-plans/{weekStart}/recipes`                  | `201`, planejamento atualizado    |
| `PUT`    | `/api/v1/weekly-plans/{weekStart}/recipes/{recipeId}`       | `200`, quantidade atualizada      |
| `DELETE` | `/api/v1/weekly-plans/{weekStart}/recipes/{recipeId}`       | `204`                             |

`weekStart` usa o formato ISO `AAAA-MM-DD` e deve representar uma segunda-feira. Valores malformados e datas de outros dias retornam `400 INVALID_WEEK_START`. Uma semana aceita no máximo 100 receitas e não permite repetir a mesma receita; duplicidades retornam `409 DUPLICATE_RESOURCE`. Receita inexistente e tentativa de alterar ou remover um vínculo ausente ou pertencente a outro usuário retornam `404 RESOURCE_NOT_FOUND`.

`quantity` representa quantas vezes a receita será preparada naquela semana. É um inteiro de `1` a `100`; quando omitido na inclusão, assume `1`. Zero, negativos, frações e valores acima do limite retornam `400 VALIDATION_ERROR`.

Corpo para adicionar uma receita:

```json
{
  "recipeId": 42,
  "quantity": 2
}
```

Corpo para alterar somente a quantidade planejada:

```json
{
  "quantity": 3
}
```

Resposta do planejamento:

```json
{
  "weekStart": "2026-08-03",
  "recipes": [
    {
      "id": 42,
      "name": "Sopa de legumes",
      "description": "Leve e rápida.",
      "servings": 4,
      "preparationTimeMinutes": 30,
      "author": {
        "id": 7,
        "displayName": "Ana Souza"
      },
      "createdAt": "2026-08-01T12:00:00Z",
      "updatedAt": "2026-08-01T12:00:00Z",
      "plannedQuantity": 3
    }
  ]
}
```

A lista de compras soma ingredientes com o mesmo ID e a mesma unidade depois de multiplicar cada quantidade por `plannedQuantity`. Medidas contínuas, como `GRAM`, `KILOGRAM`, `MILLILITER` e `LITER`, preservam frações. Somente `UNIT`, que representa itens discretos, é arredondada para cima após a soma consolidada.

```json
{
  "weekStart": "2026-08-03",
  "items": [
    {
      "ingredientId": 7,
      "ingredientName": "Ovo",
      "quantity": 2,
      "unit": "UNIT"
    }
  ]
}
```

## Administração e documentação interativa

| Caminho            | Perfil local | Perfil `prod`            | Autorização |
| ------------------ | ------------ | ------------------------ | ----------- |
| `/actuator/health` | habilitado   | habilitado, sem detalhes | público     |
| `/actuator/info`   | habilitado   | não exposto              | `ADMIN`     |
| `/v3/api-docs`     | habilitado   | desabilitado             | `ADMIN`     |
| `/swagger-ui.html` | habilitado   | desabilitado             | `ADMIN`     |

O Nginx público encaminha somente `/actuator/health`; outras superfícies administrativas não são publicadas pelo frontend. No perfil local, um administrador pode acessá-las diretamente pela porta `8081`.

## Erros

Erros gerados pela API e pelos filtros usam:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "A requisição contém campos inválidos",
  "timestamp": "2026-07-22T12:00:00Z",
  "fieldErrors": {
    "email": "deve ser um endereço de e-mail válido"
  },
  "details": {}
}
```

As chaves de `fieldErrors` usam os nomes públicos dos campos e parâmetros, como `email`, `page`, `size` e `q`, sem nomes internos de métodos. Informações estruturadas específicas do erro usam `details`; em `INGREDIENTS_NOT_FOUND`, por exemplo:

```json
{
  "details": {
    "missingIngredientIds": [999998, 999999]
  }
}
```

Códigos HTTP relevantes:

|  HTTP | Situação típica                         |
| ----: | --------------------------------------- |
| `400` | JSON ou campos inválidos                |
| `401` | sessão ausente ou credenciais inválidas |
| `403` | perfil insuficiente ou CSRF inválido    |
| `404` | recurso inexistente                     |
| `409` | e-mail ou nome duplicado                |
| `413` | corpo maior que o limite configurado    |
| `429` | limite de requisições excedido          |

Falhas de login usam mensagem genérica e não revelam se o e-mail existe.

## Controles HTTP

- negação por padrão no Spring Security;
- cookie local `EUCHEFSESSION`, `HttpOnly`, `SameSite=Lax`;
- cookie de produção `__Host-euchef-session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` e sem `Domain`;
- rotação do identificador da sessão no login;
- invalidação e remoção do cookie no logout;
- CORS por allowlist, sem `*` com credenciais;
- limite padrão de corpo de 1 MiB;
- rate limiting por endereço remoto para autenticação e API;
- CSP, proteção contra framing, `nosniff`, Referrer Policy e Permissions Policy;
- HSTS em respostas HTTPS.

O rate limiter do backend é local à instância e possui limite de chaves em memória. Em implantação com múltiplas réplicas, use também gateway compartilhado ou armazenamento distribuído. Atrás de proxy, aceite endereços encaminhados apenas de proxies confiáveis.

## Configuração

O perfil `local` possui defaults exclusivos para desenvolvimento. O perfil `prod` exige variáveis sem fallback:

| Variável                 | Local                   | Produção           |
| ------------------------ | ----------------------- | ------------------ |
| `DATABASE_URL`           | default local           | obrigatória        |
| `DATABASE_USERNAME`      | default local           | obrigatória        |
| `DATABASE_PASSWORD`      | default local           | obrigatória/secret |
| `EUCHEF_ALLOWED_ORIGINS` | `http://localhost:5173` | obrigatória        |
| `BACKEND_PORT`           | `8081`                  | opcional           |

Propriedades adicionais podem ser definidas pelas equivalentes Spring de:

```yaml
euchef:
  security:
    max-request-size: 1MB
    allowed-origins: []
    rate-limit:
      api-requests: 120
      auth-requests: 10
      window: 1m
      max-clients: 10000
```

Não versione `.env` real nem secrets. O Spring iniciado diretamente não lê o `.env` da raiz; exporte as variáveis no processo ou use o secret store do ambiente.

## Banco e testes

As migrações atuais são:

1. ingredientes;
2. receitas, ingredientes associados e etapas;
3. usuários da aplicação;
4. índice de busca por trecho no nome dos ingredientes;
5. catálogo inicial de ingredientes;
6. índice de busca por trecho no nome das receitas;
7. entradas persistentes do planejamento semanal;
8. quantidade de preparos por receita planejada;
9. URL opcional de vídeo do YouTube nas receitas;
10. autoria obrigatória das receitas, com backfill do catálogo legado para uma conta técnica desabilitada, chave estrangeira restritiva e índice por autor.

Os índices das migrações 4 e 6 exigem a extensão PostgreSQL `pg_trgm`. Em produção, um DBA ou a infraestrutura como código deve executar `CREATE EXTENSION IF NOT EXISTS pg_trgm` antes da aplicação das migrações; a credencial normal do backend/Flyway não deve receber `CREATE` no banco apenas para instalar extensões. O Compose local pré-provisiona a extensão pelo script `db/bootstrap/postgres_extensions.sql` somente ao inicializar um volume novo, e os Testcontainers executam o mesmo bootstrap antes do Flyway.

Em um volume local criado antes desse bootstrap, provisione a extensão uma vez antes de atualizar o backend:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"'
```

O Hibernate apenas valida o schema (`ddl-auto=validate`). Os testes usam PostgreSQL real via Testcontainers:

```bash
cd backend
./mvnw -B -ntp clean verify
```

O Docker Desktop deve estar ativo.

## Recursos ainda não implementados

- despensa;
- recuperação/verificação de conta e MFA;
- compartilhamento explícito de receitas com outros usuários;
- OIDC/SSO, recomendado como evolução quando um provedor de identidade for escolhido.

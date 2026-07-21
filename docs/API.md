# API — Mesa da Semana

Esta documentação descreve o contrato HTTP disponível no estado atual do backend e como inspecioná-lo localmente.

> **Importante:** ainda não existem endpoints de negócio para receitas, ingredientes, planejamento semanal, compras ou despensa. Esses recursos serão documentados aqui conforme forem implementados e testados.

## Sumário

- [Visão geral](#visão-geral)
- [Iniciando a API](#iniciando-a-api)
- [Endpoints disponíveis](#endpoints-disponíveis)
- [Health check](#health-check)
- [Informações do serviço](#informações-do-serviço)
- [OpenAPI](#openapi)
- [Swagger UI](#swagger-ui)
- [Autenticação e segurança](#autenticação-e-segurança)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco e migrações](#banco-e-migrações)
- [Erros e versionamento](#erros-e-versionamento)
- [Estado dos recursos de negócio](#estado-dos-recursos-de-negócio)

## Visão geral

| Item                           | Valor atual             |
| ------------------------------ | ----------------------- |
| URL-base local                 | `http://localhost:8081` |
| Formato previsto para recursos | JSON em UTF-8           |
| Especificação                  | OpenAPI 3.1             |
| Autenticação                   | Ainda não implementada  |
| Persistência                   | PostgreSQL 17           |
| Migrações                      | Flyway                  |

Os endpoints administrativos atualmente expostos são fornecidos pelo Spring Boot Actuator e pelo Springdoc. Não há prefixo `/api` utilizável nesta etapa porque os controladores de negócio ainda não foram criados.

## Iniciando a API

Na raiz do repositório, inicie o banco:

```bash
docker compose up -d db
docker compose ps
```

Depois, em outro terminal:

```bash
cd backend
./mvnw spring-boot:run
```

A API estará pronta quando o log contiver:

```text
Started MealPlannerApplication
```

Teste a disponibilidade:

```bash
curl -i http://localhost:8081/actuator/health
```

## Endpoints disponíveis

| Método | Caminho            | Finalidade                                       | Autenticação atual     |
| ------ | ------------------ | ------------------------------------------------ | ---------------------- |
| `GET`  | `/actuator/health` | Estado geral e grupos de disponibilidade         | Não exigida localmente |
| `GET`  | `/actuator/info`   | Informações públicas configuradas para o serviço | Não exigida localmente |
| `GET`  | `/v3/api-docs`     | Especificação OpenAPI em JSON                    | Não exigida localmente |
| `GET`  | `/swagger-ui.html` | Entrada da interface Swagger UI                  | Não exigida localmente |

## Health check

### Requisição

```http
GET /actuator/health HTTP/1.1
Host: localhost:8081
Accept: application/json
```

Exemplo com `curl`:

```bash
curl -sS http://localhost:8081/actuator/health
```

### Resposta saudável

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.spring-boot.actuator.v3+json
```

Exemplo de corpo observado na fundação do projeto:

```json
{
  "groups": ["liveness", "readiness"],
  "status": "UP"
}
```

O campo `status` indica o estado agregado. A configuração atual usa `show-details: when-authorized`; portanto, detalhes de componentes podem não aparecer para uma chamada anônima.

Estados comuns do Actuator incluem:

| Estado           | Significado geral                            |
| ---------------- | -------------------------------------------- |
| `UP`             | Serviço disponível                           |
| `DOWN`           | Um componente essencial está indisponível    |
| `OUT_OF_SERVICE` | Serviço removido deliberadamente de operação |
| `UNKNOWN`        | Não foi possível determinar o estado         |

Não dependa da presença ou da ordem de campos adicionais; use `status` como sinal principal.

## Informações do serviço

### Requisição

```bash
curl -sS http://localhost:8081/actuator/info
```

A rota está exposta, mas pode retornar um objeto vazio enquanto não houver propriedades `info.*` configuradas. Não a utilize como fonte de versão até que metadados de build sejam adicionados explicitamente.

## OpenAPI

A especificação é gerada automaticamente pelo Springdoc a partir da aplicação em execução.

### Consultar JSON

```bash
curl -sS http://localhost:8081/v3/api-docs
```

URL local:

<http://localhost:8081/v3/api-docs>

No estado atual, o documento é OpenAPI 3.1 e pode conter `paths` vazio, pois os controladores de negócio ainda não foram implementados.

### Salvar a especificação

No Windows com Git Bash, salve no diretório atual usando um caminho que o `curl.exe` consiga escrever:

```bash
curl -sS http://localhost:8081/v3/api-docs -o api-docs.json
```

A especificação em execução é a fonte de verdade para os endpoints publicados. Este arquivo Markdown fornece contexto operacional, exemplos e decisões que não aparecem integralmente no schema.

## Swagger UI

Abra no navegador:

<http://localhost:8081/swagger-ui.html>

O Springdoc pode redirecionar essa URL para a página interna da interface. O Swagger UI permite inspecionar operações e schemas e, futuramente, executar requisições de teste.

## Autenticação e segurança

O estágio atual não possui Spring Security, autenticação ou autorização de usuários.

Consequências:

- não publique esta API diretamente na internet;
- não use credenciais reais ou de produção;
- considere todos os endpoints locais como não protegidos;
- autenticação, autorização e política de CORS devem ser definidas antes de qualquer implantação externa.

A ausência de autenticação nesta etapa não representa o contrato definitivo do produto.

## Variáveis de ambiente

O backend aceita:

| Variável            | Padrão                                          | Descrição              |
| ------------------- | ----------------------------------------------- | ---------------------- |
| `DATABASE_URL`      | `jdbc:postgresql://localhost:5433/meal_planner` | URL JDBC do PostgreSQL |
| `DATABASE_USERNAME` | `meal_planner`                                  | Usuário do banco       |
| `DATABASE_PASSWORD` | `meal_planner_local`                            | Senha do banco local   |
| `BACKEND_PORT`      | `8081`                                          | Porta HTTP             |

Exemplo no Git Bash:

```bash
export DATABASE_URL='jdbc:postgresql://localhost:5433/meal_planner'
export DATABASE_USERNAME='meal_planner'
export DATABASE_PASSWORD='meal_planner_local'
export BACKEND_PORT='8081'
./mvnw spring-boot:run
```

O Spring Boot iniciado diretamente não lê automaticamente o `.env` da raiz. Consulte o [README principal](../README.md#configuração) para distinguir variáveis do backend e do Docker Compose.

## Banco e migrações

A aplicação usa:

- PostgreSQL 17;
- Spring Data JPA;
- Flyway habilitado;
- `spring.jpa.hibernate.ddl-auto=validate`;
- `spring.jpa.open-in-view=false`.

O Hibernate valida o schema, mas não deve criá-lo ou alterá-lo. Mudanças estruturais devem ser feitas por migrações versionadas do Flyway.

No estado atual não existem tabelas ou migrações de domínio. A primeira migração será introduzida junto ao primeiro recurso persistente.

Os testes do backend usam Testcontainers e iniciam um PostgreSQL isolado automaticamente. O Docker Desktop deve estar ativo:

```bash
cd backend
./mvnw test
```

## Erros e versionamento

Ainda não existe um formato global de erro nem uma estratégia pública de versionamento para endpoints de negócio.

Antes de publicar os primeiros endpoints, o projeto deverá definir e testar:

- prefixo e versão da API, por exemplo `/api/v1`;
- formato uniforme de erros de validação e regras de negócio;
- códigos HTTP de cada operação;
- paginação, ordenação e filtros;
- tratamento de datas, horas, quantidades e unidades;
- política de compatibilidade e descontinuação.

Esses itens são decisões pendentes, não contratos já assumidos.

## Estado dos recursos de negócio

| Recurso                 | Situação         |
| ----------------------- | ---------------- |
| Ingredientes            | Não implementado |
| Unidades e conversões   | Não implementado |
| Receitas                | Não implementado |
| Etapas de preparo       | Não implementado |
| Planejamento semanal    | Não implementado |
| Lista de compras        | Não implementado |
| Despensa                | Não implementado |
| Usuários e autenticação | Não implementado |

Quando um recurso for implementado, esta documentação deverá incluir:

1. método e caminho;
2. parâmetros de rota e consulta;
3. corpo de entrada;
4. resposta de sucesso;
5. erros possíveis;
6. exemplos verificáveis com `curl`;
7. referência ao schema correspondente no OpenAPI.

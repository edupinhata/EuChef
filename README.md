# EuChef

Aplicação web mobile-first para organizar receitas, planejar as refeições da semana e, nas próximas etapas, gerar listas de compras considerando os itens disponíveis na despensa.

> **Estado atual:** autenticação por sessão, perfis `USER`/`ADMIN` e controles HTTP protegem a aplicação. Ingredientes e receitas possuem CRUD integrado entre backend e frontend, e o planejamento semanal já é persistente e isolado por usuário. A lista de compras e a despensa ainda serão implementadas.
>
> 📋 **Pendências e preparação para produção:** consulte o [`TODO.md`](TODO.md).

## Sumário

- [To Do e preparação para produção](TODO.md)
- [Uso de IA por pull request](docs/engineering/ai-usage/README.md)
- [Funcionalidades atuais](#funcionalidades-atuais)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como executar](#como-executar)
- [Endereços locais](#endereços-locais)
- [Testes e qualidade](#testes-e-qualidade)
- [Fluxo de desenvolvimento e GitHub](#fluxo-de-desenvolvimento-e-github)
- [Build de produção](#build-de-produção)
- [Comandos do banco de dados](#comandos-do-banco-de-dados)
- [Documentação da API](#documentação-da-api)
- [Solução de problemas](#solução-de-problemas)

## Funcionalidades atuais

- shell responsivo com prioridade para celulares;
- navegação entre Semana, Receitas, Ingredientes, Compras e Despensa;
- planejamento semanal persistente com navegação entre semanas, busca, inclusão e remoção de receitas;
- CRUD de ingredientes no backend e frontend;
- CRUD de receitas no backend e frontend, com ingredientes, quantidades, unidades e passos ordenáveis;
- cadastro, login, restauração de sessão e logout no frontend;
- autenticação por sessão, CSRF e autorização `USER`/`ADMIN` no backend;
- CORS restritivo, limites de payload, rate limiting e headers de segurança;
- backend conectado ao PostgreSQL;
- health check com Spring Boot Actuator;
- especificação OpenAPI e Swagger UI;
- testes automatizados no backend e frontend.

As telas de compras e despensa ainda representam a estrutura inicial do produto e não persistem dados.

## Tecnologias

### Backend

- Java 21;
- Spring Boot 4.0.7;
- Spring Web MVC;
- Spring Data JPA;
- Spring Security;
- Bean Validation;
- Flyway;
- PostgreSQL;
- Spring Boot Actuator;
- Springdoc OpenAPI;
- Maven Wrapper;
- JUnit e Testcontainers.

### Frontend

- React 19;
- TypeScript;
- Vite;
- React Router;
- TanStack Query;
- React Hook Form;
- Zod;
- Vitest e Testing Library;
- Oxlint e Prettier.

### Infraestrutura local

- Docker Compose com PostgreSQL, backend e frontend;
- imagens multi-stage com processos de aplicação não privilegiados;
- Nginx para SPA, cabeçalhos de segurança e proxy da API;
- GitHub Actions para CI, smoke test e publicação no GHCR.

## Estrutura do projeto

```text
EuChef/
├── .github/                # CI, publicação, Dependabot e template de PR
├── backend/                 # API Spring Boot
│   ├── Dockerfile
│   ├── src/main/
│   ├── src/test/
│   ├── pom.xml
│   └── mvnw
├── frontend/                # Aplicação React
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── API.md               # Contrato e operação da API
│   ├── DEVELOPMENT.md       # Branches, PRs, CI, Copilot e releases
│   └── engineering/         # Métricas de uso de IA por PR
├── scripts/                 # Automação local e seus testes
├── TODO.md                  # Pendências priorizadas e critérios para produção
├── compose.yaml             # Stack local completo
├── .env.example             # Exemplo de variáveis do Compose
└── README.md
```

## Requisitos

Instale as ferramentas abaixo antes de começar:

| Ferramenta     |        Versão recomendada | Uso                               |
| -------------- | ------------------------: | --------------------------------- |
| Java (JDK)     |                        21 | Compilar e executar o backend     |
| Node.js        | 22 ou superior compatível | Executar e compilar o frontend    |
| npm            |    Incluído com o Node.js | Dependências do frontend          |
| Docker Desktop |              Versão atual | PostgreSQL local e Testcontainers |
| Git            |              Versão atual | Obter e versionar o código        |

O Maven não precisa ser instalado globalmente. O projeto inclui o Maven Wrapper, que baixa a versão necessária na primeira execução. Essa primeira execução requer acesso à internet.

Verifique as instalações:

```bash
java -version
node --version
npm --version
docker --version
docker compose version
git --version
```

No Windows, os exemplos abaixo foram validados no **Git Bash**. O Docker Desktop deve estar iniciado.

## Instalação

### 1. Obtenha o código

Via HTTPS, que funciona para leitura do repositório público sem configurar uma chave SSH:

```bash
git clone https://github.com/edupinhata/EuChef.git
cd EuChef
```

Quem já possui uma chave SSH autorizada no GitHub pode usar `git clone git@github.com:edupinhata/EuChef.git`. Para trabalhar a partir de um fork, substitua a URL pela do próprio fork.

Se o código já estiver em sua máquina, entre diretamente na pasta raiz do projeto.

### 2. Instale as dependências do frontend

A partir da raiz do repositório:

```bash
cd frontend
npm ci
cd ..
```

`npm ci` usa exatamente as versões registradas em `package-lock.json`. Use `npm install` apenas quando precisar adicionar ou atualizar dependências.

### 3. Prepare o Maven Wrapper

No Linux ou macOS, confirme que o script pode ser executado:

```bash
chmod +x backend/mvnw
```

No Windows com Git Bash, o script `./mvnw` já pode ser usado diretamente.

## Configuração

O perfil Spring `local` e o Compose funcionam sem secrets de produção:

| Serviço    | Host        |  Porta | Banco/usuário  |
| ---------- | ----------- | -----: | -------------- |
| PostgreSQL | `localhost` | `5433` | `meal_planner` |
| Backend    | `localhost` | `8081` | —              |
| Frontend   | `localhost` | `5173` | —              |

As portas `5433` e `8081` evitam conflito com outros serviços locais que utilizam as portas tradicionais `5432` e `8080`.

### Variáveis do Docker Compose

Para alterar o PostgreSQL local, copie o exemplo na **raiz do projeto**:

```bash
cp .env.example .env
```

O Docker Compose lê automaticamente esse `.env`:

| Variável                 | Padrão                  | Descrição                                |
| ------------------------ | ----------------------- | ---------------------------------------- |
| `POSTGRES_DB`            | `meal_planner`          | Nome do banco                            |
| `POSTGRES_USER`          | `meal_planner`          | Usuário do banco                         |
| `POSTGRES_PASSWORD`      | `meal_planner_local`    | Senha somente para desenvolvimento local |
| `POSTGRES_PORT`          | `5433`                  | Porta local do PostgreSQL                |
| `BACKEND_PORT`           | `8081`                  | Porta local do backend                   |
| `FRONTEND_PORT`          | `5173`                  | Porta local do frontend                  |
| `EUCHEF_ALLOWED_ORIGINS` | `http://localhost:5173` | Origens CORS locais permitidas           |

O arquivo `.env` está ignorado pelo Git e não deve conter credenciais de produção.

### Variáveis do backend

O Spring Boot executado diretamente **não carrega o `.env` da raiz automaticamente**. Para sobrescrever valores, exporte as variáveis no mesmo terminal antes de iniciar o backend:

```bash
export DATABASE_URL='jdbc:postgresql://localhost:5433/meal_planner'
export DATABASE_USERNAME='meal_planner'
export DATABASE_PASSWORD='meal_planner_local'
export BACKEND_PORT='8081'
export EUCHEF_ALLOWED_ORIGINS='http://localhost:5173'
export SPRING_PROFILES_ACTIVE='local'
```

Valores aceitos:

| Variável                 | Padrão                     | Descrição             |
| ------------------------ | -------------------------- | --------------------- |
| `DATABASE_URL`           | default somente em `local` | URL JDBC              |
| `DATABASE_USERNAME`      | default somente em `local` | Usuário JDBC          |
| `DATABASE_PASSWORD`      | default somente em `local` | Senha JDBC            |
| `EUCHEF_ALLOWED_ORIGINS` | default somente em `local` | Allowlist CORS        |
| `BACKEND_PORT`           | `8081`                     | Porta HTTP do backend |

O perfil `prod` não possui fallback para banco, senha ou origens permitidas e recusa a inicialização quando a configuração obrigatória está ausente.

Se alterar usuário, senha, banco ou porta no Compose, mantenha as variáveis `DATABASE_*` do backend consistentes.

## Como executar

### Stack completo com Docker

Esta é a forma mais próxima do artefato de entrega e exige apenas Docker:

```bash
cp .env.example .env
docker compose up --build --detach --wait
```

A aplicação estará em <http://localhost:5173>. Para consultar o estado e encerrar:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

### Desenvolvimento com recarga automática

Use três terminais: um para o banco, um para o backend e outro para o frontend.

### 1. Inicie o PostgreSQL

Na raiz do projeto:

```bash
docker compose up -d db
docker compose ps
```

Aguarde até o serviço `db` aparecer como `healthy`.

### 2. Inicie o backend

Em outro terminal:

```bash
cd backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

No Windows sem Git Bash, também é possível usar:

```bat
cd backend
set SPRING_PROFILES_ACTIVE=local
mvnw.cmd spring-boot:run
```

O backend estará pronto quando o log exibir `Started MealPlannerApplication`.

### 3. Inicie o frontend

Em outro terminal:

```bash
cd frontend
npm run dev
```

O Vite exibirá o endereço local no terminal.

## Endereços locais

| Recurso                | Endereço                                                 |
| ---------------------- | -------------------------------------------------------- |
| Aplicação web          | <http://localhost:5173>                                  |
| Backend                | <http://localhost:8081>                                  |
| Health check           | <http://localhost:8081/actuator/health>                  |
| Informações do serviço | <http://localhost:8081/actuator/info> (`ADMIN`, local)   |
| Swagger UI             | <http://localhost:8081/swagger-ui.html> (`ADMIN`, local) |
| OpenAPI JSON           | <http://localhost:8081/v3/api-docs> (`ADMIN`, local)     |
| PostgreSQL             | `localhost:5433`                                         |

## Testes e qualidade

O Docker Desktop precisa estar ativo para os testes do backend, pois eles usam um PostgreSQL real por meio do Testcontainers.

### Backend

```bash
cd backend
./mvnw test
```

### Frontend

```bash
cd frontend
npm run lint
npm test -- --run
npm run build
npm run format:check
```

Para executar todos os gates a partir da raiz no Git Bash:

```bash
(cd backend && ./mvnw -B -ntp clean verify)
(cd frontend && npm run lint && npm test -- --run && npm run build && npm run format:check)
```

Para validar o mesmo empacotamento executado na CI:

```bash
docker compose config --quiet
docker compose build
docker compose up --detach --wait
curl --fail http://localhost:5173/actuator/health
docker compose down
```

Para apagar também o volume persistente do PostgreSQL, use `docker compose down --volumes`. Essa operação é destrutiva e remove os dados locais.

### Desenvolvimento orientado a testes

O Vitest pode permanecer observando alterações durante o desenvolvimento:

```bash
cd frontend
npm test
```

Para formatar o frontend automaticamente:

```bash
cd frontend
npm run format
```

## Fluxo de desenvolvimento e GitHub

Contribuições seguem branches curtas e pull requests para `main`. Após ativar o ruleset administrativo descrito no guia, CI e review pelo GitHub Copilot tornam-se automáticos e obrigatórios. O guia completo está em [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

Os workflows versionados são:

- `.github/workflows/ci.yml`: testes, lint, formatação, build e smoke test do Compose;
- `.github/workflows/publish-images.yml`: publicação manual ou por tag no GitHub Container Registry;
- `.github/dependabot.yml`: atualizações periódicas de Maven, npm, Actions e imagens-base.

## Build de produção

### Imagens Docker

Na raiz:

```bash
docker compose build
```

As imagens locais geradas são `euchef/backend:local` e `euchef/frontend:local`. Tags `vX.Y.Z` publicam imagens multi-arquitetura no GHCR; consulte [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

### Backend

```bash
cd backend
./mvnw clean package
java -jar target/meal-planner-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

O empacotamento executa os testes. Produção deve usar `--spring.profiles.active=prod`, HTTPS e injetar `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` e `EUCHEF_ALLOWED_ORIGINS` pelo ambiente ou secret store.

### Bloqueio atual para exposição pública

O cadastro imediato retorna `409 EMAIL_ALREADY_REGISTERED` quando o e-mail já existe. Essa resposta melhora a experiência local, mas permite **enumeração de contas**: terceiros conseguem confirmar quais endereços possuem usuário. O risco foi aceito temporariamente apenas para desenvolvimento e homologação privada. O rate limiting reduz automação e credential stuffing, mas não elimina o canal.

Antes de abrir o EuChef ao público, o cadastro deve usar confirmação de e-mail fora de banda, resposta HTTP indistinguível para endereços novos e existentes, tokens temporários de uso único e controles de reenvio. Essa mudança é um **critério obrigatório de produção**, registrado em [`TODO.md`](TODO.md).

Em qualquer implantação, o backend deve permanecer inacessível diretamente pela internet e receber tráfego apenas do proxy confiável. O Nginx sobrescreve `X-Forwarded-For` com o endereço observado na conexão, em vez de aceitar a cadeia fornecida pelo cliente.

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

Os arquivos estáticos são gerados em `frontend/dist/`. O comando `preview` serve apenas para conferência local; a imagem Docker usa Nginx para servir a SPA e encaminhar a API.

## Comandos do banco de dados

Na raiz do projeto:

```bash
# Ver estado
docker compose ps

# Acompanhar logs
docker compose logs -f db

# Parar os contêineres sem remover os dados
docker compose down

# Iniciar novamente
docker compose up -d db
```

Para remover também o volume e apagar todos os dados locais:

```bash
docker compose down -v
```

> **Atenção:** `docker compose down -v` é destrutivo. Use somente quando quiser recriar o banco do zero.

Quando o backend for iniciado contra esse banco vazio, o Flyway aplicará as migrações e a
`V5__seed_initial_catalog.sql` carregará o catálogo inicial: 200 ingredientes com descrição e valores
nutricionais médios aproximados por 100 g, além de 30 receitas que, em conjunto, utilizam todo o catálogo.
Os valores variam conforme marca, variedade, maturação e preparo e não substituem rótulos nem orientação
nutricional profissional.

Em um banco já existente, a migração preserva ingredientes e receitas que tenham o mesmo nome, sem
sobrescrever o conteúdo cadastrado pelo usuário.

## Documentação da API

A documentação operacional e o contrato atual da API estão em [`docs/API.md`](docs/API.md).

Com o backend em execução, consulte também:

- [Swagger UI](http://localhost:8081/swagger-ui.html), para navegação interativa;
- [OpenAPI JSON](http://localhost:8081/v3/api-docs), para integração com ferramentas e geração de clientes.

O backend oferece autenticação e CRUD protegido de ingredientes e receitas. Planejamento, compras e despensa ainda não possuem endpoints persistentes.

## Solução de problemas

### Docker não está disponível

Confirme que o Docker Desktop está aberto e saudável:

```bash
docker info
docker compose ps
```

### A porta `5433` já está ocupada

Altere `POSTGRES_PORT` no `.env`. Depois ajuste `DATABASE_URL` ao iniciar o backend.

Exemplo:

```bash
export DATABASE_URL='jdbc:postgresql://localhost:5434/meal_planner'
```

### A porta `8081` já está ocupada

Inicie o backend em outra porta:

```bash
BACKEND_PORT=8082 ./mvnw spring-boot:run
```

### O Maven Wrapper não consegue baixar o Maven

Verifique a conexão com a internet, proxy corporativo e certificados. A primeira execução do wrapper baixa a distribuição definida em `backend/.mvn/wrapper/maven-wrapper.properties`.

### O backend não conecta ao banco

1. confirme que `docker compose ps` mostra o banco como `healthy`;
2. confira porta, usuário, senha e nome do banco;
3. verifique se `DATABASE_URL`, `DATABASE_USERNAME` e `DATABASE_PASSWORD` correspondem ao Compose;
4. consulte os logs com `docker compose logs db`.

### O frontend não abre

Confirme a instalação e reinicie o Vite:

```bash
cd frontend
npm ci
npm run dev
```

## Segurança

As credenciais padrão existem apenas no perfil local. O Compose vincula PostgreSQL, backend e frontend somente a `127.0.0.1`, executa os serviços de aplicação sem privilégio e usa filesystem somente leitura. O backend nega acesso por padrão, usa sessão `HttpOnly`, CSRF, perfis `USER`/`ADMIN`, CORS por allowlist, limites de corpo, rate limiting e headers de segurança. Uma implantação pública ainda exige TLS, secrets externos, backup, observabilidade, recuperação e validação no ambiente de destino.

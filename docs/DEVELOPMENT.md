# Fluxo de desenvolvimento, CI e entrega

Este documento define o fluxo de contribuição do EuChef e as automações executadas pelo GitHub.

## Visão geral

```text
issue/tarefa
   ↓
branch curta a partir de main
   ↓
commits convencionais + testes locais
   ↓
pull request
   ├── CI: backend
   ├── CI: frontend
   ├── CI: build e smoke test Docker
   └── GitHub Copilot: revisão automática
   ↓
correções + nova revisão
   ↓
squash merge em main
   ↓
tag vX.Y.Z ou execução manual
   ↓
imagens backend/frontend no GHCR
```

No GitHub, o nome usado é **pull request (PR)**. Ele corresponde ao _merge request_ de outras plataformas.

## Estratégia de branches

A branch `main` deve permanecer estável e receber mudanças somente por PR.

Crie branches curtas e focadas:

| Prefixo     | Uso                                 |
| ----------- | ----------------------------------- |
| `feat/`     | funcionalidade                      |
| `fix/`      | correção                            |
| `refactor/` | refatoração sem alteração funcional |
| `test/`     | cobertura de testes                 |
| `docs/`     | documentação                        |
| `ci/`       | CI, entrega e automação             |
| `chore/`    | manutenção                          |

Exemplo:

```bash
git switch main
git pull --ff-only
git switch -c feat/recipe-form
```

## Commits

Use Conventional Commits:

```text
feat: add recipe creation form
fix: reject duplicate ingredient names
ci: add container smoke test
```

Cada commit deve ser coeso, não conter segredos nem artefatos gerados e preservar os gates aplicáveis descritos em [`AGENTS.md`](../AGENTS.md).

## Pull requests

1. Atualize a branch com `main`.
2. Execute os testes afetados localmente.
3. Faça push da branch.
4. Abra o PR usando o template do repositório.
5. Aguarde todos os checks e o review do Copilot.
6. Resolva comentários ou justifique decisões no próprio PR.
7. Após novos pushes, aguarde a nova CI. Solicite manualmente outro review do Copilot quando as alterações forem relevantes para a análise.
8. Faça **squash merge** somente com os checks obrigatórios verdes.

A revisão por IA auxilia o processo, mas não substitui testes, análise humana ou responsabilidade do autor. Sugestões podem estar erradas e devem ser verificadas antes de serem aplicadas.

## CI — `.github/workflows/ci.yml`

A CI executa em todo PR para `main`, em pushes para `main` e manualmente.

### Backend — test and package

- Java 21 Temurin;
- cache Maven;
- `./mvnw -B -ntp clean verify`;
- testes de integração com PostgreSQL via Testcontainers;
- empacotamento do JAR.

### Frontend — quality and build

- Node.js 22;
- instalação reproduzível com `npm ci`;
- Prettier;
- Oxlint;
- Vitest;
- build TypeScript/Vite;
- `npm audit` bloqueando vulnerabilidades de severidade alta ou crítica.

### Containers — build and smoke test

Esse job só começa depois dos jobs de backend e frontend:

- valida o Compose;
- constrói as imagens multi-stage;
- bloqueia vulnerabilidades corrigíveis altas/críticas e segredos detectados nas imagens com Trivy;
- sobe PostgreSQL, backend e frontend;
- aguarda os healthchecks;
- verifica frontend, Actuator e API pelo proxy Nginx;
- sempre encerra os serviços e remove o volume efêmero.

As GitHub Actions de terceiros estão fixadas por SHA completo e as imagens-base por digest multiarch para reduzir risco de alteração de tags na cadeia de suprimentos. O Dependabot propõe suas atualizações.

Os estágios runtime executam `apk upgrade` para incorporar correções de segurança publicadas depois do digest da imagem-base. Essa escolha prioriza patches atuais: embora entradas, versões e ponto de partida estejam fixados, o build não é reprodutível bit a bit enquanto os repositórios Alpine puderem receber novos pacotes.

## Restrições antes de produção

- O cadastro público atual distingue e-mail novo de existente por `201`/`409`. Essa enumeração foi aceita temporariamente somente para desenvolvimento e homologação privada. Produção exige confirmação de e-mail fora de banda e resposta indistinguível.
- O backend não pode ser publicado diretamente. Ele deve receber tráfego somente do proxy confiável, que sobrescreve `X-Forwarded-For`; redes e regras do ambiente de destino devem impor essa fronteira.
- O primeiro `ADMIN` não é criado por endpoint público. A promoção deve ocorrer por procedimento administrativo controlado e auditável; nunca aceite o papel enviado pelo cliente.
- O rate limiter backend mantém estado por instância. Múltiplas réplicas exigem gateway ou armazenamento compartilhado.

## Review automático com GitHub Copilot

O conteúdo versionado que orienta o review está em:

- [`AGENTS.md`](../AGENTS.md), fonte canônica;
- [`.github/copilot-instructions.md`](../.github/copilot-instructions.md), adaptador do Copilot.

A ativação automática é uma configuração administrativa do GitHub e não deve ser simulada por um workflow com token privilegiado.

### Ruleset recomendado para `main`

Em **Settings → Rules → Rulesets → New branch ruleset**:

1. nome: `main-protection`;
2. enforcement: `Active`;
3. target: `Include default branch`;
4. habilitar **Require a pull request before merging**;
5. habilitar **Require status checks to pass**;
6. selecionar os checks da CI após a primeira execução:
   - `Backend — test and package`;
   - `Frontend — quality and build`;
   - `Containers — build and smoke test`;
7. habilitar **Block force pushes**;
8. habilitar **Automatically request Copilot code review**;
9. não habilitar **Review new pushes**; novos reviews após alterações são solicitados manualmente;
10. não habilitar review de drafts inicialmente, para controlar consumo e ruído.

O recurso depende de um plano GitHub Copilot compatível e da política da conta. Se a opção não aparecer, confira o plano e a disponibilidade em [Configuring automatic code review by GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-automatic-review).

### Proteção de tags de release

O ruleset ativo `release-tag-protection` corresponde a `refs/tags/v*`. Ele permite criar uma nova tag de release, mas bloqueia atualização e exclusão posteriores. Para corrigir uma tag publicada por engano, um administrador deve desativar ou alterar deliberadamente o ruleset antes da operação.

## Execução local empacotada

Na raiz:

```bash
cp .env.example .env
docker compose up --build --detach --wait
```

Acesse <http://localhost:5173>. O Nginx encaminha `/api` e `/actuator` para o backend.

Verifique:

```bash
curl --fail http://localhost:5173/healthz
curl --fail http://localhost:5173/actuator/health
test "$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:5173/api/v1/ingredients)" = "401"
```

Para acompanhar e encerrar:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

Para apagar também o banco local, use o comando destrutivo abaixo:

```bash
docker compose down --volumes
```

As portas locais são vinculadas a `127.0.0.1`. O backend exige sessão e CSRF, mas exposição pública ainda depende de TLS, secrets externos, backup, observabilidade e validação no ambiente de destino.

## Imagens no GitHub Container Registry

O workflow `.github/workflows/publish-images.yml` publica:

- `ghcr.io/edupinhata/euchef-backend`;
- `ghcr.io/edupinhata/euchef-frontend`.

Antes de publicar, o workflow repete a CI completa e confirma que o commit pertence à branch `main`. Ele roda:

- manualmente por **Actions → Publish container images → Run workflow**; ou
- ao publicar uma tag SemVer, como `v0.1.0`.

Exemplo de release:

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "EuChef v0.1.0"
git push origin v0.1.0
```

As imagens são multi-arquitetura (`linux/amd64` e `linux/arm64`) e incluem proveniência e SBOM geradas pelo BuildKit.

A publicação de imagens **não é deploy em produção**. Um ambiente remoto ainda precisa de secrets, domínio/TLS, backup, observabilidade e estratégia de rollback.

## Política de segredos e PRs externos

- nunca versione `.env`, chaves ou tokens;
- a CI de PR não recebe secrets de aplicação;
- o workflow de publicação não executa em `pull_request`;
- `GITHUB_TOKEN` recebe apenas `contents: read` e `packages: write` no job de publicação;
- não use `pull_request_target` para executar código não confiável;
- revise mudanças em workflows e Dockerfiles com atenção redobrada.

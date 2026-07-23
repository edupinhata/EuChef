# Uso de IA por pull request

Este diretório mantém métricas sanitizadas para comparar o esforço de IA entre mudanças do EuChef. O arquivo [`pr-costs.jsonl`](pr-costs.jsonl) possui um objeto JSON por pull request e é append-only.

## Objetivo e escopo

A unidade de medição é uma PR. O intervalo padrão começa **antes da primeira atividade de desenvolvimento** e termina **depois da validação local final**, imediatamente antes do commit que registra as métricas.

Commit, push, espera do CI e mensagens posteriores não entram no intervalo. Esse limite evita um ciclo no qual registrar a própria medição gera novos tokens indefinidamente e mantém as PRs comparáveis.

Para uma medição `complete` ser confiável:

- execute uma sessão Hermes separada para cada PR;
- não realize tarefas alheias na mesma sessão entre `start` e `finish`;
- não mantenha medições sobrepostas na mesma sessão;
- não altere modelo ou provedor durante o intervalo;
- execute `start` antes de investigar ou alterar o código;
- execute `finish` somente depois de testes, documentação e revisão local.

## Privacidade

Da exportação Hermes, o coletor não copia para o histórico ou snapshots:

- prompts ou respostas;
- mensagens e raciocínio textual;
- headers, credenciais, tokens de autenticação ou connection strings;
- nomes de usuário, chat IDs ou outros metadados pessoais.

O script consulta `hermes sessions export - --redact` em memória e persiste apenas identificadores técnicos da sessão, modelo, provedor, metadados de custo allowlisted, timestamps e contadores de uso. Tipos compostos e valores fora das allowlists falham antes de qualquer escrita. Snapshots iniciais ficam em `.ai-usage/`, que é ignorado pelo Git.

Título e atividades são os únicos campos de texto livre e são fornecidos pelo operador. O script limita tamanho e quantidade, normaliza Unicode antes das verificações e rejeita percent-encoding nas formas original e normalizada, controles, URIs, indicadores comuns de credenciais e sequências longas com aparência de token. Esses filtros são defesa em profundidade, não um detector universal de segredos: descreva apenas trabalho técnico não sensível; nunca tente codificar ou contornar as proteções.

Metadados de sessão falham fechados em todas as rotas. `started_at` deve ser um epoch numérico finito e não negativo; `ended_at` pode ser `null` enquanto a sessão está ativa, mas qualquer valor presente segue a mesma validação.

## Métricas

- `inputTokens`: tokens de entrada reportados pelo provedor;
- `outputTokens`: tokens de saída reportados pelo provedor;
- `totalTokens`: `inputTokens + outputTokens`;
- `cacheReadTokens` e `cacheWriteTokens`: cache registrado separadamente, sem somá-lo novamente em `totalTokens`;
- `reasoningTokens`: contador informativo do provedor; pode já fazer parte da cobrança de saída e não é somado novamente;
- `apiCalls` e `toolCalls`: volume de iterações e ferramentas;
- `agents`: agente principal e cada subagente associado;
- descendentes de subagentes são resolvidos transitivamente, com rejeição de duplicatas e ciclos;
- `cost.actualUsd`: custo real quando o provedor o fornece;
- `cost.estimatedUsd`: estimativa quando o Hermes possui uma tabela de preços aplicável;
- `cost.pricingVersions`: versões das tabelas usadas na estimativa;
- `cost.status: included`: acesso incluído em assinatura/OAuth, sem preço unitário disponível. `null` não significa custo econômico zero.
- `cost.status: mixed`: existem componentes reais, estimados ou incluídos de categorias diferentes;
- `cost.status: partial`: ao menos um componente possui custo indisponível;

Tokens brutos e custo permanecem separados. Isso permite recalcular custos no futuro sem reescrever as medições originais.

## Pré-requisitos

A partir da raiz do repositório:

O script requer Python 3.11 ou superior e uma instalação funcional do Hermes Agent.

```bash
python --version
hermes --version
hermes sessions list --limit 10
```

Use o ID da sessão dedicada à PR exibido pelo último comando.

## Iniciar uma medição

Execute antes de qualquer investigação ou alteração:

```bash
python scripts/ai_usage.py start \
  --work-id feat-recipe-ui \
  --session-id 20260723_120000_abcd1234
```

Isso cria somente `.ai-usage/feat-recipe-ui.json`, sem conteúdo de conversa. A criação é exclusiva e o comando recusa sobrescrever um snapshot existente.

## Finalizar uma medição

Depois da validação local final, mas antes do commit de telemetria:

```bash
python scripts/ai_usage.py finish \
  --work-id feat-recipe-ui \
  --pr 19 \
  --pr-url https://github.com/edupinhata/EuChef/pull/19 \
  --title "feat: implement recipe UI" \
  --activity "Implement recipe list and form" \
  --activity "Add backend and frontend regressions" \
  --activity "Run local quality gates" \
  --commit 0123456789abcdef0123456789abcdef01234567
```

O comando:

1. calcula o delta do agente principal;
2. agrega subagentes vinculados iniciados durante o intervalo;
3. valida schema, metadados, custos finitos e contadores regressivos;
4. mantém um lock interprocesso sobre o snapshot durante todo o consumo;
5. sob lock do histórico, valida todas as linhas, recusa duplicidades internas de PR ou `workId` e substitui o JSONL atomicamente;
6. permite repetir com a mesma PR e `workId` para concluir uma limpeza interrompida sem duplicar custo;
7. remove o snapshot local somente após gravar o histórico.

Os arquivos persistentes `*.json.lock` e `pr-costs.jsonl.lock` coordenam processos concorrentes e são ignorados pelo Git.

Revise a linha gerada e faça o commit final normalmente.

## Consultar evolução

```bash
python scripts/ai_usage.py report
```

A saída tabular diferencia medições completas, indisponíveis e custos incluídos, estimados ou reais. Para análises adicionais, leia o JSONL com Python, `jq`, planilha ou ferramenta de BI sem alterar o arquivo-fonte.

## Histórico anterior

PRs sem snapshot inicial recebem `measurementStatus: "unavailable"` e `totals: null`. Não estimamos ou retrocalculamos números ausentes a partir do tamanho do diff, duração ou mensagens, pois isso produziria dados falsamente precisos.

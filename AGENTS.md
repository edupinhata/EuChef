# AGENTS.md — Diretrizes obrigatórias de engenharia

## 1. Escopo e força normativa

Estas regras se aplicam a todo o monorepo **Mesa da Semana** e a qualquer agente, IA ou automação que analise, crie, altere, revise ou remova código.

Antes de trabalhar:

1. leia este arquivo por completo;
2. inspecione o código e os testes afetados;
3. preserve as convenções do módulo;
4. trate estas regras como critérios de aceite, não como sugestões.

Um `AGENTS.md` mais específico em um subdiretório pode complementar estas regras para aquele módulo, mas não pode enfraquecer testes, segurança ou qualidade. Instruções explícitas do usuário têm precedência; se uma solicitação conflitar com segurança ou integridade, informe o conflito antes de agir.

## 2. Estrutura e comandos do projeto

Este é um monorepo com:

- `backend/`: Java 21, Spring Boot, Maven Wrapper, JUnit 5, PostgreSQL, Flyway e Testcontainers;
- `frontend/`: React, TypeScript, Vite, Vitest e Testing Library;
- `docs/`: documentação funcional e da API.

Comandos de referência, executados na raiz do repositório:

```bash
(cd backend && ./mvnw test)
(cd frontend && npm test -- --run)
(cd frontend && npm run lint)
(cd frontend && npm run build)
```

Para feedback rápido durante TDD, testes diretamente relacionados podem ser executados isoladamente:

```bash
(cd backend && ./mvnw -Dtest=NomeDoTeste test)
(cd frontend && npx vitest run caminho/do/teste.test.tsx)
```

O conjunto completo continua obrigatório antes de declarar a tarefa concluída.

## 3. Testes automatizados obrigatórios

### 3.1 Regra principal

Todo comportamento novo ou alterado deve ser acompanhado por testes automatizados. Cubra o máximo que for razoavelmente possível e útil, priorizando comportamento, regras de negócio, limites, erros e regressões.

Use TDD sempre que viável:

1. escreva um teste que expresse o comportamento esperado;
2. execute-o e confirme que falha pela razão correta;
3. implemente o mínimo necessário;
4. execute o teste e confirme que passa;
5. refatore mantendo os testes verdes.

Correções de bugs devem começar por um teste de regressão que reproduza o defeito.

### 3.2 Escolha do nível de teste

- **Backend:** prefira testes unitários JUnit 5 para regras isoladas. Use Mockito apenas em fronteiras úteis; não simule objetos de valor ou lógica simples sem necessidade. Use testes de integração com Spring/Testcontainers quando o comportamento depende de HTTP, serialização, validação, JPA, Flyway, consultas ou PostgreSQL.
- **Frontend:** use Vitest para funções e hooks; use Testing Library e `user-event` para componentes e fluxos do ponto de vista do usuário. Evite testar detalhes internos de implementação.
- **Banco:** valide migrações, restrições, consultas e mapeamentos com banco compatível com produção. Não substitua PostgreSQL por banco em memória quando isso puder mascarar diferenças.

### 3.3 Exceções justificáveis

Uma classe ou alteração pode não exigir teste unitário próprio quando não possui comportamento significativo, por exemplo:

- tipos, enums ou DTOs puramente declarativos;
- configuração trivial já exercitada por teste de integração;
- código gerado;
- adaptadores sem lógica cuja cobertura real ocorre em teste de integração;
- alterações exclusivamente documentais ou visuais sem lógica testável.

A exceção não autoriza deixar o comportamento sem cobertura em outro nível. Não escreva testes artificiais para getters, setters, constantes ou detalhes da linguagem apenas para aumentar cobertura. Se não adicionar teste, registre na entrega final o motivo técnico.

## 4. Execução contínua dos testes

Após **cada mudança coerente de código**, execute imediatamente os testes unitários diretamente afetados. Não acumule várias alterações sem feedback.

Regras obrigatórias:

1. mudança no backend: execute ao menos o teste backend relacionado;
2. mudança no frontend: execute ao menos o teste frontend relacionado;
3. mudança compartilhada, de contrato ou integração: execute os testes dos dois lados afetados;
4. refatoração: execute os testes antes e depois;
5. antes da conclusão: execute as suítes completas de backend e frontend;
6. depois de corrigir uma falha, execute novamente o teste que falhou e, em seguida, a suíte relevante;
7. nunca declare que testes passaram sem saída real de execução.

Se um teste não puder ser executado por indisponibilidade de Docker, rede, ferramenta ou ambiente, tente corrigir o ambiente ou usar uma alternativa válida. Se continuar bloqueado, pare de afirmar conclusão e informe claramente:

- comando executado;
- erro observado;
- impacto da falta de validação;
- ação necessária para desbloquear.

Nunca remova, ignore, desabilite ou enfraqueça um teste apenas para obter build verde sem corrigir a causa e justificar a decisão.

## 5. Segurança obrigatória — OWASP

Toda implementação deve considerar as versões vigentes do **OWASP Top 10**, **OWASP ASVS** e, quando aplicável, **OWASP API Security Top 10**. Segurança faz parte da definição de pronto.

### 5.1 Princípios mínimos

- valide dados na fronteira do sistema com listas permitidas, tipos, limites de tamanho, faixas e formatos;
- aplique validações também no servidor; validação no frontend serve apenas à experiência do usuário;
- use consultas parametrizadas, JPA ou mecanismos equivalentes; nunca monte SQL com entrada não confiável;
- codifique saída conforme o contexto e não injete HTML não confiável;
- não use `dangerouslySetInnerHTML` sem sanitização comprovada e revisão explícita;
- não exponha stack traces, SQL, nomes internos, caminhos, credenciais ou dados sensíveis em respostas de erro;
- mantenha mensagens externas seguras e logs internos úteis, sem registrar segredos ou dados pessoais desnecessários;
- armazene segredos apenas em variáveis de ambiente ou gerenciadores apropriados; nunca faça commit de tokens, senhas, chaves ou credenciais reais;
- aplique menor privilégio a banco, arquivos, rede e identidades;
- configure CORS de forma restritiva; não use origem curinga com credenciais;
- ao usar autenticação por cookie, trate CSRF, atributos `Secure`, `HttpOnly` e `SameSite`;
- autenticação e autorização devem ser verificadas no servidor e negar acesso por padrão;
- proteja operações sensíveis contra enumeração de IDs e acesso indevido a objetos;
- limite payloads, coleções, paginação, uploads e consumo de recursos para reduzir abuso e negação de serviço;
- valide URLs e destinos de rede contra SSRF quando chamadas externas forem introduzidas;
- valide tipo, tamanho, nome e conteúdo de arquivos quando uploads forem introduzidos;
- use dependências mantidas, bloqueios de versão e verificação de vulnerabilidades;
- não desserialize tipos arbitrários nem execute comandos construídos com entrada externa;
- preserve integridade transacional em operações compostas;
- use cabeçalhos de segurança adequados quando a aplicação for exposta fora do ambiente local.

### 5.2 Processo por mudança

Para cada funcionalidade:

1. identifique entradas não confiáveis, dados sensíveis e fronteiras de autorização;
2. considere abuso, adulteração, vazamento, elevação de privilégio e indisponibilidade;
3. implemente controles proporcionais ao risco;
4. adicione testes para os controles importantes e caminhos negativos;
5. revise dependências e configuração afetadas;
6. documente riscos residuais relevantes.

O estado atual sem autenticação é apropriado apenas para desenvolvimento local. Não exponha a API publicamente sem autenticação, autorização, configuração de produção e revisão específica.

## 6. Complexidade computacional

Escolha estruturas de dados, algoritmos e consultas considerando o volume esperado e o pior caso razoável.

- identifique complexidade de tempo e memória em laços, buscas, ordenações, agrupamentos e transformações não triviais;
- evite laços aninhados acidentais e operações `O(n²)` quando mapas, conjuntos, índices ou pré-processamento oferecerem solução mais adequada;
- evite carregar coleções ilimitadas em memória;
- endpoints de listagem que possam crescer devem ter paginação, limites e ordenação determinística;
- evite consultas N+1 e acessos repetidos ao banco; use projeções, fetch adequado ou consultas em lote;
- crie índices coerentes com filtros, ordenações, unicidade e chaves estrangeiras frequentes;
- não faça chamadas de rede ou banco dentro de laços sem avaliar lote, cache e limites;
- considere concorrência, contenção, atomicidade e idempotência;
- meça ou faça benchmark antes de otimizações complexas quando o ganho não for evidente;
- documente decisões quando houver troca importante entre CPU, memória, latência, consistência e simplicidade.

Não faça otimização prematura de código pequeno ou fora de caminho crítico. Prefira primeiro uma solução correta, clara e com complexidade adequada.

## 7. Complexidade estrutural e cognitiva

O código deve ser compreensível e sustentável por outro desenvolvedor sem depender do histórico da conversa.

- mantenha classes, componentes e funções com responsabilidade coesa;
- prefira funções pequenas, nomes explícitos e fluxo linear;
- use retornos antecipados para reduzir aninhamento;
- evite mais de três níveis de aninhamento; extraia regras quando a leitura exigir rastrear muitos estados;
- evite condicionais extensas, parâmetros booleanos ambíguos e efeitos colaterais ocultos;
- extraia regras de negócio do controller, componente visual e infraestrutura;
- não crie abstrações prematuras, genéricas demais ou usadas uma única vez sem ganho claro;
- elimine duplicação de conhecimento, não necessariamente toda semelhança textual;
- componha componentes React e serviços Java por responsabilidade, sem arquivos monolíticos;
- mantenha contratos e tipos explícitos nas fronteiras;
- comentários devem explicar decisões e razões, não repetir o código;
- trate avisos de lint, análise estática e compilador como sinais de projeto, não ruído a ser silenciado.

Como orientação, investigue e refatore quando uma função ultrapassar aproximadamente 30–40 linhas de lógica, tiver muitos ramos ou exigir vários estados mentais simultâneos. Esses números não são metas mecânicas: coesão e clareza prevalecem.

## 8. Mudanças de banco e API

- nunca altere uma migração Flyway já aplicada em ambiente compartilhado; crie uma nova migração;
- preserve compatibilidade ou documente claramente mudanças incompatíveis de contrato;
- valide requests no backend e mantenha respostas de erro consistentes;
- atualize `docs/API.md` quando endpoints, payloads, erros ou variáveis mudarem;
- mantenha integridade referencial e defina explicitamente o comportamento de exclusão;
- teste limites, duplicidade, recurso inexistente e relacionamentos críticos.

## 9. Dependências e escopo

- adicione dependências somente quando houver benefício claro e verifique vulnerabilidades e manutenção;
- não faça refatorações não relacionadas à tarefa sem necessidade;
- não altere configuração, contrato ou comportamento silenciosamente;
- preserve `package-lock.json` e o Maven Wrapper;
- não faça commit de artefatos de build, logs, bancos locais ou segredos.

## 10. Definição de pronto

Uma tarefa só está concluída quando:

- requisitos e casos de erro relevantes estão implementados;
- testes adequados foram criados ou a exceção foi justificada;
- testes diretamente afetados passaram após cada mudança coerente;
- suítes completas afetadas passaram;
- lint, compilação e build dos módulos afetados passaram;
- riscos OWASP foram considerados e controles relevantes testados;
- complexidade computacional, consultas e consumo de memória foram avaliados;
- complexidade estrutural/cognitiva está aceitável;
- integração real foi exercitada quando a mudança cruza camadas;
- documentação foi atualizada;
- a entrega final informa comandos executados, resultados e limitações reais.

Não declare a obra pronta com testes vermelhos, verificações pendentes ou resultados presumidos.

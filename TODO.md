# To Do — EuChef

Painel resumido do que falta para evoluir o projeto do ambiente local atual até uma aplicação completa e segura para produção.

> **Regra:** um item só pode ser marcado como concluído quando sua implementação, seus testes e sua documentação estiverem prontos e os gates de qualidade estiverem verdes.

## Visão rápida

| Prioridade | Tema                                       | Situação                        |
| ---------- | ------------------------------------------ | ------------------------------- |
| P0         | Segurança para exposição pública           | Bloqueia produção               |
| P1         | Desempenho e consumo de recursos           | Necessário antes de crescer     |
| P1         | Correções funcionais e cobertura de testes | Necessário para confiabilidade  |
| P2         | Funcionalidades do produto                 | Necessário para completar o MVP |
| P2         | Manutenibilidade                           | Melhoria contínua               |

## P0 — Segurança antes de publicar

- [ ] **Adicionar autenticação e autorização no backend.**
  - Integrar Spring Security.
  - Exigir autenticação para leitura e escrita conforme a regra do produto.
  - Aplicar autorização no servidor, inclusive por recurso/usuário quando houver contas.
  - Testar acesso anônimo, acesso autorizado e acesso negado.
- [ ] **Criar configuração segura por ambiente.**
  - Manter as facilidades atuais somente no perfil local.
  - Não usar credenciais padrão em produção.
  - Carregar segredos por variáveis ou serviço seguro, nunca pelo repositório.
  - Desabilitar ou proteger Swagger/OpenAPI e endpoints administrativos em produção.
- [x] **Restringir a exposição do PostgreSQL local.**
  - Publicar a porta do Compose somente em `127.0.0.1`, salvo necessidade documentada.
  - Não reutilizar a senha de desenvolvimento em ambientes compartilhados.
- [ ] **Revisar controles HTTP para produção.**
  - CORS restrito às origens necessárias.
  - Proteção CSRF se a autenticação usar cookies.
  - Limites de payload, rate limiting e cabeçalhos de segurança.

> Enquanto este bloco não estiver concluído, a aplicação deve ser considerada **somente local** e não deve ser exposta publicamente.

## P1 — Desempenho e complexidade computacional

- [ ] **Eliminar o N+1 na listagem de receitas.**
  - Carregar receitas, ingredientes e passos com estratégia explícita e limitada.
  - Evitar uma consulta individual para cada ingrediente associado.
  - Adicionar teste que limite ou monitore a quantidade de consultas.
- [ ] **Adicionar paginação à listagem de receitas.**
  - Definir tamanho padrão e máximo por página.
  - Usar ordenação estável.
  - Atualizar o contrato OpenAPI e o frontend.
- [ ] **Adicionar paginação ou busca incremental aos ingredientes.**
  - Evitar carregar e renderizar toda a tabela de uma vez.
  - Definir limite máximo por resposta.
- [ ] **Validar ingredientes de receitas em lote.**
  - Substituir até 100 consultas sequenciais por uma busca única pelos IDs.
  - Informar claramente quais IDs não existem.

## P1 — Correções funcionais

- [ ] **Corrigir a exclusão de ingrediente utilizado por receita.**
  - Não transformar violação de chave estrangeira em `DUPLICATE_RESOURCE`.
  - Retornar conflito semântico, por exemplo `INGREDIENT_IN_USE`, com HTTP `409`.
  - Preservar o tratamento separado para nomes duplicados.
  - Cobrir o cenário com teste de integração.

## P1 — Testes automatizados pendentes

### Backend

- [ ] Cobrir payload inválido de receita.
- [ ] Cobrir listas vazias e listas acima do limite de 100 itens.
- [ ] Cobrir ingrediente inexistente em uma receita.
- [ ] Cobrir nome duplicado de receita.
- [ ] Cobrir limites numéricos e textuais.
- [ ] Cobrir exclusão de ingrediente referenciado por receita.
- [ ] Cobrir comportamento concorrente relevante para nomes únicos.
- [ ] Adicionar teste contra regressão de N+1 e consultas excessivas.

### Frontend

- [ ] Testar `IngredientsPage` nos estados de carregamento, vazio, sucesso e erro.
- [ ] Testar abertura, criação e edição pela página.
- [ ] Testar confirmação e exclusão de ingrediente.
- [ ] Testar conflito ao excluir ingrediente em uso.
- [ ] Testar invalidação e atualização do cache do TanStack Query.
- [ ] Testar edição e combinações opcionais do `IngredientForm`.
- [ ] Testar resposta `204`, erro não JSON e falha de rede no cliente HTTP.

## P2 — Funcionalidades do produto

- [ ] **Criar o frontend completo de receitas por TDD.**
  - Listagem, estado vazio e tratamento de erro.
  - Cadastro e edição.
  - Seleção de múltiplos ingredientes, quantidades e unidades.
  - Inclusão, remoção e ordenação dos passos.
  - Exclusão com confirmação.
- [ ] Implementar planejamento semanal persistente.
- [ ] Implementar geração e gerenciamento da lista de compras.
- [ ] Implementar controle da despensa.
- [ ] Atualizar `README.md` e `docs/API.md` conforme cada entrega.

## P2 — Manutenibilidade

- [ ] **Reduzir a complexidade do formulário de ingredientes.**
  - Extrair transformação de payload para função testável.
  - Avaliar componentes menores para nutrição e sazonalidade.
  - Manter estado e regras de negócio fora do JSX quando possível.
- [x] Configurar verificação automatizada de vulnerabilidades das dependências do backend.
- [x] Definir CI para testes, lint, formatação, build e verificações de segurança.

## Já concluído

- [x] API CRUD de ingredientes com validação, nutrição e sazonalidade.
- [x] API CRUD de receitas com ingredientes, quantidades e passos ordenados.
- [x] Migrações Flyway e integridade referencial inicial.
- [x] Cliente HTTP tipado do frontend.
- [x] Página e formulário de ingredientes responsivos.
- [x] Testes atuais do backend e frontend verdes.
- [x] Build, lint, formatação, Compose e auditoria npm aprovados.
- [x] Fluxo HTTP real de ingredientes e receitas validado.
- [x] Diretrizes de engenharia para agentes registradas em `AGENTS.md`.
- [x] Stack Docker local com PostgreSQL, backend, frontend, healthchecks e proxy Nginx validado.

## Critério para liberar em produção

A aplicação só deve ser considerada pronta para produção quando:

- [ ] todos os itens P0 estiverem concluídos;
- [ ] N+1, paginação e limites de consumo estiverem resolvidos;
- [ ] todos os testes P1 estiverem implementados e verdes;
- [ ] frontend e backend funcionarem juntos no ambiente de destino;
- [ ] migração, backup, observabilidade e recuperação estiverem documentados;
- [ ] não houver vulnerabilidade conhecida de severidade alta ou crítica;
- [ ] a revisão final OWASP e os gates completos forem aprovados.

# GitHub Copilot — instruções do repositório

Leia e siga integralmente o arquivo [`AGENTS.md`](../AGENTS.md) antes de sugerir ou alterar código. Ele é a fonte canônica das regras do projeto.

Ao gerar código ou revisão:

- inclua testes automatizados úteis para todo comportamento novo ou alterado, salvo exceção técnica justificável;
- recomende e execute, quando houver ferramenta disponível, os testes afetados depois de cada mudança coerente e todas as suítes antes da conclusão;
- aplique OWASP Top 10, OWASP ASVS e OWASP API Security Top 10;
- valide todas as entradas no backend e não exponha dados internos ou segredos;
- considere Big O, consultas N+1, paginação, limites, índices e uso de memória;
- mantenha funções, classes e componentes coesos, pequenos e de leitura linear;
- não enfraqueça testes ou controles de segurança para fazer o build passar;
- atualize a documentação quando contratos, configuração ou comportamento mudarem.

Em caso de divergência, `AGENTS.md` prevalece.

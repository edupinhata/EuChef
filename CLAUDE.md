# CLAUDE.md

Antes de analisar ou modificar este repositório, leia e siga integralmente [`AGENTS.md`](AGENTS.md), que é a fonte canônica das diretrizes de engenharia do projeto.

Regras inegociáveis:

- comportamento novo ou alterado exige teste automatizado útil, salvo exceção técnica justificada;
- execute os testes afetados após cada mudança coerente e as suítes completas antes de concluir;
- aplique OWASP Top 10, OWASP ASVS e OWASP API Security Top 10 conforme o risco;
- avalie complexidade computacional, consultas, memória e complexidade cognitiva/estrutural;
- nunca afirme que testes ou builds passaram sem execução real.

Em caso de divergência, `AGENTS.md` prevalece sobre este resumo.

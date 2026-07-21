export function RecipesPage() {
  return (
    <section className="page" aria-labelledby="recipes-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Acervo</p>
          <h1 id="recipes-title">Suas receitas</h1>
          <p className="page-description">
            Os pratos que você gosta de preparar ficarão reunidos aqui.
          </p>
        </div>
      </div>

      <div className="empty-state">
        <span className="line-icon" aria-hidden="true">
          +
        </span>
        <div>
          <h2>O livro ainda está em branco</h2>
          <p>
            O cadastro completo de receitas será construído na próxima etapa.
          </p>
        </div>
        <button className="secondary-button" type="button" disabled>
          Adicionar receita
        </button>
        <small>Disponível na próxima etapa</small>
      </div>
    </section>
  );
}

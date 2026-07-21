export function ShoppingListPage() {
  return (
    <section className="page" aria-labelledby="shopping-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Mercado</p>
          <h1 id="shopping-title">Lista de compras</h1>
          <p className="page-description">
            Os ingredientes das receitas da semana serão consolidados aqui.
          </p>
        </div>
      </div>

      <div className="empty-state">
        <span className="line-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2>Nada para comprar ainda</h2>
          <p>
            Quando houver receitas planejadas, a lista será criada sem duplicar
            ingredientes.
          </p>
        </div>
      </div>
    </section>
  );
}

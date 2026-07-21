export function PantryPage() {
  return (
    <section className="page" aria-labelledby="pantry-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Em casa</p>
          <h1 id="pantry-title">Despensa</h1>
          <p className="page-description">
            Registre o que já possui para comprar apenas o necessário.
          </p>
        </div>
      </div>

      <div className="empty-state">
        <span className="line-icon" aria-hidden="true">
          □
        </span>
        <div>
          <h2>Despensa sem itens registrados</h2>
          <p>
            O controle simplificado de estoque entrará depois do cadastro de
            receitas.
          </p>
        </div>
      </div>
    </section>
  );
}

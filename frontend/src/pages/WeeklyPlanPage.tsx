import { useNavigate } from "react-router-dom";

function currentWeekLabel() {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${format.format(monday)} — ${format.format(sunday)}`;
}

export function WeeklyPlanPage() {
  const navigate = useNavigate();

  return (
    <section className="page" aria-labelledby="week-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h1 id="week-title">Minha semana</h1>
          <p className="date-range">{currentWeekLabel()}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Escolher outra semana"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="empty-state empty-state--primary">
        <div className="empty-illustration" aria-hidden="true">
          <span className="plate" />
          <span className="fork">|||</span>
        </div>
        <div>
          <h2>Nenhuma receita planejada</h2>
          <p>
            Escolha os pratos da semana para reunir tudo o que será preparado.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate("/receitas")}
        >
          Escolher receitas
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <aside className="next-step" aria-label="Próxima etapa do produto">
        <span className="next-step-number">01</span>
        <div>
          <strong>Primeiro, monte seu acervo</strong>
          <p>
            Na próxima etapa você poderá cadastrar ingredientes, porções e modo
            de preparo.
          </p>
        </div>
      </aside>
    </section>
  );
}

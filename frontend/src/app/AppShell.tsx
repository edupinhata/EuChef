import { NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";

const navigation = [
  { to: "/semana/atual", label: "Semana", icon: <CalendarIcon /> },
  { to: "/receitas", label: "Receitas", icon: <BookIcon /> },
  { to: "/ingredientes", label: "Ingredientes", icon: <IngredientIcon /> },
  { to: "/compras", label: "Compras", icon: <BasketIcon /> },
  { to: "/despensa", label: "Despensa", icon: <PantryIcon /> },
];

export function AppShell() {
  return (
    <div className="app-frame">
      <header className="app-header">
        <a className="brand" href="/semana/atual" aria-label="Mesa da Semana">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>Mesa da Semana</span>
        </a>
        <span className="foundation-badge">Fundação</span>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item--active" : ""}`
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <path d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
      <path d="M8 12h3v3H8z" />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
    </Icon>
  );
}

function IngredientIcon() {
  return (
    <Icon>
      <path d="M12 21c-4-3-6-7-5-11 4 0 7 2 8 6M12 21c0-7 2-12 7-16" />
      <path d="M14 10c1-3 3-5 6-6 0 4-2 7-5 8" />
    </Icon>
  );
}

function BasketIcon() {
  return (
    <Icon>
      <path d="m7 10 3-6M17 10l-3-6M4 10h16l-1.5 10h-13L4 10Z" />
      <path d="M9 13v4M15 13v4" />
    </Icon>
  );
}

function PantryIcon() {
  return (
    <Icon>
      <path d="M5 3h14v18H5zM8 7h8M8 12h8M8 17h8" />
      <path d="M16 8v2M16 13v2" />
    </Icon>
  );
}

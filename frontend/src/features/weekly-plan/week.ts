export function currentWeekStart() {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  return toIsoDate(monday);
}

export function weekLabel(weekStart: string) {
  const monday = new Date(`${weekStart}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${format.format(monday)} — ${format.format(sunday)}`;
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidWeekStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    toIsoDate(date) === value &&
    date.getDay() === 1
  );
}

export function shiftWeek(weekStart: string, days: number) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

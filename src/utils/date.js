export const todayISO = () => new Date().toISOString().slice(0, 10);

const pad = (value) => String(value).padStart(2, "0");

export const toISODate = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(date);
};

export const getMonthGrid = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const start = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);

    return {
      iso: toISODate(current),
      day: current.getDate(),
      isCurrentMonth: current.getMonth() === month
    };
  });
};

export const getWeekWindow = (dateStr) => {
  const base = new Date(`${dateStr}T00:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toISODate(day);
  });
};

export const getRecentMonths = (months = 4, anchor = new Date()) => {
  const list = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const target = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const year = target.getFullYear();
    const month = pad(target.getMonth() + 1);
    list.push(`${year}-${month}`);
  }
  return list;
};

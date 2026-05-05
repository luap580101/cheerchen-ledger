import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDisplayDate, getMonthGrid } from "../utils/date";

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

export default function CalendarView({ transactions, selectedDate, onSelectDate }) {
  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const daySummary = useMemo(() => {
    const map = new Map();

    for (const record of transactions) {
      const prev = map.get(record.date) || { income: 0, expense: 0, count: 0 };
      map.set(record.date, {
        income: prev.income + (record.type === "income" ? Number(record.amount) : 0),
        expense: prev.expense + (record.type === "expense" ? Number(record.amount) : 0),
        count: prev.count + 1
      });
    }

    return map;
  }, [transactions]);

  const cells = useMemo(() => getMonthGrid(viewDate), [viewDate]);

  const selectedDetails = useMemo(() => {
    return transactions
      .filter((item) => item.date === selectedDate)
      .slice()
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [selectedDate, transactions]);

  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
          }
          className="rounded-xl border border-slate-200 p-2 text-slate-700"
          aria-label="上個月"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-slate-900">
          {viewDate.getFullYear()} 年 {viewDate.getMonth() + 1} 月
        </h2>
        <button
          type="button"
          onClick={() =>
            setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
          }
          className="rounded-xl border border-slate-200 p-2 text-slate-700"
          aria-label="下個月"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {weekLabels.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const summary = daySummary.get(cell.iso);
          const balance = (summary?.income || 0) - (summary?.expense || 0);
          const active = selectedDate === cell.iso;

          return (
            <button
              type="button"
              key={cell.iso}
              onClick={() => onSelectDate(cell.iso)}
              className={`min-h-16 rounded-xl border p-1 text-left transition ${
                active
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : cell.isCurrentMonth
                    ? "border-slate-200 bg-white"
                    : "border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              <div className="text-xs font-bold">{cell.day}</div>
              {summary && (
                <div className={`mt-1 text-[10px] font-semibold ${active ? "text-white" : "text-slate-700"}`}>
                  {balance >= 0 ? "+" : ""}
                  {balance}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="text-base font-bold text-slate-900">{formatDisplayDate(selectedDate)} 明細</h3>
        <ul className="mt-2 space-y-2">
          {selectedDetails.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">
              這天尚無記錄
            </li>
          )}
          {selectedDetails.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="font-semibold text-slate-900">{item.item}</p>
                <p className="text-xs text-slate-500">
                  {item.type === "expense" ? "支出" : "收入"}
                  {item.type === "expense" ? ` / ${item.paymentMethod === "card" ? "刷卡" : "現金"}` : ""}
                </p>
              </div>
              <p
                className={`text-lg font-bold ${
                  item.type === "expense" ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {item.type === "expense" ? "-" : "+"}
                {Number(item.amount)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

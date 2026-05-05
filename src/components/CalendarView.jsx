import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDisplayDate, getMonthGrid } from "../utils/date";

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

export default function CalendarView({
  transactions,
  selectedDate,
  onSelectDate,
  onDeleteTransaction,
  deletingId
}) {
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
    <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur dark:bg-slate-900/90">
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
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

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
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
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                      : "border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950"
              }`}
            >
              <div className="text-xs font-bold">{cell.day}</div>
              {summary && (
                <div className={`mt-1 text-[10px] font-semibold ${active ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                  {balance >= 0 ? "+" : ""}
                  {balance}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{formatDisplayDate(selectedDate)} 明細</h3>
        <ul className="mt-2 space-y-2">
          {selectedDetails.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              這天尚無記錄
            </li>
          )}
          {selectedDetails.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950/30">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.item}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.type === "expense" ? "支出" : "收入"}
                  {item.type === "expense" ? ` / ${item.paymentMethod === "card" ? "刷卡" : "現金"}` : ""}
                </p>
              </div>
              <div className="ml-3 flex items-center gap-3">
                <p
                  className={`text-lg font-bold ${
                    item.type === "expense" ? "text-rose-600" : "text-emerald-700"
                  }`}
                >
                  {item.type === "expense" ? "-" : "+"}
                  {Number(item.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => onDeleteTransaction?.(item)}
                  disabled={deletingId === item.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="刪除記錄"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

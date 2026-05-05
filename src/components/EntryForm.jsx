import { ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { todayISO } from "../utils/date";

const typeOptions = [
  { value: "expense", label: "支出", icon: ArrowDownCircle },
  { value: "income", label: "收入", icon: ArrowUpCircle }
];

const payOptions = [
  { value: "cash", label: "現金", icon: Wallet },
  { value: "card", label: "刷卡", icon: CreditCard }
];

export default function EntryForm({ onSubmit, submitting }) {
  const [form, setForm] = useState({
    type: "expense",
    paymentMethod: "cash",
    amount: "",
    item: ""
  });

  const canSubmit = useMemo(() => {
    return Number(form.amount) > 0 && form.item.trim().length > 0;
  }, [form.amount, form.item]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }

    onSubmit({ ...form, date: todayISO() });
    setForm((prev) => ({
      ...prev,
      amount: "",
      item: ""
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur dark:bg-slate-900/90">
      <div className="grid grid-cols-2 gap-3">
        {typeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => update("type", value)}
            className={`flex h-14 items-center justify-center gap-2 rounded-2xl border text-lg font-semibold transition ${
              form.type === value
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {form.type === "expense" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {payOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => update("paymentMethod", value)}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl border font-semibold transition ${
                form.paymentMethod === value
                  ? "border-orange-500 bg-orange-500 text-white"
                    : "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">金額</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
            placeholder="例如 380"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xl font-semibold outline-none ring-emerald-200 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">項目</span>
          <input
            type="text"
            value={form.item}
            onChange={(event) => update("item", event.target.value)}
            placeholder="午餐 / 交通 / 薪資..."
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none ring-emerald-200 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

      </div>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-4 h-14 w-full rounded-2xl bg-slate-900 text-lg font-bold text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {submitting ? "同步中..." : "新增記錄"}
      </button>
    </form>
  );
}

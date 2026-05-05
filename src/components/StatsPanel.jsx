import { useMemo } from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getRecentMonths, getWeekWindow } from "../utils/date";

export default function StatsPanel({ transactions, selectedDate, monthlyBudget, onMonthlyBudgetChange }) {
  const weekly = useMemo(() => {
    const week = getWeekWindow(selectedDate);
    return week.map((day) => {
      let income = 0;
      let expense = 0;
      for (const tx of transactions) {
        if (tx.date !== day) {
          continue;
        }
        if (tx.type === "income") {
          income += Number(tx.amount);
        } else {
          expense += Number(tx.amount);
        }
      }
      return {
        day: day.slice(5),
        income,
        expense,
        balance: income - expense
      };
    });
  }, [selectedDate, transactions]);

  const monthly = useMemo(() => {
    const keys = getRecentMonths(4);
    const base = keys.map((month) => ({ month: month.slice(2), income: 0, expense: 0, balance: 0 }));
    const index = new Map(base.map((item, i) => [item.month, i]));

    for (const tx of transactions) {
      const key = tx.date.slice(2, 7);
      const idx = index.get(key);
      if (idx === undefined) {
        continue;
      }
      if (tx.type === "income") {
        base[idx].income += Number(tx.amount);
      } else {
        base[idx].expense += Number(tx.amount);
      }
      base[idx].balance = base[idx].income - base[idx].expense;
    }

    return base;
  }, [transactions]);

  const weekIncome = weekly.reduce((sum, item) => sum + item.income, 0);
  const weekExpense = weekly.reduce((sum, item) => sum + item.expense, 0);

  const budgetInfo = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const day = Math.min(date.getDate(), daysInMonth);
    const timeProgress = day / daysInMonth;

    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === "expense" && tx.date.startsWith(monthKey)) {
        expense += Number(tx.amount);
      }
    }

    const limit = Number(monthlyBudget) || 0;
    const expenseProgress = limit > 0 ? Math.min(expense / limit, 1) : 0;
    const isWarning = limit > 0 && expenseProgress - timeProgress > 0.2;
    const isDanger = limit > 0 && expenseProgress >= 1;

    const tone = isDanger
      ? "rose"
      : isWarning
        ? "amber"
        : "emerald";

    return {
      expense,
      limit,
      tone,
      isWarning: isWarning || isDanger,
      timePercent: Math.round(timeProgress * 100),
      expensePercent: Math.round(expenseProgress * 100)
    };
  }, [monthlyBudget, selectedDate, transactions]);

  const barColor =
    budgetInfo.tone === "rose"
      ? "#e11d48"
      : budgetInfo.tone === "amber"
        ? "#f59e0b"
        : "#10b981";

  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur dark:bg-slate-900/90">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">每月支出上限</p>
          <input
            type="number"
            min="0"
            value={monthlyBudget}
            onChange={(event) => onMonthlyBudgetChange(event.target.value)}
            className="h-10 w-36 rounded-xl border border-slate-300 bg-white px-3 text-right text-sm font-semibold outline-none ring-emerald-200 focus:ring dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="輸入預算"
          />
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${budgetInfo.expensePercent}%` }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <p>支出 {budgetInfo.expensePercent}% / 時間 {budgetInfo.timePercent}%</p>
          <p>
            {budgetInfo.expense} / {budgetInfo.limit || "未設定"}
          </p>
        </div>

        {budgetInfo.isWarning && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <TriangleAlert size={14} />
            支出進度超前時間進度，請留意本月花費。
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/30">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">本週收入</p>
          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{weekIncome}</p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-900/25">
          <p className="text-xs text-rose-700 dark:text-rose-300">本週支出</p>
          <p className="text-lg font-bold text-rose-800 dark:text-rose-200">{weekExpense}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-700 dark:text-slate-300">本週結餘</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{weekIncome - weekExpense}</p>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis width={38} />
            <Tooltip />
            <Legend />
            <Bar dataKey="income" fill="#1f7a4c" name="收入" radius={[8, 8, 0, 0]} />
            <Bar dataKey="expense" fill="#f43f5e" name="支出" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">近 4 個月趨勢</h3>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis width={38} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#1f7a4c" strokeWidth={2.5} name="收入" />
            <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.5} name="支出" />
            <Line type="monotone" dataKey="balance" stroke="#0f172a" strokeWidth={2.5} name="結餘" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

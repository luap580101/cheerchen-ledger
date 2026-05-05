import { useMemo } from "react";
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

export default function StatsPanel({ transactions, selectedDate }) {
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

  return (
    <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur">
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">本週收入</p>
          <p className="text-lg font-bold text-emerald-800">{weekIncome}</p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-3">
          <p className="text-xs text-rose-700">本週支出</p>
          <p className="text-lg font-bold text-rose-800">{weekExpense}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-xs text-slate-700">本週結餘</p>
          <p className="text-lg font-bold text-slate-900">{weekIncome - weekExpense}</p>
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

      <h3 className="mt-3 text-sm font-semibold text-slate-700">近 4 個月趨勢</h3>
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

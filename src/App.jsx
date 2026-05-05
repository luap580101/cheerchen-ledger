import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import CalendarView from "./components/CalendarView";
import EntryForm from "./components/EntryForm";
import {
  setSelectedDate,
  setSyncStatus,
  setTransactions
} from "./features/ledger/ledgerSlice";

const StatsPanel = lazy(() => import("./components/StatsPanel"));
const GUEST_TRANSACTIONS_KEY = "cheerchen_guest_transactions";

const loadGuestTransactions = () => {
  try {
    const raw = localStorage.getItem(GUEST_TRANSACTIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveGuestTransactions = (items) => {
  localStorage.setItem(GUEST_TRANSACTIONS_KEY, JSON.stringify(items));
};

export default function App() {
  const dispatch = useDispatch();
  const [deletingId, setDeletingId] = useState("");

  const { transactions, selectedDate, error } = useSelector(
    (state) => state.ledger
  );

  useEffect(() => {
    const records = loadGuestTransactions();
    dispatch(setTransactions(records));
    dispatch(setSyncStatus("local"));
  }, [dispatch]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [transactions]);

  const handleAdd = (form) => {
    const entry = {
      id: `local-${Date.now()}`,
      ...form,
      amount: Number(form.amount),
      createdAtMs: Date.now(),
      uid: "local"
    };
    const next = [entry, ...transactions];
    saveGuestTransactions(next);
    dispatch(setTransactions(next));
    dispatch(setSyncStatus("local"));
  };

  const handleDelete = async (entry) => {
    if (!entry?.id) {
      return;
    }

    const confirmed = window.confirm(`刪除「${entry.item}」這筆記錄？`);
    if (!confirmed) {
      return;
    }

    setDeletingId(entry.id);
    const next = transactions.filter((tx) => tx.id !== entry.id);
    saveGuestTransactions(next);
    dispatch(setTransactions(next));
    dispatch(setSyncStatus("local"));
    setDeletingId("");
  };

  return (
    <main className="min-h-dvh bg-app px-3 pb-20 pt-4 font-body text-slate-900">
      <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="rounded-3xl bg-emerald-900/90 p-4 text-white shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">CheerChen Ledger</p>
          <h1 className="mt-1 text-2xl font-black">個人記帳 PWA</h1>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <CloudOff size={16} className="text-yellow-300" />
            <span>本機模式（無需登入）</span>
          </div>
          {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
        </header>

        <EntryForm onSubmit={handleAdd} submitting={false} />

        <CalendarView
          transactions={sortedTransactions}
          selectedDate={selectedDate}
          onSelectDate={(date) => dispatch(setSelectedDate(date))}
          onDeleteTransaction={handleDelete}
          deletingId={deletingId}
        />

        <Suspense
          fallback={
            <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur">
              <p className="text-sm text-slate-500">統計載入中...</p>
            </section>
          }
        >
          <StatsPanel transactions={sortedTransactions} selectedDate={selectedDate} />
        </Suspense>
      </div>
    </main>
  );
}

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { Moon, Settings2, Sun } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState, useTransition } from "react";
import { useDispatch, useSelector } from "react-redux";
import CalendarView from "./components/CalendarView";
import EntryForm from "./components/EntryForm";
import SyncIndicator from "./components/SyncIndicator";
import { setSelectedDate, setSyncStatus, setTransactions } from "./features/ledger/ledgerSlice";
import { auth, db, firebaseConfigIssues } from "./firebase";

const BUDGET_KEY = "cheerchen_monthly_budget";
const THEME_MODE_KEY = "cheerchen_theme_mode";
const LOCAL_TX_KEY = "cheerchen_local_transactions";
const StatsPanel = lazy(() => import("./components/StatsPanel"));

const recurringTemplates = [
  { key: "rent", item: "房租", amount: 18000, paymentMethod: "cash" },
  { key: "music", item: "音樂訂閱", amount: 149, paymentMethod: "card" }
];

const getFourMonthAgoISO = () => {
  const base = new Date();
  base.setMonth(base.getMonth() - 4);
  return base.toISOString().slice(0, 10);
};

const getDefaultThemeMode = () => {
  const saved = localStorage.getItem(THEME_MODE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
};

const resolveTheme = (mode) => {
  if (mode !== "system") {
    return mode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const loadLocalTransactions = () => {
  try {
    const raw = localStorage.getItem(LOCAL_TX_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalTransactions = (items) => {
  localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(items));
};

export default function App() {
  const dispatch = useDispatch();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState("");
  const [uid, setUid] = useState("");
  const [themeMode, setThemeMode] = useState(() => getDefaultThemeMode());
  const [monthlyBudget, setMonthlyBudget] = useState(() => localStorage.getItem(BUDGET_KEY) || "30000");
  const [setupError, setSetupError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localMode, setLocalMode] = useState(false);

  const { transactions, selectedDate, syncStatus, error } = useSelector((state) => state.ledger);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(themeMode);
    root.classList.toggle("dark", resolved === "dark");
    localStorage.setItem(THEME_MODE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, monthlyBudget);
  }, [monthlyBudget]);

  useEffect(() => {
    if (!auth || !db) {
      setSetupError("Firebase 尚未初始化，請檢查環境變數設定。");
      setLocalMode(true);
      const records = loadLocalTransactions();
      dispatch(setTransactions(records));
      dispatch(setSyncStatus("local"));
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        return;
      }

      signInAnonymously(auth)
        .then((credential) => {
          setUid(credential.user.uid);
        })
        .catch((signInError) => {
          if (signInError.code === "auth/configuration-not-found") {
            setLocalMode(true);
            const records = loadLocalTransactions();
            dispatch(setTransactions(records));
            dispatch(setSyncStatus("local"));
            setSetupError("Firebase 尚未啟用 Anonymous Auth，已切換本機模式。");
            return;
          }

          setSetupError(signInError.message || "匿名登入失敗");
          dispatch(setSyncStatus("failed"));
        });
    });

    return () => unsub();
  }, [dispatch]);

  useEffect(() => {
    if (localMode || !db || !uid) {
      return;
    }

    dispatch(setSyncStatus("syncing"));
    const source = query(
      collection(db, "transactions"),
      where("uid", "==", uid),
      where("date", ">=", getFourMonthAgoISO()),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(
      source,
      { includeMetadataChanges: true },
      (snapshot) => {
        const next = snapshot.docs.map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            ...data,
            amount: Number(data.amount),
            createdAtMs: data.createdAt?.toMillis?.() || 0
          };
        });

        startTransition(() => {
          dispatch(setTransactions(next));
          dispatch(setSyncStatus(snapshot.metadata.fromCache ? "offline" : "synced"));
        });
      },
      (syncError) => {
        dispatch(setSyncStatus("failed"));
        setSetupError(syncError.message || "同步失敗");
      }
    );

    return () => unsubscribe();
  }, [dispatch, localMode, startTransition, uid]);

  useEffect(() => {
    if (localMode || !db || !uid) {
      return;
    }

    const now = new Date();
    if (now.getDate() < 10) {
      return;
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const recurringDate = `${year}-${month}-10`;

    const run = async () => {
      for (const item of recurringTemplates) {
        const recurringId = `recurring_${item.key}_${year}_${month}`;
        const recurringRef = doc(db, "transactions", recurringId);
        const existing = await getDoc(recurringRef);
        if (existing.exists()) {
          continue;
        }

        await setDoc(recurringRef, {
          uid,
          type: "expense",
          item: `[自動] ${item.item}`,
          amount: item.amount,
          paymentMethod: item.paymentMethod,
          date: recurringDate,
          recurring: true,
          recurringKey: item.key,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    };

    run().catch((autoError) => {
      console.warn("Recurring expense sync failed", autoError);
    });
  }, [localMode, uid]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [transactions]);

  const handleAdd = (form) => {
    if (localMode || !db || !uid) {
      const localItem = {
        id: `local_${Date.now()}`,
        ...form,
        amount: Number(form.amount),
        createdAtMs: Date.now(),
        recurring: false,
        uid: "local"
      };
      const next = [localItem, ...transactions];
      saveLocalTransactions(next);
      dispatch(setTransactions(next));
      dispatch(setSyncStatus("local"));
      return;
    }

    const nextId = `manual_${Date.now()}`;
    const nextRef = doc(db, "transactions", nextId);
    setDoc(nextRef, {
      ...form,
      uid,
      amount: Number(form.amount),
      recurring: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch((writeError) => {
      setSetupError(writeError.message || "新增記錄失敗");
      dispatch(setSyncStatus("failed"));
    });
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
    if (localMode || !db || entry.uid === "local") {
      const next = transactions.filter((tx) => tx.id !== entry.id);
      saveLocalTransactions(next);
      dispatch(setTransactions(next));
      dispatch(setSyncStatus("local"));
      setDeletingId("");
      return;
    }

    deleteDoc(doc(db, "transactions", entry.id))
      .catch((deleteError) => {
        setSetupError(deleteError.message || "刪除失敗");
        dispatch(setSyncStatus("failed"));
      })
      .finally(() => {
        setDeletingId("");
      });
  };

  return (
    <main className="min-h-dvh bg-app px-3 pb-20 pt-4 font-body text-slate-900 dark:bg-black dark:text-slate-100">
      <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="rounded-3xl bg-emerald-900/90 p-4 text-white shadow-card dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">CheerChen Ledger</p>
          <h1 className="mt-1 text-2xl font-black">個人記帳 PWA</h1>

          <div className="mt-3 flex items-center justify-between">
            <SyncIndicator status={syncStatus} />
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-black/15 px-3 py-1.5 text-xs"
            >
              <Settings2 size={14} />
              設定
            </button>
          </div>

          {settingsOpen && (
            <div className="mt-3 rounded-2xl border border-white/15 bg-black/20 p-3 text-sm">
              <p className="mb-2 font-semibold">外觀主題</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode("light")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${
                    themeMode === "light" ? "bg-white text-slate-900" : "bg-white/10"
                  }`}
                >
                  <Sun size={14} />
                  淺色
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode("dark")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${
                    themeMode === "dark" ? "bg-white text-slate-900" : "bg-white/10"
                  }`}
                >
                  <Moon size={14} />
                  深色
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode("system")}
                  className={`rounded-lg px-3 py-1.5 ${themeMode === "system" ? "bg-white text-slate-900" : "bg-white/10"}`}
                >
                  跟隨系統
                </button>
              </div>
            </div>
          )}

          {firebaseConfigIssues.length > 0 && (
            <p className="mt-2 text-xs text-amber-200">
              缺少 Firebase 設定：{firebaseConfigIssues.join(" / ")}
            </p>
          )}
          {isPending && <p className="mt-2 text-xs text-emerald-100">同步更新中...</p>}
          {setupError && <p className="mt-2 text-xs text-amber-200">{setupError}</p>}
          {localMode && <p className="mt-2 text-xs text-slate-200">目前為本機模式，資料儲存在此裝置。</p>}
          {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
        </header>

        <EntryForm onSubmit={handleAdd} submitting={syncStatus === "syncing" && !uid} />

        <CalendarView
          transactions={sortedTransactions}
          selectedDate={selectedDate}
          onSelectDate={(date) => dispatch(setSelectedDate(date))}
          onDeleteTransaction={handleDelete}
          deletingId={deletingId}
        />

        <Suspense
          fallback={
            <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur dark:bg-slate-900/90">
              <p className="text-sm text-slate-500 dark:text-slate-300">統計載入中...</p>
            </section>
          }
        >
          <StatsPanel
            transactions={sortedTransactions}
            selectedDate={selectedDate}
            monthlyBudget={monthlyBudget}
            onMonthlyBudgetChange={setMonthlyBudget}
          />
        </Suspense>
      </div>
    </main>
  );
}

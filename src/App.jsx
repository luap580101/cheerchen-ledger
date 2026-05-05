import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Suspense, lazy, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Cloud, CloudOff, LoaderCircle, LogIn, LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import CalendarView from "./components/CalendarView";
import EntryForm from "./components/EntryForm";
import { addTransaction, setSelectedDate, setSyncStatus, setTransactions } from "./features/ledger/ledgerSlice";
import { auth, db, firebaseConfigIssues, googleProvider } from "./firebase";

const StatsPanel = lazy(() => import("./components/StatsPanel"));

const getFourMonthAgoISO = () => {
  const base = new Date();
  base.setMonth(base.getMonth() - 4);
  return base.toISOString().slice(0, 10);
};

export default function App() {
  const dispatch = useDispatch();
  const [isPending, startTransition] = useTransition();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [uiError, setUiError] = useState("");

  const { transactions, selectedDate, syncStatus, submitStatus, error } = useSelector(
    (state) => state.ledger
  );

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || !currentUser) {
      dispatch(setTransactions([]));
      return;
    }

    dispatch(setSyncStatus("syncing"));
    const source = query(
      collection(db, "transactions"),
      where("uid", "==", currentUser.uid),
      where("date", ">=", getFourMonthAgoISO()),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(
      source,
      { includeMetadataChanges: true },
      (snapshot) => {
        const next = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAtMs: data.createdAt?.toMillis?.() || 0
          };
        });

        // Let React prioritize touch interactions before applying large list updates.
        startTransition(() => {
          dispatch(setTransactions(next));
          dispatch(setSyncStatus(snapshot.metadata.fromCache ? "offline" : "synced"));
        });
      },
      () => {
        dispatch(setSyncStatus("failed"));
      }
    );

    return () => unsubscribe();
  }, [currentUser, dispatch]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [transactions]);

  const handleAdd = (form) => {
    if (!db || !currentUser) {
      return;
    }
    dispatch(addTransaction({ ...form, uid: currentUser.uid }));
  };

  const handleSignIn = async () => {
    if (!auth || !googleProvider) {
      setUiError("Firebase 尚未完成設定，請先確認環境變數。 ");
      return;
    }

    try {
      setUiError("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        setUiError(redirectError.code || error.code || "Google 登入失敗");
      }
    }
  };

  const handleSignOut = async () => {
    setUiError("");
    await signOut(auth);
  };

  const syncLabel =
    syncStatus === "syncing" ? "同步中" : syncStatus === "failed" ? "同步失敗" : "已同步";

  return (
    <main className="min-h-dvh bg-app px-3 pb-20 pt-4 font-body text-slate-900">
      <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="rounded-3xl bg-emerald-900/90 p-4 text-white shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">CheerChen Ledger</p>
          <h1 className="mt-1 text-2xl font-black">個人記帳 PWA</h1>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-emerald-100">
              {authLoading
                ? "登入狀態檢查中..."
                : currentUser
                  ? `已登入：${currentUser.email || currentUser.displayName || currentUser.uid}`
                  : "尚未登入"}
            </p>
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-50/10 px-3 py-2 text-xs font-semibold text-white"
              >
                <LogOut size={14} />
                登出
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-900"
              >
                <LogIn size={14} />
                Google 登入
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {isOffline || syncStatus === "offline" ? (
              <CloudOff size={16} className="text-yellow-300" />
            ) : (
              <Cloud size={16} className="text-emerald-200" />
            )}
            <span>{isOffline ? "離線模式（已啟用本地快取）" : syncLabel}</span>
            {isPending && <LoaderCircle size={16} className="animate-spin" />}
          </div>
          {firebaseConfigIssues.length > 0 && (
            <div className="mt-3 rounded-2xl border border-yellow-300/40 bg-yellow-50 p-3 text-yellow-950">
              <div className="flex items-center gap-2 text-sm font-bold">
                <AlertTriangle size={16} />
                Firebase 設定不完整
              </div>
              <p className="mt-1 text-xs">請在本機 .env.local 或 Vercel 環境變數中補齊以下欄位：</p>
              <p className="mt-1 text-xs break-all">{firebaseConfigIssues.join(" / ")}</p>
            </div>
          )}
          {uiError && <p className="mt-2 text-xs text-amber-200">{uiError}</p>}
          {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
        </header>

        {currentUser ? (
          <EntryForm onSubmit={handleAdd} submitting={submitStatus === "loading"} />
        ) : (
          <section className="rounded-3xl bg-white/90 p-4 shadow-card backdrop-blur">
            <p className="text-sm text-slate-700">請先登入 Google 帳號後再開始記帳。</p>
          </section>
        )}

        <CalendarView
          transactions={sortedTransactions}
          selectedDate={selectedDate}
          onSelectDate={(date) => dispatch(setSelectedDate(date))}
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

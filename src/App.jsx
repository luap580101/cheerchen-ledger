import {
  getRedirectResult,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { Moon, Settings2, Sun } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useDispatch, useSelector } from "react-redux";
import CalendarView from "./components/CalendarView";
import EntryForm from "./components/EntryForm";
import SyncIndicator from "./components/SyncIndicator";
import { setSelectedDate, setSyncStatus, setTransactions } from "./features/ledger/ledgerSlice";
import { auth, db, firebaseConfigIssues, googleProvider } from "./firebase";

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

const shouldFallbackToRedirect = (code = "") =>
  ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(
    code
  );

export default function App() {
  const dispatch = useDispatch();
  const [isPending, startTransition] = useTransition();
  const hasServerSnapshotRef = useRef(false);
  const [deletingId, setDeletingId] = useState("");
  const [uid, setUid] = useState("");
  const [themeMode, setThemeMode] = useState(() => getDefaultThemeMode());
  const [monthlyBudget, setMonthlyBudget] = useState(() => localStorage.getItem(BUDGET_KEY) || "30000");
  const [setupError, setSetupError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

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
        const googleInfo = user.providerData.find((p) => p.providerId === "google.com");
        setGoogleUser(googleInfo ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null);
        dispatch(setSyncStatus("syncing"));
        setSetupError("");
        return;
      }

      setUid("");
      setGoogleUser(null);
      dispatch(setTransactions([]));
      dispatch(setSyncStatus("idle"));
    });

    return () => unsub();
  }, [dispatch]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    let active = true;
    setGoogleLoading(true);

    getRedirectResult(auth)
      .then((result) => {
        if (!active) {
          return;
        }
        if (result?.user) {
          setSetupError("");
        }
      })
      .catch((redirectError) => {
        if (!active) {
          return;
        }
        console.error("Google redirect sign-in error:", redirectError.code, redirectError.message);
        setSetupError(`${redirectError.code || "未知錯誤"}：${redirectError.message || "Google 登入失敗"}`);
      })
      .finally(() => {
        if (active) {
          setGoogleLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (localMode || !db || !uid) {
      return;
    }

    hasServerSnapshotRef.current = false;
    dispatch(setSyncStatus("syncing"));
    const source = query(collection(db, "transactions"), where("uid", "==", uid));
    const cutoffDate = getFourMonthAgoISO();

    const unsubscribe = onSnapshot(
      source,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshotRef.current = true;
        }

        const next = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              ...data,
              amount: Number(data.amount),
              createdAtMs: data.createdAt?.toMillis?.() || 0
            };
          })
          .filter((entry) => entry.date >= cutoffDate);

        startTransition(() => {
          dispatch(setTransactions(next));

          if (snapshot.metadata.hasPendingWrites) {
            dispatch(setSyncStatus("syncing"));
            return;
          }

          if (!navigator.onLine) {
            dispatch(setSyncStatus("offline"));
            return;
          }

          if (!snapshot.metadata.fromCache || hasServerSnapshotRef.current) {
            dispatch(setSyncStatus("synced"));
            return;
          }

          dispatch(setSyncStatus("syncing"));
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
    if (localMode) {
      return;
    }

    const handleOffline = () => {
      dispatch(setSyncStatus("offline"));
    };

    const handleOnline = () => {
      dispatch(setSyncStatus("syncing"));
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [dispatch, localMode]);

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
    if (localMode || !db) {
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

    if (!uid) {
      setSetupError("請先使用 Google 登入，再新增記帳資料。");
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

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return;
    setGoogleLoading(true);
    setSetupError("");
    googleProvider.setCustomParameters({ prompt: "select_account" });

    try {
      const currentUser = auth.currentUser;

      if (currentUser?.isAnonymous) {
        try {
          await linkWithPopup(currentUser, googleProvider);
          return;
        } catch (linkError) {
          if (linkError.code === "auth/credential-already-in-use") {
            const credential = GoogleAuthProvider.credentialFromError(linkError);
            if (credential) {
              await signInWithCredential(auth, credential);
              return;
            }
          }

          if (shouldFallbackToRedirect(linkError.code)) {
            await linkWithRedirect(currentUser, googleProvider);
            return;
          }

          throw linkError;
        }
      }

      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (shouldFallbackToRedirect(err.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error("Google redirect fallback error:", redirectError.code, redirectError.message);
          setSetupError(`${redirectError.code || "未知錯誤"}：${redirectError.message || "Google 登入失敗"}`);
          return;
        }
      }

      console.error("Google sign-in error:", err.code, err.message);
      setSetupError(`${err.code || "未知錯誤"}：${err.message || "Google 登入失敗"}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setGoogleLoading(true);
    try {
      await signOut(auth);
      // 登出後自動回到匿名模式
    } catch (err) {
      setSetupError(err.message || "登出失敗");
    } finally {
      setGoogleLoading(false);
    }
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
            <div className="flex items-center gap-2">
              {googleUser && (
                <div className="flex items-center gap-1.5">
                  {googleUser.photoURL && (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName}
                      className="h-6 w-6 rounded-full ring-1 ring-white/30"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="max-w-[80px] truncate text-xs text-white/80">{googleUser.displayName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-black/15 px-3 py-1.5 text-xs"
              >
                <Settings2 size={14} />
                設定
              </button>
            </div>
          </div>

          {settingsOpen && (
            <div className="mt-3 rounded-2xl border border-white/15 bg-black/20 p-3 text-sm space-y-3">
              <div>
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

              {!localMode && auth && (
                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 font-semibold">帳號同步</p>
                  {uid && (
                    <p className="mb-2 text-[11px] text-white/60">
                      目前身份：{googleUser ? "Google 雲端模式" : "匿名模式（僅此瀏覽器）"} / UID: {uid}
                    </p>
                  )}
                  {googleUser ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {googleUser.photoURL && (
                          <img src={googleUser.photoURL} alt="avatar" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{googleUser.displayName}</p>
                          <p className="truncate text-xs text-white/60">{googleUser.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={googleLoading}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-50"
                      >
                        {googleLoading ? "處理中..." : "登出"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-white/60">登入 Google 帳號以跨裝置同步資料</p>
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-white/90 disabled:opacity-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {googleLoading ? "登入中..." : "使用 Google 登入"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {firebaseConfigIssues.length > 0 && (
            <p className="mt-2 text-xs text-amber-200">
              缺少 Firebase 設定：{firebaseConfigIssues.join(" / ")}
            </p>
          )}
          {isPending && <p className="mt-2 text-xs text-emerald-100">同步更新中...</p>}
          {setupError && <p className="mt-2 text-xs text-amber-200">{setupError}</p>}
          {!localMode && !uid && (
            <p className="mt-2 text-xs text-slate-200">尚未登入，請點設定中的「使用 Google 登入」以啟用跨裝置同步。</p>
          )}
          {!localMode && uid && (
            <p className="mt-2 text-xs text-slate-200">目前同步身份 UID：{uid}</p>
          )}
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

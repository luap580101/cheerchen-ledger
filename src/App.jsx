import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, where, query } from "firebase/firestore";
import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { auth, db, firebaseConfigIssues, googleProvider } from "./firebase";

const THEME_MODE_KEY = "cheerchen_theme_mode";
const APP_VERSION = __APP_COMMIT__;
const AUTH_MODE_KEY = "login";
const AUTH_MODE_REGISTER = "register";
const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const pad2 = (value) => String(value).padStart(2, "0");

const toISODate = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const getTodayISO = () => toISODate(new Date());

const shiftDate = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

const toMonthKey = (isoDate) => isoDate.slice(0, 7);

const getMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-");
  return `${year} 年 ${Number(month)} 月`;
};

const getMonthGrid = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const leadingEmpty = firstDay.getDay();
  const days = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(`${year}-${pad2(month)}-${pad2(day)}`);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
};

const toFirebaseEmail = (account) => {
  const normalized = String(account || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return "";
  }
  return normalized.includes("@") ? normalized : `${normalized}@cheerchen.local`;
};

const views = [
  { key: "home", label: "首頁", eyebrow: "Ledger Home", title: "原本首頁", description: "這裡先保留給原本記帳首頁，之後再把主要功能放回來。" },
  {
    key: "weight",
    label: "體重變化",
    eyebrow: "Weight Tracker",
    title: "每日體重記錄",
    description: "這裡先預留給體重變化頁，之後再接每日記錄、圖表與趨勢分析。"
  }
];

export default function App() {
  const [activeView, setActiveView] = useState("home");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_MODE_KEY);
    if (savedTheme === "light") {
      return false;
    }
    return true;
  });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState(AUTH_MODE_KEY);
  const [authError, setAuthError] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [weightEntries, setWeightEntries] = useState([]);
  const [weightInput, setWeightInput] = useState("");
  const [weightBusy, setWeightBusy] = useState(false);
  const [weightError, setWeightError] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [monthKey, setMonthKey] = useState(() => toMonthKey(getTodayISO()));
  const currentView = views.find((view) => view.key === activeView) || views[0];
  const hasFirebaseConfig = firebaseConfigIssues.length === 0;
  const emailActionLabel = authMode === AUTH_MODE_KEY ? "帳號密碼登入" : "建立帳號";
  const authSubtitle = useMemo(() => {
    if (authLoading) {
      return "驗證登入狀態中...";
    }
    if (user) {
      return user.email || user.displayName || "已登入";
    }
    return "使用 Google 或 Email 登入，之後再把各頁資料接上。";
  }, [authLoading, user]);
  const monthGrid = useMemo(() => getMonthGrid(monthKey), [monthKey]);
  const weightMap = useMemo(
    () => Object.fromEntries(weightEntries.map((entry) => [entry.date, entry])),
    [weightEntries]
  );
  const selectedWeight = weightMap[selectedDate]?.weight ?? "";
  const chartData = useMemo(() => {
    const points = [];
    for (let offset = -20; offset <= 20; offset += 1) {
      const date = shiftDate(selectedDate, offset);
      points.push({
        date,
        shortDate: date.slice(5),
        weight: weightMap[date] ? Number(weightMap[date].weight) : null
      });
    }
    return points;
  }, [selectedDate, weightMap]);

  useEffect(() => {
    setMonthKey(toMonthKey(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    setWeightInput(selectedWeight ? String(selectedWeight) : "");
  }, [selectedWeight, selectedDate]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem(THEME_MODE_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    getRedirectResult(auth)
      .catch((error) => {
        if (!active) {
          return;
        }
        setAuthError(error.message || "Google 登入失敗");
      })
      .finally(() => {
        if (!active) {
          return;
        }

        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser);
          setAuthLoading(false);
        });

        active = false;
        return unsubscribe;
      });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) {
        return;
      }
      setUser(nextUser);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db || !user) {
      setWeightEntries([]);
      return;
    }

    const source = query(collection(db, "weights"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      source,
      (snapshot) => {
        const next = snapshot.docs
          .map((entry) => ({
            id: entry.id,
            ...entry.data()
          }))
          .sort((left, right) => left.date.localeCompare(right.date));
        setWeightEntries(next);
        setWeightError("");
      },
      (error) => {
        setWeightError(error.message || "體重資料同步失敗");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    googleProvider.setCustomParameters({ prompt: "select_account" });

    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser|Firefox|FxiOS/i.test(ua);

      if (isSafari) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error?.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          setAuthError(redirectError.message || "Google 登入失敗");
          return;
        }
      }

      setAuthError(error.message || "Google 登入失敗");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();

    if (!auth) {
      return;
    }

    setAuthBusy(true);
    setAuthError("");

    try {
      const firebaseEmail = toFirebaseEmail(account);

      if (authMode === AUTH_MODE_KEY) {
        await signInWithEmailAndPassword(auth, firebaseEmail, password);
      } else {
        await createUserWithEmailAndPassword(auth, firebaseEmail, password);
      }
      setPassword("");
    } catch (error) {
      setAuthError(error.message || "帳號登入失敗");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) {
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error.message || "登出失敗");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveWeight = async (event) => {
    event.preventDefault();

    if (!db || !user) {
      return;
    }

    setWeightBusy(true);
    setWeightError("");

    try {
      const numericWeight = Number(weightInput);
      if (!Number.isFinite(numericWeight)) {
        throw new Error("請輸入有效的體重數字");
      }

      const weightRef = doc(db, "weights", `${user.uid}_${selectedDate}`);
      await setDoc(weightRef, {
        uid: user.uid,
        date: selectedDate,
        weight: numericWeight,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      setWeightError(error.message || "儲存體重失敗");
    } finally {
      setWeightBusy(false);
    }
  };

  const goToMonth = (offset) => {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setMonthKey(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}`);
  };

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#d9f99d,transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#e2e8f0_100%)] px-4 py-6 text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.12),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)] dark:text-slate-100">
      <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.85)]">
          <div className="bg-[linear-gradient(135deg,rgba(190,242,100,0.28),rgba(56,189,248,0.16),rgba(15,23,42,0)_72%)] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-lime-200/80">CheerChen Ledger</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black">生活儀表板</h1>
                <p className="mt-1 text-sm text-slate-300">{authSubtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={authBusy}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                    aria-label="登出"
                  >
                    <LogOut size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                  aria-label={isDarkMode ? "切換為淺色模式" : "切換為深色模式"}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Current</p>
                  <p className="mt-1 text-sm font-semibold text-lime-200">{currentView.label}</p>
                </div>
              </div>
            </div>

            <nav className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                {views.map((view) => {
                  const active = view.key === activeView;
                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => setActiveView(view.key)}
                      className={[
                        "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "bg-white text-slate-950 shadow-[0_10px_30px_-18px_rgba(255,255,255,0.9)]"
                          : "bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
                      ].join(" ")}
                    >
                      {view.label}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        </header>

        <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_18px_60px_-36px_rgba(0,0,0,0.9)]">
          {!hasFirebaseConfig ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              <p className="font-semibold">Firebase 設定缺失</p>
              <p className="mt-1">{firebaseConfigIssues.join(", ")}</p>
            </div>
          ) : authLoading ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
              驗證登入狀態中...
            </div>
          ) : !user ? (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Authentication</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">登入你的帳號</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  支援 Google 登入與帳號密碼。帳號會自動轉成 Firebase 可用格式，個人使用不用真的輸入信箱。
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authBusy}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950 dark:bg-slate-950 dark:text-white">
                  G
                </span>
                {authBusy ? "處理中..." : "使用 Google 登入"}
              </button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                Or
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-950/70">
                  <button
                    type="button"
                    onClick={() => setAuthMode(AUTH_MODE_KEY)}
                    className={[
                      "rounded-2xl px-3 py-2 text-sm font-semibold transition",
                      authMode === AUTH_MODE_KEY ? "bg-white text-slate-950 dark:bg-slate-800 dark:text-white" : "text-slate-500"
                    ].join(" ")}
                  >
                    登入
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode(AUTH_MODE_REGISTER)}
                    className={[
                      "rounded-2xl px-3 py-2 text-sm font-semibold transition",
                      authMode === AUTH_MODE_REGISTER ? "bg-white text-slate-950 dark:bg-slate-800 dark:text-white" : "text-slate-500"
                    ].join(" ")}
                  >
                    註冊
                  </button>
                </div>

                <form className="space-y-3" onSubmit={handleEmailAuth}>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">帳號</span>
                    <input
                      type="text"
                      value={account}
                      onChange={(event) => setAccount(event.target.value)}
                      placeholder="例如 paul"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-lime-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      autoComplete="username"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">密碼</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="輸入密碼"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-lime-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      autoComplete={authMode === AUTH_MODE_KEY ? "current-password" : "new-password"}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full rounded-2xl bg-lime-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authBusy ? "處理中..." : emailActionLabel}
                  </button>
                </form>
              </div>

              {authError && (
                <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{currentView.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">{currentView.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{currentView.description}</p>

              {activeView === "home" ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                  首頁內容暫時保留空白，之後可以把原本記帳主畫面接回來。
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        上月
                      </button>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Calendar</p>
                        <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">{getMonthLabel(monthKey)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        下月
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {DAY_LABELS.map((label) => (
                        <div key={label} className="py-2">
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {monthGrid.map((date, index) => {
                        if (!date) {
                          return <div key={`empty_${index}`} className="aspect-square rounded-2xl bg-transparent" />;
                        }

                        const entry = weightMap[date];
                        const selected = date === selectedDate;
                        const isToday = date === getTodayISO();

                        return (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setSelectedDate(date)}
                            className={[
                              "aspect-square rounded-2xl border p-2 text-left transition",
                              selected
                                ? "border-lime-400 bg-lime-300 text-slate-950 shadow-[0_14px_30px_-18px_rgba(163,230,53,0.9)]"
                                : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900",
                              isToday && !selected ? "ring-1 ring-sky-400/70" : ""
                            ].join(" ")}
                          >
                            <div className="text-sm font-bold">{date.slice(-2)}</div>
                            <div className="mt-2 text-[11px] leading-4 opacity-80">{entry ? `${entry.weight} kg` : "-"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleSaveWeight} className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Selected Day</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-50">{selectedDate}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">輸入當天體重，會直接同步到 Firestore。</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={weightInput}
                        onChange={(event) => setWeightInput(event.target.value)}
                        placeholder="例如 68.4"
                        className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold outline-none ring-lime-300 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={weightBusy}
                        className="rounded-2xl bg-lime-300 px-5 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {weightBusy ? "儲存中" : "儲存"}
                      </button>
                    </div>
                  </form>

                  <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Weight Trend</p>
                        <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">前後 20 天折線圖</p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">中心日期：{selectedDate}</p>
                    </div>

                    <div className="mt-4 h-64 w-full">
                      <ResponsiveContainer>
                        <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                          <XAxis dataKey="shortDate" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 16,
                              border: "1px solid rgba(148,163,184,0.2)",
                              backgroundColor: "rgba(15,23,42,0.92)",
                              color: "#f8fafc"
                            }}
                            formatter={(value) => [`${value} kg`, "體重"]}
                            labelFormatter={(value, payload) => payload?.[0]?.payload?.date || value}
                          />
                          <Line type="monotone" dataKey="weight" stroke="#84cc16" strokeWidth={3} dot={{ r: 3, fill: "#bef264" }} connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                <p className="font-semibold">目前登入中</p>
                <p className="mt-1">{user.displayName || user.email || "未命名使用者"}</p>
                <p className="mt-1 text-xs">UID: {user.uid}</p>
              </div>

              {authError && (
                <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  {authError}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-white/10 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-slate-300 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-200">
        v{APP_VERSION}
      </div>
    </main>
  );
}

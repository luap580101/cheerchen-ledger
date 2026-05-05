import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import packageJson from "../package.json";
import { auth, firebaseConfigIssues, googleProvider } from "./firebase";

const THEME_MODE_KEY = "cheerchen_theme_mode";
const APP_VERSION = packageJson.version;
const AUTH_MODE_KEY = "login";
const AUTH_MODE_REGISTER = "register";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (authMode === AUTH_MODE_KEY) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
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
                  支援 Google 登入與 Email/Password。這一版先把認證打通，登入後才顯示首頁與體重變化頁籤。
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
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-lime-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">密碼</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 6 碼"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-lime-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      autoComplete={authMode === AUTH_MODE_KEY ? "current-password" : "new-password"}
                      minLength={6}
                      required
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

              <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                {activeView === "home"
                  ? "首頁內容暫時保留空白，之後可以把原本記帳主畫面接回來。"
                  : "體重變化頁目前只先開入口，之後再加入每日輸入、歷史列表與圖表。"}
              </div>

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

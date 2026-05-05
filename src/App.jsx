import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { firebaseConfigIssues } from "./firebase";

const THEME_MODE_KEY = "cheerchen_theme_mode";

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
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem(THEME_MODE_KEY) === "dark");
  const currentView = views.find((view) => view.key === activeView) || views[0];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkMode);
    localStorage.setItem(THEME_MODE_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#d9f99d,transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#e2e8f0_100%)] px-4 py-6 text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.12),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)] dark:text-slate-100">
      <div className="mx-auto w-full max-w-[460px] space-y-4">
        <header className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.85)]">
          <div className="bg-[linear-gradient(135deg,rgba(190,242,100,0.28),rgba(56,189,248,0.16),rgba(15,23,42,0)_72%)] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-lime-200/80">CheerChen Ledger</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black">生活儀表板</h1>
                <p className="mt-1 text-sm text-slate-300">先做導航骨架，功能之後再各自補上。</p>
              </div>
              <div className="flex items-center gap-2">
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
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{currentView.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">{currentView.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{currentView.description}</p>

          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
            {activeView === "home"
              ? "首頁內容暫時保留空白，之後可以把原本記帳主畫面接回來。"
              : "體重變化頁目前只先開入口，之後再加入每日輸入、歷史列表與圖表。"}
          </div>

          {firebaseConfigIssues.length > 0 ? (
            <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              <p className="font-semibold">Firebase 設定缺失</p>
              <p className="mt-1">{firebaseConfigIssues.join(", ")}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-semibold">Firebase 已連線</p>
              <p className="mt-1 text-xs">專案 ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

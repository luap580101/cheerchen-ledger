import { auth, db, firebaseConfigIssues } from "./firebase";



export default function App() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto w-full max-w-[460px] rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-800">
        <div className="text-center">
          <h1 className="text-5xl font-black text-slate-900 dark:text-white">CheerChen Ledger</h1>
          <p className="mt-4 text-2xl font-light text-slate-500 dark:text-slate-300">Hello World</p>
        </div>
        
        {firebaseConfigIssues.length > 0 ? (
          <div className="mt-8 rounded-xl bg-red-50 p-6 dark:bg-red-900/20">
            <p className="font-semibold text-red-700 dark:text-red-200">⚠️ Firebase 設定缺失</p>
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">{firebaseConfigIssues.join(", ")}</p>
          </div>
        ) : (
          <div className="mt-8 rounded-xl bg-green-50 p-6 dark:bg-green-900/20">
            <p className="font-semibold text-green-700 dark:text-green-200">✓ Firebase 已連線</p>
            <p className="mt-2 text-xs text-green-600 dark:text-green-300">專案 ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID}</p>
          </div>
        )}
      </div>
    </main>
  );
}

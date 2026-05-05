import { CheckCircle2, Cloud, CloudOff, LoaderCircle, TriangleAlert } from "lucide-react";

const styles = {
  synced: {
    icon: CheckCircle2,
    dot: "bg-emerald-400",
    text: "已同步"
  },
  syncing: {
    icon: LoaderCircle,
    dot: "bg-sky-400",
    text: "同步中"
  },
  offline: {
    icon: CloudOff,
    dot: "bg-amber-400",
    text: "離線模式"
  },
  failed: {
    icon: TriangleAlert,
    dot: "bg-rose-400",
    text: "同步失敗"
  },
  idle: {
    icon: Cloud,
    dot: "bg-slate-400",
    text: "待命"
  }
};

export default function SyncIndicator({ status = "idle" }) {
  const current = styles[status] || styles.idle;
  const Icon = current.icon;
  const spinning = status === "syncing";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-xs text-white dark:border-white/10 dark:bg-white/10">
      <span className={`h-2.5 w-2.5 rounded-full ${current.dot}`} />
      <Icon size={14} className={spinning ? "animate-spin" : ""} />
      <span>{current.text}</span>
    </div>
  );
}

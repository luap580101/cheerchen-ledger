import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

const report = (metric) => {
  console.info("[vitals]", metric.name, metric.value);
};

export const reportWebVitals = () => {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
};

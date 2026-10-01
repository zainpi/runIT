import styles from "./plan-loading.module.css";

export function PlanLoading({ label = "Working on your plan…" }: { label?: string }) {
  return <div className={styles.loading}>
    <div className={styles.track} role="progressbar" aria-label={label}>
      <span className={styles.fill} />
    </div>
    <span className={styles.label} role="status">{label}</span>
  </div>;
}

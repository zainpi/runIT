import styles from "../loading.module.css";

// Route loading belongs to private workspaces. A loading boundary above the
// public store/guides would hide their server HTML until JavaScript reveals it.
export default function TemplatesLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.srOnly}>Loading AI templates…</span>
      <div className={styles.intro} aria-hidden="true">
        <span className={styles.line} style={{ width: 140 }} />
        <span className={styles.title} />
        <span className={styles.line} style={{ width: "min(520px, 90%)" }} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={styles.card} />)}
      </div>
    </div>
  );
}

import styles from './dashboard.module.css';

export default function DashboardLoading() {
  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <div
          className="skeleton"
          style={{ height: 32, width: 220, borderRadius: 8 }}
        />
      </div>
      <div className={styles.questionnaireGrid}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 170, borderRadius: 'var(--radius-xl)' }}
          />
        ))}
      </div>
    </div>
  );
}

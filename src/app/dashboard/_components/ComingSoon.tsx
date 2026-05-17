import type { ReactNode } from 'react';
import styles from '../dashboard.module.css';

export function ComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>{title}</h1>
      </div>
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>{icon}</div>
        <h2 className={styles.emptyStateTitle}>Coming soon</h2>
        <p className={styles.emptyStateDesc}>{description}</p>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import dash from '../../dashboard.module.css';
import styles from '../tools.module.css';
import { BackgroundRemover } from './_components/BackgroundRemover';

export default function BackgroundRemoverPage() {
  return (
    <div className={dash.contentBody}>
      <div className={styles.toolHeader}>
        <Link href="/dashboard/tools" className={`btn btn-ghost btn-sm ${styles.backLink}`}>
          <ArrowLeft size={16} strokeWidth={2} />
          All Tools
        </Link>
        <h1 className={dash.largeTitle}>Background Remover</h1>
      </div>
      <BackgroundRemover />
    </div>
  );
}

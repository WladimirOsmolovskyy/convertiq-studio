import Link from 'next/link';
import { Grid3x3, Scissors, type LucideIcon } from 'lucide-react';
import dash from '../dashboard.module.css';
import styles from './tools.module.css';

interface Tool {
  slug: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}

const TOOLS: Tool[] = [
  {
    slug: 'grid-slicer',
    title: 'Grid Slicer',
    description: 'Cut an image into bento tiles with a gap, ready to reassemble in a gapped grid.',
    Icon: Grid3x3,
  },
  {
    slug: 'background-remover',
    title: 'Background Remover',
    description: 'Lift the subject out of a photo with edge sliders and an include / exclude brush.',
    Icon: Scissors,
  },
];

export default function ToolsPage() {
  return (
    <div className={dash.contentBody}>
      <div className={dash.largeTitleBlock}>
        <h1 className={dash.largeTitle}>Tools</h1>
      </div>
      <div className={styles.grid}>
        {TOOLS.map((tool) => (
          <Link key={tool.slug} href={`/dashboard/tools/${tool.slug}`} className={styles.card}>
            <div className={styles.cardIcon}>
              <tool.Icon size={22} strokeWidth={1.5} />
            </div>
            <div className={styles.cardTitle}>{tool.title}</div>
            <p className={styles.cardDesc}>{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

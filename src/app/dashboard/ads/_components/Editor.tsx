'use client';

import { useRef } from 'react';
import type Konva from 'konva';
import TopBar from './TopBar';
import LayerTree from './LayerTree';
import Properties from './Properties';
import EditorStage from './Stage';
import VariablesPanel from './VariablesPanel';
import styles from '../ads.module.css';

export default function Editor() {
  const stageRef = useRef<Konva.Stage | null>(null);
  return (
    <div className={styles.editor}>
      <TopBar stageRef={stageRef} />
      <div className={styles.editorBody}>
        <aside className={styles.leftPanel}>
          <LayerTree />
          <VariablesPanel />
        </aside>
        <main className={styles.centerArea}>
          <EditorStage stageRef={stageRef} />
        </main>
        <aside className={styles.rightPanel}>
          <Properties />
        </aside>
      </div>
    </div>
  );
}

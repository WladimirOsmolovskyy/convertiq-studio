'use client';

import { useState, type ReactNode } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import styles from './editor.module.css';

/**
 * Wraps a preview renderer with a Desktop/Mobile viewport toggle.
 * Mobile mode constrains the preview to a 390×844 phone frame with internal scroll.
 * Used by both the Design tab and the standalone Preview tab.
 */
export default function PreviewViewportShell({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className={styles.previewPane}>
      <div className={styles.viewportToolbar}>
        <button
          type="button"
          className={`${styles.viewportButton} ${viewport === 'desktop' ? styles.viewportButtonActive : ''}`}
          onClick={() => setViewport('desktop')}
          aria-pressed={viewport === 'desktop'}
        >
          <Monitor size={14} strokeWidth={1.75} />
          Desktop
        </button>
        <button
          type="button"
          className={`${styles.viewportButton} ${viewport === 'mobile' ? styles.viewportButtonActive : ''}`}
          onClick={() => setViewport('mobile')}
          aria-pressed={viewport === 'mobile'}
        >
          <Smartphone size={14} strokeWidth={1.75} />
          Mobile
        </button>
      </div>
      <div className={`${styles.previewStage} ${viewport === 'mobile' ? styles.previewStageMobile : ''}`}>
        {viewport === 'mobile' ? (
          <div className={styles.previewMobileFrame}>{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

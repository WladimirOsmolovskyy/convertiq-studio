'use client';

/**
 * Left rail of the Result editor: tabbed surface for Pages and Layers,
 * with a shared search input that filters the active tab's content.
 *
 * Each tab keeps its own filter string so switching back doesn't wipe
 * what you were searching for in the other tab.
 */

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { ResultPage } from '@/lib/types';
import PageList from './_PageList';
import LayersPanel from './_LayersPanel';
import styles from './result.module.css';

type Tab = 'pages' | 'layers';

interface Props {
  pages: ResultPage[];
  selectedPage: ResultPage | null;
  selectedPageId: string | null;
  selectedNodeId: string | null;
  onSelectPage: (id: string | null) => void;
  onSelectNode: (id: string | null) => void;
}

export default function LeftRail({
  pages,
  selectedPage,
  selectedPageId,
  selectedNodeId,
  onSelectPage,
  onSelectNode,
}: Props) {
  const [tab, setTab] = useState<Tab>('pages');
  const [pageFilter, setPageFilter] = useState('');
  const [layerFilter, setLayerFilter] = useState('');

  const filter = tab === 'pages' ? pageFilter : layerFilter;
  const setFilter = tab === 'pages' ? setPageFilter : setLayerFilter;

  return (
    <div className={styles.leftRail}>
      <div className={styles.tabStrip}>
        <button
          className={`${styles.tab} ${tab === 'pages' ? styles.tabActive : ''}`}
          onClick={() => setTab('pages')}
        >
          Pages
        </button>
        <button
          className={`${styles.tab} ${tab === 'layers' ? styles.tabActive : ''}`}
          onClick={() => setTab('layers')}
        >
          Layers
        </button>
      </div>

      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden>
          <Search size={13} strokeWidth={1.75} />
        </span>
        <input
          className={styles.searchInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          type="search"
          aria-label={`Search ${tab}`}
        />
      </div>

      <div className={styles.leftRailContent}>
        {tab === 'pages' ? (
          <PageList
            pages={pages}
            selectedPageId={selectedPageId}
            onSelect={onSelectPage}
            filter={pageFilter}
          />
        ) : selectedPage ? (
          <LayersPanel
            page={selectedPage}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            filter={layerFilter}
          />
        ) : (
          <div className={styles.pageListEmpty}>Select a page to see its layers.</div>
        )}
      </div>
    </div>
  );
}

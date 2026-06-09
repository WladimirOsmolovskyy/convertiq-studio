'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Search, Plus, CirclePlus, Check, X } from 'lucide-react';
import { FilterPopover } from './_FilterPopover';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type AudienceRow,
  type LeadFilters,
  type OptionalFilterKey,
} from './_filters';
import styles from './leads.module.css';

const OPTIONAL: { key: OptionalFilterKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'duration', label: 'Duration' },
  { key: 'score', label: 'Score' },
  { key: 'status', label: 'Status' },
];

// Values cleared when a chip is removed.
const RESET_FOR: Record<OptionalFilterKey, Partial<LeadFilters>> = {
  date: { dateFrom: '', dateTo: '' },
  duration: { durMin: '', durMax: '' },
  score: { scoreMin: '', scoreMax: '' },
  status: { status: 'all' },
};

export function LeadsToolbar({
  filters,
  setFilters,
  added,
  setAdded,
  audiences,
  resultCount,
}: {
  filters: LeadFilters;
  setFilters: Dispatch<SetStateAction<LeadFilters>>;
  added: OptionalFilterKey[];
  setAdded: Dispatch<SetStateAction<OptionalFilterKey[]>>;
  audiences: AudienceRow[];
  resultCount: number;
}) {
  const setFilter = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleAudience = (id: string) =>
    setFilters((prev) => ({
      ...prev,
      audienceIds: prev.audienceIds.includes(id)
        ? prev.audienceIds.filter((x) => x !== id)
        : [...prev.audienceIds, id],
    }));

  const addFilter = (key: OptionalFilterKey) =>
    setAdded((prev) => (prev.includes(key) ? prev : [...prev, key]));

  const removeFilter = (key: OptionalFilterKey) => {
    setAdded((prev) => prev.filter((k) => k !== key));
    setFilters((prev) => ({ ...prev, ...RESET_FOR[key] }));
  };

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setAdded([]);
  };

  const summaryFor = (key: OptionalFilterKey): string => {
    switch (key) {
      case 'date':
        return filters.dateFrom && filters.dateTo
          ? `${filters.dateFrom} – ${filters.dateTo}`
          : filters.dateFrom
            ? `from ${filters.dateFrom}`
            : filters.dateTo
              ? `until ${filters.dateTo}`
              : '';
      case 'duration':
        return filters.durMin && filters.durMax
          ? `${filters.durMin}–${filters.durMax}s`
          : filters.durMin
            ? `≥ ${filters.durMin}s`
            : filters.durMax
              ? `≤ ${filters.durMax}s`
              : '';
      case 'score':
        return filters.scoreMin && filters.scoreMax
          ? `${filters.scoreMin}–${filters.scoreMax}`
          : filters.scoreMin
            ? `≥ ${filters.scoreMin}`
            : filters.scoreMax
              ? `≤ ${filters.scoreMax}`
              : '';
      case 'status':
        return filters.status === 'completed'
          ? 'Completed'
          : filters.status === 'partial'
            ? 'Partial'
            : '';
    }
  };

  const editorFor = (key: OptionalFilterKey): ReactNode => {
    switch (key) {
      case 'date':
        return (
          <>
            <div className={styles.popoverField}>
              <span className={styles.popoverLabel}>From</span>
              <div className={styles.rangeInputs}>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                />
              </div>
            </div>
            <div className={styles.popoverField}>
              <span className={styles.popoverLabel}>To</span>
              <div className={styles.rangeInputs}>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
          </>
        );
      case 'duration':
        return (
          <div className={styles.popoverField}>
            <span className={styles.popoverLabel}>Duration (seconds)</span>
            <div className={styles.rangeInputs}>
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.durMin}
                onChange={(e) => setFilter('durMin', e.target.value)}
              />
              <span className={styles.rangeDash}>–</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.durMax}
                onChange={(e) => setFilter('durMax', e.target.value)}
              />
            </div>
          </div>
        );
      case 'score':
        return (
          <div className={styles.popoverField}>
            <span className={styles.popoverLabel}>Score</span>
            <div className={styles.rangeInputs}>
              <input
                type="number"
                placeholder="Min"
                value={filters.scoreMin}
                onChange={(e) => setFilter('scoreMin', e.target.value)}
              />
              <span className={styles.rangeDash}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.scoreMax}
                onChange={(e) => setFilter('scoreMax', e.target.value)}
              />
            </div>
          </div>
        );
      case 'status':
        return (
          <div className={styles.popoverField}>
            <span className={styles.popoverLabel}>Status</span>
            <div className={styles.segmented}>
              {(['all', 'completed', 'partial'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={filters.status === s ? styles.segmentedActive : undefined}
                  onClick={() => setFilter('status', s)}
                >
                  {s === 'all' ? 'All' : s === 'completed' ? 'Completed' : 'Partial'}
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  const remaining = OPTIONAL.filter((o) => !added.includes(o.key));
  const orderedChips = OPTIONAL.filter((o) => added.includes(o.key));

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchBox}>
        <Search size={15} strokeWidth={2} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search name or email"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
      </div>

      <span className={styles.count}>
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>

      <FilterPopover
        label="Add Filter"
        active={false}
        triggerClassName={styles.addFilterBtn}
        icon={<Plus size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      >
        {(close) => (
          <div className={styles.addMenu}>
            {remaining.length === 0 ? (
              <div className={styles.menuEmpty}>All filters added</div>
            ) : (
              remaining.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    addFilter(o.key);
                    close();
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        )}
      </FilterPopover>

      {orderedChips.map((o) => {
        const summary = summaryFor(o.key);
        const active = summary !== '';
        return (
          <span
            key={o.key}
            className={`${styles.filterChip} ${active ? styles.filterChipOn : ''}`}
          >
            <FilterPopover
              label={o.label}
              summary={active ? `${o.label}: ${summary}` : undefined}
              active={active}
              triggerClassName={styles.chipTrigger}
            >
              {editorFor(o.key)}
            </FilterPopover>
            <button
              type="button"
              className={styles.chipX}
              aria-label={`Remove ${o.label} filter`}
              onClick={() => removeFilter(o.key)}
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </span>
        );
      })}

      {audiences.length > 0 && <div className={styles.toolbarDivider} />}

      {audiences.map((a) => {
        const on = filters.audienceIds.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            className={`${styles.quickChip} ${on ? styles.quickChipOn : ''}`}
            onClick={() => toggleAudience(a.id)}
          >
            {on ? (
              <Check size={14} strokeWidth={2.5} />
            ) : (
              <CirclePlus size={14} strokeWidth={2} />
            )}
            {a.name}
          </button>
        );
      })}

      {hasActiveFilters(filters) && (
        <button type="button" className={styles.clearAll} onClick={clearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}

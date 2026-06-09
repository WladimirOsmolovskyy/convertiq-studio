export type AudienceRow = { id: string; name: string; color: string | null };

export type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  score: number | null;
  audience: AudienceRow | null;
  started_at: string;
  completed_at: string | null;
  durationMs: number | null;
};

export type StatusFilter = 'all' | 'completed' | 'partial';

export type LeadFilters = {
  search: string; // matches name + email
  audienceIds: string[]; // OR across selected audiences
  dateFrom: string; // yyyy-mm-dd
  dateTo: string; // yyyy-mm-dd
  durMin: string; // seconds
  durMax: string; // seconds
  scoreMin: string;
  scoreMax: string;
  status: StatusFilter;
};

// Columns addable via "Add Filter" (search + audience have dedicated controls).
export type OptionalFilterKey = 'date' | 'duration' | 'score' | 'status';

export const EMPTY_FILTERS: LeadFilters = {
  search: '',
  audienceIds: [],
  dateFrom: '',
  dateTo: '',
  durMin: '',
  durMax: '',
  scoreMin: '',
  scoreMax: '',
  status: 'all',
};

export function hasActiveFilters(f: LeadFilters): boolean {
  return (
    f.search !== '' ||
    f.audienceIds.length > 0 ||
    f.dateFrom !== '' ||
    f.dateTo !== '' ||
    f.durMin !== '' ||
    f.durMax !== '' ||
    f.scoreMin !== '' ||
    f.scoreMax !== '' ||
    f.status !== 'all'
  );
}

function numOrNull(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function applyLeadFilters(leads: Lead[], f: LeadFilters): Lead[] {
  const q = f.search.trim().toLowerCase();
  const scoreMin = numOrNull(f.scoreMin);
  const scoreMax = numOrNull(f.scoreMax);
  const durMin = numOrNull(f.durMin);
  const durMax = numOrNull(f.durMax);
  const fromTs = f.dateFrom ? new Date(`${f.dateFrom}T00:00:00`).getTime() : null;
  const toTs = f.dateTo ? new Date(`${f.dateTo}T23:59:59.999`).getTime() : null;
  const audSet = f.audienceIds.length ? new Set(f.audienceIds) : null;

  return leads.filter((l) => {
    if (q) {
      const hay = `${l.name ?? ''} ${l.email ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (audSet && !(l.audience && audSet.has(l.audience.id))) return false;
    if (f.status === 'completed' && !l.completed_at) return false;
    if (f.status === 'partial' && l.completed_at) return false;

    if (scoreMin !== null || scoreMax !== null) {
      if (l.score === null) return false;
      if (scoreMin !== null && l.score < scoreMin) return false;
      if (scoreMax !== null && l.score > scoreMax) return false;
    }

    if (durMin !== null || durMax !== null) {
      if (l.durationMs === null) return false;
      if (durMin !== null && l.durationMs < durMin * 1000) return false;
      if (durMax !== null && l.durationMs > durMax * 1000) return false;
    }

    const ts = new Date(l.started_at).getTime();
    if (fromTs !== null && ts < fromTs) return false;
    if (toTs !== null && ts > toTs) return false;

    return true;
  });
}

import type { AdDocument, AdVariable } from '@/app/dashboard/ads/_model/nodes';

export interface AdTemplateRow {
  id: string;
  project_id: string;
  title: string;
  document: AdDocument;
  variables: AdVariable[];
  created_at: string;
  updated_at: string;
}

export interface AdGenerationRow {
  id: string;
  project_id: string;
  /** Null when the source template has been deleted (ON DELETE SET NULL). */
  template_id: string | null;
  title: string;
  values: Record<string, string | number>;
  /** Array of size names selected for export (e.g. "Square 1080"). */
  selected_sizes: string[];
  created_at: string;
  updated_at: string;
}

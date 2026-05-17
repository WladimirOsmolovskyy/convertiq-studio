import type { AdDocument } from '../_model/nodes';
import { defaultDocument } from './static-ad-default';

export interface TemplateEntry {
  id: string;
  name: string;
  thumb?: string;
  build: () => AdDocument;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: 'default',
    name: 'Default',
    build: () => clone(defaultDocument),
  },
];

export function getTemplate(id: string): AdDocument {
  const entry = TEMPLATES.find((t) => t.id === id);
  return entry ? entry.build() : clone(defaultDocument);
}

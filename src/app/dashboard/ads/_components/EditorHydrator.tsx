'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '../_store/editor';
import type { AdTemplateRow } from '@/lib/adTemplates';
import type { AdVariable } from '../_model/nodes';

function loadVariables(template: AdTemplateRow): AdVariable[] {
  const fromColumn = (template.variables ?? []).filter((v): v is AdVariable => !!v && !!v.nodeId);
  if (fromColumn.length > 0) return fromColumn;
  const fromDoc = (template.document?.variables ?? []).filter((v): v is AdVariable => !!v && !!v.nodeId);
  return fromDoc;
}

export default function EditorHydrator({ template }: { template: AdTemplateRow }) {
  const loadTemplate = useEditorStore((s) => s.loadTemplate);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedIdRef.current === template.id) return;
    loadedIdRef.current = template.id;
    loadTemplate({
      templateId: template.id,
      title: template.title,
      doc: template.document,
      variables: loadVariables(template),
    });
  }, [template, loadTemplate]);

  return null;
}

'use client';

import dynamic from 'next/dynamic';
import type { AdTemplateRow } from '@/lib/adTemplates';
import EditorHydrator from '../../../_components/EditorHydrator';

const Editor = dynamic(() => import('../../../_components/Editor'), { ssr: false });

export default function TemplateEditor({ template }: { template: AdTemplateRow }) {
  return (
    <>
      <EditorHydrator template={template} />
      <Editor />
    </>
  );
}

'use client';

import dynamic from 'next/dynamic';

// Konva mounts on canvas — must not SSR.
const Editor = dynamic(() => import('./_components/Editor'), { ssr: false });

export default function AdsPage() {
  return <Editor />;
}

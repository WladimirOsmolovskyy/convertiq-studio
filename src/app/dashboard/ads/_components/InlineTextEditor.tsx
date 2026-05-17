'use client';

import { useEffect, useRef, useState } from 'react';
import type { TextNode, Transform } from '../_model/nodes';

interface Props {
  node: TextNode;
  layout: Transform;
  scale: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export default function InlineTextEditor({ node, layout, scale, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(node.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => onCommit(value);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      }}
      style={{
        position: 'absolute',
        left: layout.x * scale,
        top: layout.y * scale,
        width: layout.width * scale,
        minHeight: layout.height * scale,
        fontFamily: node.fontFamily,
        fontSize: node.fontSize * scale,
        fontWeight: node.fontWeight,
        color: node.color,
        lineHeight: node.lineHeight,
        letterSpacing: `${node.letterSpacing * scale}px`,
        textAlign: node.align,
        background: 'rgba(0, 122, 255, 0.06)',
        border: '1px solid rgba(0, 122, 255, 0.4)',
        borderRadius: 2,
        outline: 'none',
        padding: 0,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        zIndex: 5,
      }}
    />
  );
}

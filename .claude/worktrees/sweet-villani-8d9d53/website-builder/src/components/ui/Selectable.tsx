import React from 'react';
import type { CSSProperties, ReactElement } from 'react';

interface SelectableProps {
  id: string;
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  children: ReactElement<any>;
  overrides?: Record<string, string>;
}

export function Selectable({ id, isSelectMode, isSelected, onSelect, children, overrides = {} }: SelectableProps) {
  if (!isSelectMode) {
    if (Object.keys(overrides).length > 0) {
      const existingStyle = children.props.style || {};
      return React.cloneElement(children, {
        style: { ...existingStyle, ...overrides }
      });
    }
    return children;
  }

  const existingStyle = children.props.style || {};
  
  const mergedStyle: CSSProperties = {
    ...existingStyle,
    ...overrides,
    cursor: 'pointer',
    position: 'relative',
    transition: 'outline 0.1s',
    outline: isSelected ? '2px solid var(--app-accent)' : '2px dashed transparent',
    outlineOffset: '4px',
    borderRadius: existingStyle.borderRadius || '4px'
  };

  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect(id);
    },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (!isSelected && e.currentTarget) {
        e.currentTarget.style.outline = '2px dashed var(--app-accent)';
      }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      if (!isSelected && e.currentTarget) {
        e.currentTarget.style.outline = '2px dashed transparent';
      }
    },
    style: mergedStyle
  });
}

'use client';

import { create } from 'zustand';
import { produce } from 'immer';
import type { AdDocument, NodeId, SceneNode } from '../_model/nodes';
import { defaultDocument } from '../_templates/static-ad-default';
import { updateNodeInPlace } from '../_model/tree';

const HISTORY_LIMIT = 100;

interface EditorState {
  doc: AdDocument;
  selectedId: NodeId | null;
  past: AdDocument[];
  future: AdDocument[];
  expanded: Set<NodeId>;

  setSelected: (id: NodeId | null) => void;
  toggleExpanded: (id: NodeId) => void;
  setExpanded: (id: NodeId, value: boolean) => void;

  /** Commit a mutation. Pushes prev state to undo stack. */
  edit: (mutator: (draft: AdDocument) => void) => void;

  /** Update a single node by id without pushing history (use sparingly — e.g. live drag). */
  patchNode: (id: NodeId, mutator: (node: SceneNode) => void) => void;

  /** Convenience: edit a single node and commit to history. */
  editNode: (id: NodeId, mutator: (node: SceneNode) => void) => void;

  loadDocument: (doc: AdDocument) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function freshDoc(): AdDocument {
  return JSON.parse(JSON.stringify(defaultDocument));
}

function allFrameIds(node: SceneNode, out: Set<NodeId>) {
  if (node.type === 'frame') {
    out.add(node.id);
    for (const c of node.children) allFrameIds(c, out);
  }
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initial = freshDoc();
  const expanded = new Set<NodeId>();
  allFrameIds(initial.root, expanded);

  return {
    doc: initial,
    selectedId: null,
    past: [],
    future: [],
    expanded,

    setSelected: (id) => set({ selectedId: id }),

    toggleExpanded: (id) =>
      set((s) => {
        const next = new Set(s.expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { expanded: next };
      }),

    setExpanded: (id, value) =>
      set((s) => {
        const next = new Set(s.expanded);
        if (value) next.add(id);
        else next.delete(id);
        return { expanded: next };
      }),

    edit: (mutator) =>
      set((s) => {
        const nextDoc = produce(s.doc, mutator);
        if (nextDoc === s.doc) return s;
        const past = [...s.past, s.doc].slice(-HISTORY_LIMIT);
        return { doc: nextDoc, past, future: [] };
      }),

    patchNode: (id, mutator) =>
      set((s) => ({
        doc: produce(s.doc, (draft) => {
          updateNodeInPlace(draft.root, id, mutator);
        }),
      })),

    editNode: (id, mutator) =>
      set((s) => {
        const nextDoc = produce(s.doc, (draft) => {
          updateNodeInPlace(draft.root, id, mutator);
        });
        if (nextDoc === s.doc) return s;
        const past = [...s.past, s.doc].slice(-HISTORY_LIMIT);
        return { doc: nextDoc, past, future: [] };
      }),

    loadDocument: (doc) =>
      set(() => {
        const expanded = new Set<NodeId>();
        allFrameIds(doc.root, expanded);
        return { doc, past: [], future: [], selectedId: null, expanded };
      }),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s;
        const prev = s.past[s.past.length - 1];
        return {
          doc: prev,
          past: s.past.slice(0, -1),
          future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT),
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s;
        const next = s.future[0];
        return {
          doc: next,
          past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

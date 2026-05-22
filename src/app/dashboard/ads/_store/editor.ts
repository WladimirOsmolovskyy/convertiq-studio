'use client';

import { create } from 'zustand';
import { produce } from 'immer';
import type { AdDocument, AdVariable, NodeId, SceneNode } from '../_model/nodes';
import { defaultDocument } from '../_templates/static-ad-default';
import { updateNodeInPlace } from '../_model/tree';

const HISTORY_LIMIT = 100;

interface EditorState {
  templateId: string | null;
  templateTitle: string;
  doc: AdDocument;
  variables: AdVariable[];
  selectedId: NodeId | null;
  past: { doc: AdDocument; variables: AdVariable[] }[];
  future: { doc: AdDocument; variables: AdVariable[] }[];
  expanded: Set<NodeId>;

  setSelected: (id: NodeId | null) => void;
  setTemplateTitle: (title: string) => void;
  toggleExpanded: (id: NodeId) => void;
  setExpanded: (id: NodeId, value: boolean) => void;

  /** Commit a mutation. Pushes prev state to undo stack. */
  edit: (mutator: (draft: AdDocument) => void) => void;

  /** Update a single node by id without pushing history (use sparingly — e.g. live drag). */
  patchNode: (id: NodeId, mutator: (node: SceneNode) => void) => void;

  /** Convenience: edit a single node and commit to history. */
  editNode: (id: NodeId, mutator: (node: SceneNode) => void) => void;

  addVariable: (v: AdVariable) => void;
  removeVariable: (id: string) => void;
  renameVariable: (id: string, label: string) => void;

  loadTemplate: (input: {
    templateId: string | null;
    title: string;
    doc: AdDocument;
    variables: AdVariable[];
  }) => void;
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
    templateId: null,
    templateTitle: 'Untitled Ad Template',
    doc: initial,
    variables: [],
    selectedId: null,
    past: [],
    future: [],
    expanded,

    setSelected: (id) => set({ selectedId: id }),
    setTemplateTitle: (title) => set({ templateTitle: title }),

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
        const past = [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT);
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
        const past = [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT);
        return { doc: nextDoc, past, future: [] };
      }),

    addVariable: (v) =>
      set((s) => {
        const past = [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT);
        return { variables: [...s.variables, v], past, future: [] };
      }),

    removeVariable: (id) =>
      set((s) => {
        if (!s.variables.some((v) => v.id === id)) return s;
        const past = [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT);
        return { variables: s.variables.filter((v) => v.id !== id), past, future: [] };
      }),

    renameVariable: (id, label) =>
      set((s) => {
        if (!s.variables.some((v) => v.id === id)) return s;
        const past = [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT);
        return {
          variables: s.variables.map((v) => (v.id === id ? { ...v, label } : v)),
          past,
          future: [],
        };
      }),

    loadTemplate: ({ templateId, title, doc, variables }) =>
      set(() => {
        const exp = new Set<NodeId>();
        allFrameIds(doc.root, exp);
        return {
          templateId,
          templateTitle: title,
          doc,
          variables,
          past: [],
          future: [],
          selectedId: null,
          expanded: exp,
        };
      }),

    loadDocument: (doc) =>
      set(() => {
        const exp = new Set<NodeId>();
        allFrameIds(doc.root, exp);
        return { doc, past: [], future: [], selectedId: null, expanded: exp };
      }),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s;
        const prev = s.past[s.past.length - 1];
        return {
          doc: prev.doc,
          variables: prev.variables,
          past: s.past.slice(0, -1),
          future: [{ doc: s.doc, variables: s.variables }, ...s.future].slice(0, HISTORY_LIMIT),
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s;
        const next = s.future[0];
        return {
          doc: next.doc,
          variables: next.variables,
          past: [...s.past, { doc: s.doc, variables: s.variables }].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

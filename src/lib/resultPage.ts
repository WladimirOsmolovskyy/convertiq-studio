import type { ResultFrameNode, ResultNode, ResultPage, TextSpan } from './types';

/** Concatenate the literal-text portions of a span array, dropping variable
 *  references. Used for surfaces that need plain text (webhook payloads,
 *  fallback rendering) before the full block renderer + variable resolver
 *  is wired up. */
export function spansToPlainText(spans: TextSpan[] | undefined): string {
  if (!spans) return '';
  return spans
    .map((s) => (s.type === 'text' ? s.value : ''))
    .join('')
    .trim();
}

/** Walk a node tree depth-first and yield text nodes in document order. */
function* iterTextNodes(node: ResultNode): Generator<{ spans: TextSpan[] }> {
  if (node.type === 'text') {
    yield { spans: node.spans };
    return;
  }
  if (node.type === 'frame') {
    for (const child of node.children) yield* iterTextNodes(child);
  }
}

/* ─── Tree mutation helpers ─────────────────────────────────────
 * Operate on a root frame and return a fresh tree (immutable). Used
 * by the store mutators that mirror this pattern across the page set. */

/** Find a node by id anywhere in the tree, or null. */
export function findNode(root: ResultFrameNode, id: string): ResultNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    if (child.id === id) return child;
    if (child.type === 'frame') {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** Apply a patch to one node anywhere in the tree, returning a fresh tree.
 *  Type-narrowing is the caller's responsibility — pass only fields that
 *  make sense for the target node's type. */
export function patchNode(
  root: ResultFrameNode,
  id: string,
  patch: Partial<ResultNode>,
): ResultFrameNode {
  return walkPatchFrame(root, id, patch);
}

function walkPatch(node: ResultNode, id: string, patch: Partial<ResultNode>): ResultNode {
  if (node.id === id) {
    return { ...node, ...patch } as ResultNode;
  }
  if (node.type === 'frame') {
    return walkPatchFrame(node, id, patch);
  }
  return node;
}

function walkPatchFrame(
  frame: ResultFrameNode,
  id: string,
  patch: Partial<ResultNode>,
): ResultFrameNode {
  if (frame.id === id) {
    return { ...frame, ...patch } as ResultFrameNode;
  }
  return {
    ...frame,
    children: frame.children.map((child) => walkPatch(child, id, patch)),
  };
}

/** Append a node as the last child of a specific frame. If parentId
 *  doesn't resolve to a frame, returns the tree unchanged. */
export function appendChild(
  root: ResultFrameNode,
  parentId: string,
  node: ResultNode,
): ResultFrameNode {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, node] };
  }
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.type === 'frame') return appendChild(child, parentId, node);
      return child;
    }),
  };
}

/** Remove a node by id from anywhere in the tree. Returns the tree
 *  unchanged if the id is the root (you can't delete the root). */
export function deleteNode(root: ResultFrameNode, id: string): ResultFrameNode {
  if (root.id === id) return root;
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((child) => (child.type === 'frame' ? deleteNode(child, id) : child)),
  };
}

/** Find the parent frame of a node, or null if not found / target is root. */
export function findParent(
  root: ResultFrameNode,
  id: string,
): ResultFrameNode | null {
  if (root.id === id) return null;
  for (const child of root.children) {
    if (child.id === id) return root;
    if (child.type === 'frame') {
      const inner = findParent(child, id);
      if (inner) return inner;
    }
  }
  return null;
}

/** Swap a node with its neighbor inside its parent's children list.
 *  No-op if the node is already at the edge in the requested direction
 *  or isn't found in the tree. */
export function moveNodeWithinParent(
  root: ResultFrameNode,
  nodeId: string,
  direction: 'up' | 'down',
): ResultFrameNode {
  const delta = direction === 'up' ? -1 : 1;
  return swapWithin(root, nodeId, delta);
}

function swapWithin(
  frame: ResultFrameNode,
  nodeId: string,
  delta: number,
): ResultFrameNode {
  const idx = frame.children.findIndex((c) => c.id === nodeId);
  if (idx !== -1) {
    const target = idx + delta;
    if (target < 0 || target >= frame.children.length) return frame;
    const next = [...frame.children];
    [next[idx], next[target]] = [next[target], next[idx]];
    return { ...frame, children: next };
  }
  // Recurse into child frames.
  return {
    ...frame,
    children: frame.children.map((child) =>
      child.type === 'frame' ? swapWithin(child, nodeId, delta) : child,
    ),
  };
}

/** True if the node is the first/last child of its parent (relative to
 *  the requested direction). Used to disable Move Up/Down buttons. */
export function canMoveNode(
  root: ResultFrameNode,
  nodeId: string,
  direction: 'up' | 'down',
): boolean {
  const parent = findParent(root, nodeId);
  if (!parent) return false;
  const idx = parent.children.findIndex((c) => c.id === nodeId);
  if (idx < 0) return false;
  return direction === 'up' ? idx > 0 : idx < parent.children.length - 1;
}

/* ─── Tree iteration / reparenting (for the Layers panel) ──────── */

export interface FlatNodeEntry {
  node: ResultNode;
  depth: number;
  /** Parent frame's id. The root is yielded with parentId='' to mark it. */
  parentId: string;
}

/** Yield every node in the tree depth-first with depth + parentId.
 *  The root frame itself IS yielded (depth 0, parentId='') so the layers
 *  panel can render it as the top row. */
export function* walkTree(root: ResultFrameNode): Generator<FlatNodeEntry> {
  yield { node: root, depth: 0, parentId: '' };
  yield* walkChildren(root, 1);
}

function* walkChildren(frame: ResultFrameNode, depth: number): Generator<FlatNodeEntry> {
  for (const child of frame.children) {
    yield { node: child, depth, parentId: frame.id };
    if (child.type === 'frame') {
      yield* walkChildren(child, depth + 1);
    }
  }
}

/** Frame ids the node can be moved into without creating a cycle. Excludes:
 *   - the node itself
 *   - any descendant of the node
 *   - the node's current parent (no-op move) */
export function listValidMoveTargets(root: ResultFrameNode, nodeId: string): string[] {
  const node = findNode(root, nodeId);
  if (!node) return [];
  const currentParent = findParent(root, nodeId);
  const forbidden = new Set<string>([nodeId]);
  if (node.type === 'frame') collectDescendantIds(node, forbidden);
  const out: string[] = [];
  for (const entry of walkTree(root)) {
    if (entry.node.type !== 'frame') continue;
    if (forbidden.has(entry.node.id)) continue;
    if (currentParent && entry.node.id === currentParent.id) continue;
    out.push(entry.node.id);
  }
  return out;
}

function collectDescendantIds(frame: ResultFrameNode, into: Set<string>): void {
  for (const child of frame.children) {
    into.add(child.id);
    if (child.type === 'frame') collectDescendantIds(child, into);
  }
}

/** Detach a node from its current parent and append it as the last child
 *  of `targetParentId`. No-op if the move would create a cycle, the node
 *  is the root, or the target isn't a frame. */
export function moveNodeToFrame(
  root: ResultFrameNode,
  nodeId: string,
  targetParentId: string,
): ResultFrameNode {
  if (nodeId === root.id) return root;
  const node = findNode(root, nodeId);
  if (!node) return root;
  const target = findNode(root, targetParentId);
  if (!target || target.type !== 'frame') return root;
  // Disallow moving into self or any descendant.
  if (!listValidMoveTargets(root, nodeId).includes(targetParentId)) return root;
  const detached = deleteNode(root, nodeId);
  return appendChild(detached, targetParentId, node);
}

/** Best-effort projection of a ResultPage to {title, description}.
 *
 *  Used during the staged rollout of the new result-page designer: the
 *  existing thank-you screen + the lead webhook payload still expose a
 *  title/description shape. We derive those from the first two text nodes
 *  found in the page's content tree (which the migration seeds from the
 *  old score_results.title / .description). Once the block renderer ships,
 *  callers that render the full page should stop relying on this and use
 *  the tree directly.
 *
 *  Falls back to {title: page.name, description: ''} if the tree is empty. */
export function deriveTitleDescription(page: ResultPage): {
  title: string;
  description: string;
} {
  const it = iterTextNodes(page.content);
  const first = it.next();
  const second = it.next();
  const title = first.done ? '' : spansToPlainText(first.value.spans);
  const description = second.done ? '' : spansToPlainText(second.value.spans);
  return {
    title: title || page.name,
    description,
  };
}

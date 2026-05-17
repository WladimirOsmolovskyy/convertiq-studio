import type { FrameNode, SceneNode, NodeId } from './nodes';

export function findNode(root: SceneNode, id: NodeId): SceneNode | null {
  if (root.id === id) return root;
  if (root.type !== 'frame') return null;
  for (const c of root.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

export function findNodeAndParent(
  root: SceneNode,
  id: NodeId,
  parent: FrameNode | null = null,
): { node: SceneNode; parent: FrameNode | null } | null {
  if (root.id === id) return { node: root, parent };
  if (root.type !== 'frame') return null;
  for (const c of root.children) {
    const found = findNodeAndParent(c, id, root);
    if (found) return found;
  }
  return null;
}

export function updateNodeInPlace(
  root: SceneNode,
  id: NodeId,
  mutator: (node: SceneNode) => void,
): boolean {
  if (root.id === id) {
    mutator(root);
    return true;
  }
  if (root.type !== 'frame') return false;
  for (const c of root.children) {
    if (updateNodeInPlace(c, id, mutator)) return true;
  }
  return false;
}

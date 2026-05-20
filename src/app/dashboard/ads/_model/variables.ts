import type {
  AdDocument,
  AdVariable,
  AdVariableProperty,
  AdVariableType,
  NodeId,
  SceneNode,
} from './nodes';
import { findNode, updateNodeInPlace } from './tree';

export type { AdVariable, AdVariableProperty, AdVariableType } from './nodes';

export type VariableValue = string | number;

/** Map a property to the input type used for the variable. */
export function typeForProperty(property: AdVariableProperty): AdVariableType {
  if (property === 'fontSize') return 'number';
  if (property === 'fill') return 'color';
  return 'text';
}

/** Build a friendly default label from the bound node + property. */
export function suggestVariableLabel(node: SceneNode, property: AdVariableProperty): string {
  const base = node.name || node.type;
  switch (property) {
    case 'text': return `${base} text`;
    case 'fill': return `${base} color`;
    case 'fontFamily': return `${base} font`;
    case 'fontSize': return `${base} size`;
  }
}

/** Read the current value of the property a variable points at. */
export function readBoundValue(doc: AdDocument, v: AdVariable): VariableValue | null {
  const node = findNode(doc.root, v.nodeId);
  if (!node) return null;
  switch (v.property) {
    case 'text':       return node.type === 'text' ? node.text : null;
    case 'fontSize':   return node.type === 'text' ? node.fontSize : null;
    case 'fontFamily': return node.type === 'text' ? node.fontFamily : null;
    case 'fill':
      if (node.type === 'shape' || node.type === 'frame') return node.fill ?? '';
      if (node.type === 'text') return node.color;
      if (node.type === 'icon') return node.color;
      return null;
  }
}

/** Apply variable values to a doc clone, mutating in place. */
export function applyVariableValues(
  doc: AdDocument,
  variables: AdVariable[],
  values: Record<string, VariableValue>,
): void {
  for (const v of variables) {
    if (!v || !v.nodeId || !v.property) continue;
    const raw = values[v.id];
    const value = raw === undefined || raw === null || raw === '' ? v.defaultValue : raw;
    if (value === undefined || value === null) continue;
    updateNodeInPlace(doc.root, v.nodeId, (node) => {
      if (v.property === 'text' && node.type === 'text') {
        node.text = String(value);
      } else if (v.property === 'fontSize' && node.type === 'text') {
        node.fontSize = Number(value);
      } else if (v.property === 'fontFamily' && node.type === 'text') {
        node.fontFamily = String(value);
      } else if (v.property === 'fill') {
        if (node.type === 'shape' || node.type === 'frame') node.fill = String(value);
        else if (node.type === 'text') node.color = String(value);
        else if (node.type === 'icon') node.color = String(value);
      }
    });
  }
}

/** True if any variable is already bound to that node+property. */
export function findBinding(
  variables: AdVariable[],
  nodeId: NodeId,
  property: AdVariableProperty,
): AdVariable | null {
  return variables.find((v) => v && v.nodeId === nodeId && v.property === property) ?? null;
}

let counter = 0;
export function newVariableId(): string {
  counter += 1;
  return `v_${Date.now().toString(36)}_${counter.toString(36)}`;
}

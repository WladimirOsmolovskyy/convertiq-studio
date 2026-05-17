export type NodeId = string;

export type AutoLayoutDirection = 'row' | 'col' | 'none';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'space-between';
export type ConstraintAxis = 'left' | 'right' | 'center' | 'stretch';

export interface Constraints {
  x: ConstraintAxis;
  y: ConstraintAxis;
}

export type SizingMode = 'fixed' | 'fill' | 'relative' | 'fit';

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** How the width is resolved. Default: 'fixed'. */
  widthMode?: SizingMode;
  /** How the height is resolved. Default: 'fixed'. */
  heightMode?: SizingMode;
}

export interface AutoLayout {
  direction: AutoLayoutDirection;
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  align: Align;
  justify: Justify;
  /** @deprecated — use Transform.widthMode/heightMode = 'fit' instead. Retained for backward-compat. */
  hugContents?: { width: boolean; height: boolean };
}

export interface NodeBase {
  id: NodeId;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode?: 'normal' | 'multiply' | 'screen';
  constraints?: Constraints;
  participatesInAutoLayout?: boolean;
  transform: Transform;
}

export interface FrameNode extends NodeBase {
  type: 'frame';
  fill?: string;
  cornerRadius?: number;
  clip?: boolean;
  autoLayout?: AutoLayout;
  children: SceneNode[];
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number; opacity: number };
}

export type TextAutofit = 'none' | 'shrink' | 'wrap';

export interface TextNode extends NodeBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  autofit: TextAutofit;
}

export type ShapeKind = 'rect' | 'ellipse' | 'line';

export interface ShapeNode extends NodeBase {
  type: 'shape';
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export type ImageFit = 'cover' | 'contain' | 'fill';

export interface ImageNode extends NodeBase {
  type: 'image';
  src: string;
  fit: ImageFit;
}

export interface IconNode extends NodeBase {
  type: 'icon';
  path: string;
  viewBox: string;
  color: string;
  strokeWidth?: number;
}

export type SceneNode = FrameNode | TextNode | ShapeNode | ImageNode | IconNode;

export interface AdSize {
  name: string;
  width: number;
  height: number;
}

export const STANDARD_SIZES: AdSize[] = [
  { name: 'Square 1080', width: 1080, height: 1080 },
  { name: 'Portrait 4:5', width: 1080, height: 1350 },
  { name: 'Story 9:16', width: 1080, height: 1920 },
  { name: 'Landscape 16:9', width: 1920, height: 1080 },
  { name: 'Medium Rectangle', width: 300, height: 250 },
];

export interface AdDocument {
  id: string;
  name: string;
  size: { width: number; height: number };
  root: FrameNode;
  slots: Record<string, NodeId>;
}

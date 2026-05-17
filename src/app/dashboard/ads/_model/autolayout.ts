import type { SceneNode, FrameNode, Transform, SizingMode } from './nodes';
import { measureText } from './text';

export type LayoutMap = Map<string, Transform>;

interface Size {
  width: number;
  height: number;
}

const widthMode = (n: SceneNode): SizingMode => n.transform.widthMode ?? 'fixed';
const heightMode = (n: SceneNode): SizingMode => n.transform.heightMode ?? 'fixed';

/** Compute layout transforms for the entire tree. */
export function computeLayout(root: FrameNode): LayoutMap {
  const out: LayoutMap = new Map();
  layoutFrame(
    root,
    { x: 0, y: 0, width: root.transform.width, height: root.transform.height },
    out,
  );
  return out;
}

/**
 * "Intrinsic" size — what the node naturally wants to be when its mode is `fit`.
 * For text: the measured text size. For frames: the size of the frame given its children (and its
 * own auto-layout / padding). For everything else: the stored transform.width/height.
 *
 * When called during recursion, children with `fill`/`relative` modes fall back to their stored
 * `transform.width/height` (we can't depend on a parent that doesn't exist yet).
 */
function intrinsicSize(node: SceneNode): Size {
  if (node.type === 'text') {
    return measureText(node);
  }
  if (node.type === 'frame') {
    return frameIntrinsicSize(node);
  }
  return { width: node.transform.width, height: node.transform.height };
}

function frameIntrinsicSize(frame: FrameNode): Size {
  const al = frame.autoLayout;
  if (al && al.direction !== 'none') {
    const participants = frame.children.filter(
      (c) => c.visible && (c.participatesInAutoLayout ?? true),
    );
    if (participants.length === 0) {
      return { width: frame.transform.width, height: frame.transform.height };
    }
    const isRow = al.direction === 'row';

    // For intrinsic: 'fill' children fall back to fixed (we have no parent size yet).
    const sizes = participants.map((c) => resolveIntrinsicChildSize(c));

    const mainTotal =
      sizes.reduce((acc, s) => acc + (isRow ? s.width : s.height), 0) +
      al.gap * Math.max(0, participants.length - 1);
    const crossMax = sizes.reduce(
      (acc, s) => Math.max(acc, isRow ? s.height : s.width),
      0,
    );

    const padMain = isRow ? al.paddingLeft + al.paddingRight : al.paddingTop + al.paddingBottom;
    const padCross = isRow ? al.paddingTop + al.paddingBottom : al.paddingLeft + al.paddingRight;

    return {
      width: isRow ? mainTotal + padMain : crossMax + padCross,
      height: isRow ? crossMax + padCross : mainTotal + padMain,
    };
  }
  // Frame without auto-layout — intrinsic is its stored size.
  return { width: frame.transform.width, height: frame.transform.height };
}

/** Used when computing a parent frame's intrinsic size — fill/relative children fall back to their fixed size. */
function resolveIntrinsicChildSize(node: SceneNode): Size {
  const wm = widthMode(node);
  const hm = heightMode(node);
  const intrinsic = intrinsicSize(node);
  const width = wm === 'fit' ? intrinsic.width : node.transform.width;
  const height = hm === 'fit' ? intrinsic.height : node.transform.height;
  return { width, height };
}

function resolveAxis(
  mode: SizingMode,
  storedValue: number,
  parentInner: number,
  intrinsic: number,
): number {
  switch (mode) {
    case 'fixed':
      return storedValue;
    case 'fill':
      return Math.max(0, parentInner);
    case 'relative':
      // storedValue is interpreted as a percentage (0..100).
      return Math.max(0, (parentInner * storedValue) / 100);
    case 'fit':
      return intrinsic;
  }
}

function resolveChildSize(node: SceneNode, parentInner: Size): Size {
  const intrinsic = intrinsicSize(node);
  return {
    width: resolveAxis(widthMode(node), node.transform.width, parentInner.width, intrinsic.width),
    height: resolveAxis(heightMode(node), node.transform.height, parentInner.height, intrinsic.height),
  };
}

/**
 * Layout a frame at the absolute transform `myT` (decided by the parent).
 * Recursively positions children and writes world-space transforms into `out`.
 */
function layoutFrame(frame: FrameNode, myT: Transform, out: LayoutMap) {
  const computed: Transform = { ...myT, rotation: frame.transform.rotation };

  // Re-evaluate own size based on widthMode/heightMode if the frame controls its own size
  // (i.e. its modes are 'fit'). For 'fixed'/'fill'/'relative' the parent already gave us myT.
  if (widthMode(frame) === 'fit' || heightMode(frame) === 'fit') {
    const intrinsic = frameIntrinsicSize(frame);
    if (widthMode(frame) === 'fit') computed.width = intrinsic.width;
    if (heightMode(frame) === 'fit') computed.height = intrinsic.height;
  }

  out.set(frame.id, computed);

  const al = frame.autoLayout;
  if (al && al.direction !== 'none') {
    layoutAutoChildren(frame, computed, out);
  } else {
    layoutFreeChildren(frame, computed, out);
  }
}

function layoutAutoChildren(frame: FrameNode, myT: Transform, out: LayoutMap) {
  const al = frame.autoLayout!;
  const isRow = al.direction === 'row';
  const participants = frame.children.filter(
    (c) => c.visible && (c.participatesInAutoLayout ?? true),
  );

  const padStart = isRow ? al.paddingLeft : al.paddingTop;
  const padEnd = isRow ? al.paddingRight : al.paddingBottom;
  const crossPadStart = isRow ? al.paddingTop : al.paddingLeft;
  const crossPadEnd = isRow ? al.paddingBottom : al.paddingRight;

  const mainSize = isRow ? myT.width : myT.height;
  const crossSize = isRow ? myT.height : myT.width;
  const innerCross = Math.max(0, crossSize - crossPadStart - crossPadEnd);
  const innerMain = Math.max(0, mainSize - padStart - padEnd);

  // Compute each participant's resolved size.
  // Cross axis honours the child's mode against `innerCross`.
  // Main axis: 'fit' uses intrinsic; 'fixed' uses stored; 'fill'/'relative' fall back to intrinsic
  // for v1 (no flex-grow yet).
  const sizes = participants.map<Size>((c) => {
    const intrinsic = intrinsicSize(c);
    const wm = widthMode(c);
    const hm = heightMode(c);

    const mainRaw = isRow ? wm : hm;
    const crossRaw = isRow ? hm : wm;
    const mainStored = isRow ? c.transform.width : c.transform.height;
    const crossStored = isRow ? c.transform.height : c.transform.width;
    const mainIntrinsic = isRow ? intrinsic.width : intrinsic.height;
    const crossIntrinsic = isRow ? intrinsic.height : intrinsic.width;

    const mainEff =
      mainRaw === 'fit' ? mainIntrinsic :
      mainRaw === 'fixed' ? mainStored :
      mainRaw === 'relative' ? (innerMain * mainStored) / 100 :
      /* fill */ mainIntrinsic;

    // Cross-axis 'fill' → innerCross. Also support legacy al.align === 'stretch'.
    const crossEff =
      crossRaw === 'fit' ? crossIntrinsic :
      crossRaw === 'fixed' ? crossStored :
      crossRaw === 'relative' ? (innerCross * crossStored) / 100 :
      /* fill */ innerCross;

    return {
      width: isRow ? mainEff : crossEff,
      height: isRow ? crossEff : mainEff,
    };
  });

  const contentMain =
    sizes.reduce((acc, s) => acc + (isRow ? s.width : s.height), 0) +
    al.gap * Math.max(0, participants.length - 1);
  const free = Math.max(0, innerMain - contentMain);

  let cursor = padStart;
  let perGap = al.gap;
  if (al.justify === 'center') cursor = padStart + free / 2;
  else if (al.justify === 'end') cursor = padStart + free;
  else if (al.justify === 'space-between' && participants.length > 1) {
    perGap = al.gap + free / (participants.length - 1);
  }

  participants.forEach((child, i) => {
    const sz = sizes[i];
    const mainPos = cursor;
    const extentCross = isRow ? sz.height : sz.width;
    let crossPos = crossPadStart;
    if (al.align === 'center') crossPos = crossPadStart + (innerCross - extentCross) / 2;
    else if (al.align === 'end') crossPos = crossPadStart + (innerCross - extentCross);
    // 'stretch' alignment is handled by the child opting into 'fill' in its cross-axis mode.

    const childT: Transform = {
      x: myT.x + (isRow ? mainPos : crossPos),
      y: myT.y + (isRow ? crossPos : mainPos),
      width: sz.width,
      height: sz.height,
      rotation: child.transform.rotation,
    };
    descend(child, childT, out);
    cursor += (isRow ? sz.width : sz.height) + perGap;
  });

  // Non-participants: positioned by constraints + their own sizing modes against parent.
  const nonParticipants = frame.children.filter(
    (c) => c.visible && !(c.participatesInAutoLayout ?? true),
  );
  for (const child of nonParticipants) {
    const childT = positionFreeChild(child, myT);
    descend(child, childT, out);
  }
}

function layoutFreeChildren(frame: FrameNode, myT: Transform, out: LayoutMap) {
  for (const child of frame.children) {
    if (!child.visible) {
      out.set(child.id, {
        ...child.transform,
        x: myT.x + child.transform.x,
        y: myT.y + child.transform.y,
      });
      continue;
    }
    const childT = positionFreeChild(child, myT);
    descend(child, childT, out);
  }
}

function descend(child: SceneNode, childT: Transform, out: LayoutMap) {
  if (child.type === 'frame') {
    layoutFrame(child, childT, out);
  } else {
    out.set(child.id, childT);
  }
}

/** Resolve size + position for a child whose parent doesn't auto-layout it. */
function positionFreeChild(child: SceneNode, parent: Transform): Transform {
  const c = child.constraints;
  const t = child.transform;
  const parentInner: Size = { width: parent.width, height: parent.height };
  const size = resolveChildSize(child, parentInner);

  // Position anchor (constraints). Default = 'left' (use stored x).
  let x = t.x;
  let y = t.y;
  if (widthMode(child) === 'fill') {
    x = 0; // fill spans the whole parent on this axis
  } else if (c?.x === 'right') {
    x = parent.width - size.width;
  } else if (c?.x === 'center') {
    x = (parent.width - size.width) / 2;
  } else if (c?.x === 'stretch') {
    x = 0; // legacy
  }

  if (heightMode(child) === 'fill') {
    y = 0;
  } else if (c?.y === 'right') {
    y = parent.height - size.height;
  } else if (c?.y === 'center') {
    y = (parent.height - size.height) / 2;
  } else if (c?.y === 'stretch') {
    y = 0;
  }

  return {
    x: parent.x + x,
    y: parent.y + y,
    width: size.width,
    height: size.height,
    rotation: t.rotation,
  };
}

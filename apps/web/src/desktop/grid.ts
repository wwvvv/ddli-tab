/**
 * M2 grid primitives. IDs refer to placements, never to entity definitions.
 * No DOM, storage, cloud calls, implicit persistence or responsive write-back.
 */
export type GridSize = Readonly<{ columns: number; rows: number }>;
export type GridSpan = Readonly<{ width: number; height: number }>;
export type GridPosition = Readonly<{ column: number; row: number }>;
export type GridRect = GridSpan & GridPosition;
export type GridPlacement = GridRect & Readonly<{ placementId: string }>;
export type GridEntry = GridSpan & Readonly<{ placementId: string }>;
export type GridErrorCode =
  | 'INVALID_GRID'
  | 'INVALID_PLACEMENT'
  | 'UNSUPPORTED_SPAN'
  | 'OUT_OF_BOUNDS'
  | 'DUPLICATE_ID'
  | 'OVERLAP'
  | 'NOT_FOUND'
  | 'GRID_FULL';

export class GridError extends Error {
  readonly code: GridErrorCode;
  readonly placementId?: string;

  constructor(code: GridErrorCode, placementId?: string) {
    super(`Desktop grid: ${code}`);
    this.name = 'GridError';
    this.code = code;
    this.placementId = placementId;
  }
}

// Defensive per-page limits, not a cloud quota or a total desktop item limit.
const MAX_COLUMNS = 24;
const MAX_ROWS = 128;
const spans = new Set(['1x1', '2x2', '4x2', '4x4']);

function checkSize(size: GridSize): void {
  if (
    !size || !Number.isInteger(size.columns) || !Number.isInteger(size.rows) ||
    size.columns < 1 || size.columns > MAX_COLUMNS || size.rows < 1 || size.rows > MAX_ROWS
  ) throw new GridError('INVALID_GRID');
}

function checkSpan(span: GridSpan, size: GridSize): void {
  if (!span || !spans.has(`${span.width}x${span.height}`) ||
    !Number.isInteger(span.width) || !Number.isInteger(span.height))
    throw new GridError('UNSUPPORTED_SPAN');
  if (span.width > size.columns || span.height > size.rows)
    throw new GridError('OUT_OF_BOUNDS');
}

function checkId(id: string): void {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id))
    throw new GridError('INVALID_PLACEMENT');
}

function checkRect(item: GridPlacement, size: GridSize): void {
  if (!item) throw new GridError('INVALID_PLACEMENT');
  checkId(item.placementId);
  checkSpan(item, size);
  if (
    !Number.isInteger(item.column) || !Number.isInteger(item.row) ||
    item.column < 0 || item.row < 0 ||
    item.column + item.width > size.columns || item.row + item.height > size.rows
  ) throw new GridError('OUT_OF_BOUNDS', item.placementId);
}

function cells(rect: GridRect, columns: number): number[] {
  const result: number[] = [];
  for (let row = rect.row; row < rect.row + rect.height; row++)
    for (let column = rect.column; column < rect.column + rect.width; column++)
      result.push(row * columns + column);
  return result;
}

function occupy(rect: GridRect, size: GridSize, occupied: Set<number>): void {
  for (const cell of cells(rect, size.columns)) occupied.add(cell);
}

function occupancy(size: GridSize, items: readonly GridPlacement[]): Set<number> {
  checkSize(size);
  if (!Array.isArray(items)) throw new GridError('INVALID_PLACEMENT');
  if (items.length > size.columns * size.rows) throw new GridError('GRID_FULL');
  const occupied = new Set<number>();
  const ids = new Set<string>();
  for (const item of items) {
    checkRect(item, size);
    if (ids.has(item.placementId)) throw new GridError('DUPLICATE_ID', item.placementId);
    ids.add(item.placementId);
    if (cells(item, size.columns).some((cell) => occupied.has(cell)))
      throw new GridError('OVERLAP', item.placementId);
    occupy(item, size, occupied);
  }
  return occupied;
}

function firstVacancy(size: GridSize, occupied: Set<number>, span: GridSpan): GridRect | null {
  for (let row = 0; row <= size.rows - span.height; row++) {
    for (let column = 0; column <= size.columns - span.width; column++) {
      const rect = { column, row, width: span.width, height: span.height };
      if (cells(rect, size.columns).every((cell) => !occupied.has(cell))) return rect;
    }
  }
  return null;
}

/** Reject malformed layouts instead of moving, clipping or dropping user items. */
export function validateGrid(size: GridSize, items: readonly GridPlacement[]): void {
  occupancy(size, items);
}

/** Top-to-bottom, then left-to-right; deterministic for the same inputs. */
export function findVacancy(
  size: GridSize,
  items: readonly GridPlacement[],
  span: GridSpan,
): GridRect | null {
  const occupied = occupancy(size, items);
  checkSpan(span, size);
  return firstVacancy(size, occupied, span);
}

/** Adds a placement only. Creating/editing an entity belongs to the command layer. */
export function insertPlacement(
  size: GridSize,
  items: readonly GridPlacement[],
  entry: GridEntry,
  position?: GridPosition,
): GridPlacement[] {
  const occupied = occupancy(size, items);
  if (!entry) throw new GridError('INVALID_PLACEMENT');
  checkId(entry.placementId);
  checkSpan(entry, size);
  if (items.some((item) => item.placementId === entry.placementId))
    throw new GridError('DUPLICATE_ID', entry.placementId);
  const rect = position === undefined ? firstVacancy(size, occupied, entry) : position;
  if (!rect) throw new GridError('GRID_FULL', entry.placementId);
  const next = [
    ...items.map((item) => ({ ...item })),
    { placementId: entry.placementId, width: entry.width, height: entry.height,
      column: rect.column, row: rect.row },
  ];
  validateGrid(size, next);
  return next;
}

/** Validates the whole result before returning; a failed move leaves input untouched. */
export function movePlacement(
  size: GridSize,
  items: readonly GridPlacement[],
  placementId: string,
  position: GridPosition,
): GridPlacement[] {
  validateGrid(size, items);
  checkId(placementId);
  if (!position) throw new GridError('INVALID_PLACEMENT', placementId);
  if (!items.some((item) => item.placementId === placementId))
    throw new GridError('NOT_FOUND', placementId);
  const next = items.map((item) => item.placementId === placementId
    ? { ...item, column: position.column, row: position.row } : { ...item });
  validateGrid(size, next);
  return next;
}

/** Does not delete entities or compact other placements. */
export function removePlacement(
  size: GridSize,
  items: readonly GridPlacement[],
  placementId: string,
): GridPlacement[] {
  validateGrid(size, items);
  checkId(placementId);
  if (!items.some((item) => item.placementId === placementId))
    throw new GridError('NOT_FOUND', placementId);
  return items.filter((item) => item.placementId !== placementId).map((item) => ({ ...item }));
}

/**
 * Explicit first-fit preview in input order, NOT a globally optimal bin packer.
 * A full page throws; it never returns a partial layout or shrinks a widget.
 * Callers retain their original/breakpoint layout and must explicitly commit a preview.
 */
export function packGrid(size: GridSize, entries: readonly GridEntry[]): GridPlacement[] {
  checkSize(size);
  if (!Array.isArray(entries)) throw new GridError('INVALID_PLACEMENT');
  if (entries.length > size.columns * size.rows) throw new GridError('GRID_FULL');
  const occupied = new Set<number>();
  const ids = new Set<string>();
  const result: GridPlacement[] = [];
  for (const entry of entries) {
    if (!entry) throw new GridError('INVALID_PLACEMENT');
    checkId(entry.placementId);
    checkSpan(entry, size);
    if (ids.has(entry.placementId)) throw new GridError('DUPLICATE_ID', entry.placementId);
    ids.add(entry.placementId);
    const rect = firstVacancy(size, occupied, entry);
    if (!rect) throw new GridError('GRID_FULL', entry.placementId);
    occupy(rect, size, occupied);
    result.push({ placementId: entry.placementId, ...rect });
  }
  return result;
}

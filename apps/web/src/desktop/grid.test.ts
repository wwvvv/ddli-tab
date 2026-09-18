import assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  GridError, findVacancy, insertPlacement, movePlacement, packGrid,
  removePlacement, validateGrid, type GridPlacement, type GridSize,
} from './grid';

const size = { columns: 4, rows: 4 };
const unit = (placementId: string, column = 0, row = 0): GridPlacement =>
  ({ placementId, column, row, width: 1, height: 1 });
function error(code: GridError['code']) {
  return (value: unknown) => value instanceof GridError && value.code === code;
}
function freeze(items: GridPlacement[]): readonly GridPlacement[] {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

it('accepts an empty page and all four supported spans', () => {
  validateGrid(size, []);
  for (const [width, height] of [[1, 1], [2, 2], [4, 2], [4, 4]]) {
    const output = packGrid(size, [{ placementId: 'widget', width, height }]);
    assert.deepEqual(output, [{ placementId: 'widget', width, height, column: 0, row: 0 }]);
    validateGrid(size, output);
  }
});
for (const invalid of [
  { columns: 0, rows: 4 }, { columns: 25, rows: 4 }, { columns: 4, rows: 129 },
  { columns: 4, rows: -1 }, { columns: 3.5, rows: 4 }, { columns: NaN, rows: 4 },
  { columns: 4, rows: Infinity }, null,
]) {
  it(`rejects malformed grid ${JSON.stringify(invalid)}`, () => {
    assert.throws(() => validateGrid(invalid as GridSize, []), error('INVALID_GRID'));
  });
}
for (const [width, height] of [[0, 1], [-1, 1], [1.5, 1], [3, 2], [1, 2], [NaN, 1]]) {
  it(`rejects unsupported span ${width}x${height}`, () => {
    assert.throws(() => packGrid(size, [{ placementId: 'x', width, height }]), error('UNSUPPORTED_SPAN'));
  });
}
for (const position of [
  { column: -1, row: 0 }, { column: 0, row: -1 }, { column: 4, row: 0 },
  { column: 0, row: 4 }, { column: 0.1, row: 0 }, { column: NaN, row: 0 },
  { column: 0, row: Infinity },
]) {
  it(`rejects out-of-bounds/non-integer position ${JSON.stringify(position)}`, () => {
    assert.throws(() => validateGrid(size, [{ ...unit('x'), ...position }]), error('OUT_OF_BOUNDS'));
  });
}
it('does not clip a widget crossing the right or bottom edge', () => {
  for (const [column, row] of [[3, 0], [0, 3]])
    assert.throws(() => validateGrid(size, [{ placementId: 'widget', width: 2, height: 2, column, row }]), error('OUT_OF_BOUNDS'));
});
it('a widget wider than a mobile grid fails rather than shrinking', () => {
  assert.throws(() => packGrid({ columns: 3, rows: 4 }, [{ placementId: 'widget', width: 4, height: 2 }]), error('OUT_OF_BOUNDS'));
});
it('rejects duplicate placement IDs, even in different cells', () => {
  assert.throws(() => validateGrid(size, [unit('x'), unit('x', 1)]), error('DUPLICATE_ID'));
  assert.throws(() => packGrid(size, [unit('x'), unit('x')]), error('DUPLICATE_ID'));
});
it('rejects malformed IDs and null items without interpolating their content in messages', () => {
  for (const placementId of ['', 'a/b', '__proto__', 'a'.repeat(129)])
    assert.throws(() => validateGrid(size, [unit(placementId)]), error('INVALID_PLACEMENT'));
  assert.throws(() => validateGrid(size, [null] as unknown as GridPlacement[]), error('INVALID_PLACEMENT'));
  assert.throws(() => packGrid(size, null as unknown as GridPlacement[]), error('INVALID_PLACEMENT'));
});
it('detects partial widget overlap, not only equal starting cells', () => {
  const items = [{ placementId: 'widget', width: 2, height: 2, column: 0, row: 0 }, unit('x', 1, 1)];
  assert.throws(() => validateGrid(size, items), error('OVERLAP'));
});
it('allows touching edges and uses half-open grid rectangles', () => {
  validateGrid(size, [
    { placementId: 'left', width: 2, height: 2, column: 0, row: 0 },
    { placementId: 'right', width: 2, height: 2, column: 2, row: 0 },
  ]);
});
it('finds holes in row-major order without moving existing placements', () => {
  const items = freeze([unit('one'), unit('three', 2), unit('next-row', 0, 1)]);
  assert.deepEqual(findVacancy(size, items, { width: 1, height: 1 }),
    { column: 1, row: 0, width: 1, height: 1 });
  assert.deepEqual(items[1], unit('three', 2));
});
it('finds a whole free widget rectangle instead of checking only its anchor', () => {
  assert.deepEqual(findVacancy(size, [unit('blocked', 1, 1)], { width: 2, height: 2 }),
    { column: 2, row: 0, width: 2, height: 2 });
});
it('a full grid returns null and insertion throws GRID_FULL', () => {
  const full = freeze(packGrid({ columns: 2, rows: 2 }, [unit('a'), unit('b'), unit('c'), unit('d')]));
  assert.equal(findVacancy({ columns: 2, rows: 2 }, full, { width: 1, height: 1 }), null);
  assert.throws(() => insertPlacement({ columns: 2, rows: 2 }, full, unit('e')), error('GRID_FULL'));
});
it('inserts into the first vacancy or an explicitly requested free cell', () => {
  const input = freeze([unit('a')]);
  assert.deepEqual(insertPlacement(size, input, unit('b')), [unit('a'), unit('b', 1)]);
  assert.deepEqual(insertPlacement(size, input, unit('b'), { column: 3, row: 2 }), [unit('a'), unit('b', 3, 2)]);
  assert.deepEqual(input, [unit('a')]);
});
it('invalid/duplicate/colliding inserts never modify the original page', () => {
  const input = freeze([unit('a')]);
  assert.throws(() => insertPlacement(size, input, unit('a')), error('DUPLICATE_ID'));
  assert.throws(() => insertPlacement(size, input, unit('b'), { column: 0, row: 0 }), error('OVERLAP'));
  assert.deepEqual(input, [unit('a')]);
});
it('moves within its old footprint without colliding with itself', () => {
  const input = freeze([{ placementId: 'widget', column: 0, row: 0, width: 2, height: 2 }]);
  const next = movePlacement(size, input, 'widget', { column: 1, row: 0 });
  assert.equal(next[0].column, 1);
  assert.equal(input[0].column, 0);
});
it('same-position moves are valid and return detached objects', () => {
  const input = freeze([unit('a')]);
  const next = movePlacement(size, input, 'a', { column: 0, row: 0 });
  assert.deepEqual(next, input);
  assert.notEqual(next[0], input[0]);
});
it('colliding or invalid moves leave every placement unchanged', () => {
  const input = freeze([unit('a'), unit('b', 1)]);
  assert.throws(() => movePlacement(size, input, 'a', { column: 1, row: 0 }), error('OVERLAP'));
  assert.throws(() => movePlacement(size, input, 'a', { column: -1, row: 0 }), error('OUT_OF_BOUNDS'));
  assert.throws(() => movePlacement(size, input, 'missing', { column: 2, row: 0 }), error('NOT_FOUND'));
  assert.deepEqual(input, [unit('a'), unit('b', 1)]);
});
it('removal does not compact other placements or remove another placement of an entity', () => {
  const input = freeze([unit('entity-desktop'), unit('entity-other-placement', 3, 3)]);
  assert.deepEqual(removePlacement(size, input, 'entity-desktop'), [unit('entity-other-placement', 3, 3)]);
  assert.equal(input.length, 2);
  assert.throws(() => removePlacement(size, input, 'missing'), error('NOT_FOUND'));
});
it('a pack is deterministic, stable in source order, and copies its input', () => {
  const entries = freeze([unit('a'), { placementId: 'widget', column: 0, row: 2, width: 2, height: 2 }, unit('b')]);
  const first = packGrid(size, entries);
  assert.deepEqual(first, packGrid(size, entries));
  assert.deepEqual(first.map((item) => item.placementId), ['a', 'widget', 'b']);
  assert.deepEqual(first.map(({ column, row }) => [column, row]), [[0, 0], [1, 0], [3, 0]]);
  assert.equal(entries[1].row, 2);
});
it('packing can fail on fragmentation even when total free area is sufficient', () => {
  const entries = freeze([unit('a'), unit('b'), unit('c'), { placementId: 'widget', column: 0, row: 0, width: 2, height: 2 }]);
  assert.throws(() => packGrid({ columns: 3, rows: 3 }, [
    ...entries.slice(0, 3), unit('d'), unit('e'), entries[3],
  ]), error('GRID_FULL'));
  assert.equal(entries.length, 4);
});
it('mobile and desktop projections do not overwrite one another', () => {
  const entries = freeze(Array.from({ length: 8 }, (_, index) => unit(`p${index}`)));
  const desktop = freeze(packGrid({ columns: 8, rows: 2 }, entries));
  const before = JSON.stringify(desktop);
  const mobile = packGrid({ columns: 4, rows: 4 }, desktop);
  assert.equal(mobile[4].row, 1);
  assert.equal(desktop[4].row, 0);
  assert.equal(JSON.stringify(desktop), before);
  mobile[0] = { ...mobile[0], column: 2 };
  assert.equal(desktop[0].column, 0);
});
it('first vacancy agrees with an independent cell oracle for every 3x3 occupancy mask', () => {
  const small = { columns: 3, rows: 3 };
  for (let mask = 0; mask < 512; mask++) {
    const input: GridPlacement[] = [];
    for (let cell = 0; cell < 9; cell++)
      if ((mask & (1 << cell)) !== 0) input.push(unit(`p${cell}`, cell % 3, Math.floor(cell / 3)));
    for (const span of [{ width: 1, height: 1 }, { width: 2, height: 2 }]) {
      const candidates: Array<{ column: number; row: number } & typeof span> = [];
      for (let row = 0; row <= 3 - span.height; row++) {
        for (let column = 0; column <= 3 - span.width; column++) {
          let free = true;
          for (let dy = 0; dy < span.height; dy++)
            for (let dx = 0; dx < span.width; dx++)
              if (mask & (1 << ((row + dy) * 3 + column + dx))) free = false;
          if (free) candidates.push({ column, row, ...span });
        }
      }
      assert.deepEqual(findVacancy(small, input, span), candidates[0] ?? null);
    }
  }
});
it('all public operations refuse an already corrupt layout, including delete', () => {
  const invalid = freeze([unit('a'), unit('b')]);
  for (const operation of [
    () => findVacancy(size, invalid, { width: 1, height: 1 }),
    () => insertPlacement(size, invalid, unit('c')),
    () => movePlacement(size, invalid, 'b', { column: 2, row: 0 }),
    () => removePlacement(size, invalid, 'b'),
  ]) assert.throws(operation, error('OVERLAP'));
});

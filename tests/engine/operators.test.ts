/**
 * Unit tests for matrix operators
 */

import { describe, it, expect } from 'vitest';
import {
  scale,
  group_neutralize,
  rank,
  zscore,
} from '../../src/engine/operators.js';
import { createMatrix, Matrix } from '../../src/engine/ast.js';

describe('Cross-Sectional Operators', () => {
  describe('scale()', () => {
    it('normalizes so sum(|values|) = 1 for simple case', () => {
      const x = createMatrix(1, 3);
      x.data[0] = 1;
      x.data[1] = 2;
      x.data[2] = 3;

      const result = scale(x);

      // After demeaning: [-1, 0, 1]
      // sum(|values|) = 1 + 0 + 1 = 2
      // After scaling: [-0.5, 0, 0.5]
      expect(result.data[0]).toBeCloseTo(-0.5, 10);
      expect(result.data[1]).toBeCloseTo(0, 10);
      expect(result.data[2]).toBeCloseTo(0.5, 10);

      // Verify sum(|values|) = 1
      const sumAbs = Math.abs(result.data[0]) + Math.abs(result.data[1]) + Math.abs(result.data[2]);
      expect(sumAbs).toBeCloseTo(1, 10);
    });

    it('handles all NaN case', () => {
      const x = createMatrix(1, 3);
      x.data[0] = NaN;
      x.data[1] = NaN;
      x.data[2] = NaN;

      const result = scale(x);

      expect(isNaN(result.data[0])).toBe(true);
      expect(isNaN(result.data[1])).toBe(true);
      expect(isNaN(result.data[2])).toBe(true);
    });

    it('handles all zero after demeaning (all equal values)', () => {
      const x = createMatrix(1, 3);
      x.data[0] = 5;
      x.data[1] = 5;
      x.data[2] = 5;

      const result = scale(x);

      // All equal -> after demeaning all are 0
      // Should return all zeros
      expect(result.data[0]).toBe(0);
      expect(result.data[1]).toBe(0);
      expect(result.data[2]).toBe(0);
    });

    it('handles mixed NaN values', () => {
      const x = createMatrix(1, 4);
      x.data[0] = 1;
      x.data[1] = NaN;
      x.data[2] = 3;
      x.data[3] = NaN;

      const result = scale(x);

      // Valid values: 1, 3
      // Mean: 2
      // After demeaning: [-1, _, 1, _]
      // sum(|values|) = 2
      // After scaling: [-0.5, _, 0.5, _]
      expect(result.data[0]).toBeCloseTo(-0.5, 10);
      expect(isNaN(result.data[1])).toBe(true);
      expect(result.data[2]).toBeCloseTo(0.5, 10);
      expect(isNaN(result.data[3])).toBe(true);
    });

    it('processes each day independently', () => {
      const x = createMatrix(2, 2);
      // Day 0: [1, 2]
      x.data[0] = 1;
      x.data[1] = 2;
      // Day 1: [10, 20]
      x.data[2] = 10;
      x.data[3] = 20;

      const result = scale(x);

      // Day 0: mean = 1.5, demeaned = [-0.5, 0.5], sum|.| = 1, scaled = [-0.5, 0.5]
      expect(result.data[0]).toBeCloseTo(-0.5, 10);
      expect(result.data[1]).toBeCloseTo(0.5, 10);

      // Day 1: mean = 15, demeaned = [-5, 5], sum|.| = 10, scaled = [-0.5, 0.5]
      expect(result.data[2]).toBeCloseTo(-0.5, 10);
      expect(result.data[3]).toBeCloseTo(0.5, 10);
    });

    it('handles single valid value', () => {
      const x = createMatrix(1, 3);
      x.data[0] = NaN;
      x.data[1] = 42;
      x.data[2] = NaN;

      const result = scale(x);

      // Single value: mean = 42, demeaned = 0, sum|.| = 0
      // Should return 0
      expect(isNaN(result.data[0])).toBe(true);
      expect(result.data[1]).toBe(0);
      expect(isNaN(result.data[2])).toBe(true);
    });
  });

  describe('group_neutralize()', () => {
    it('subtracts group mean within each sector', () => {
      const x = createMatrix(1, 4);
      x.data[0] = 10;
      x.data[1] = 20;
      x.data[2] = 100;
      x.data[3] = 200;

      const groups = createMatrix(1, 4);
      groups.data[0] = 1; // Group 1
      groups.data[1] = 1; // Group 1
      groups.data[2] = 2; // Group 2
      groups.data[3] = 2; // Group 2

      const result = group_neutralize(x, groups);

      // Group 1: mean = (10 + 20) / 2 = 15
      expect(result.data[0]).toBeCloseTo(10 - 15, 10); // -5
      expect(result.data[1]).toBeCloseTo(20 - 15, 10); // 5

      // Group 2: mean = (100 + 200) / 2 = 150
      expect(result.data[2]).toBeCloseTo(100 - 150, 10); // -50
      expect(result.data[3]).toBeCloseTo(200 - 150, 10); // 50

      // Verify group means are approximately 0
      const group1Mean = (result.data[0] + result.data[1]) / 2;
      const group2Mean = (result.data[2] + result.data[3]) / 2;
      expect(group1Mean).toBeCloseTo(0, 10);
      expect(group2Mean).toBeCloseTo(0, 10);
    });

    it('handles all NaN in a group', () => {
      const x = createMatrix(1, 4);
      x.data[0] = NaN;
      x.data[1] = NaN;
      x.data[2] = 100;
      x.data[3] = 200;

      const groups = createMatrix(1, 4);
      groups.data[0] = 1;
      groups.data[1] = 1;
      groups.data[2] = 2;
      groups.data[3] = 2;

      const result = group_neutralize(x, groups);

      // Group 1: all NaN -> output NaN
      expect(isNaN(result.data[0])).toBe(true);
      expect(isNaN(result.data[1])).toBe(true);

      // Group 2: works normally
      expect(result.data[2]).toBeCloseTo(-50, 10);
      expect(result.data[3]).toBeCloseTo(50, 10);
    });

    it('handles single stock in a group', () => {
      const x = createMatrix(1, 3);
      x.data[0] = 10;
      x.data[1] = 20;
      x.data[2] = 100;

      const groups = createMatrix(1, 3);
      groups.data[0] = 1;
      groups.data[1] = 1;
      groups.data[2] = 2; // Single stock in group 2

      const result = group_neutralize(x, groups);

      // Group 1: mean = 15
      expect(result.data[0]).toBeCloseTo(-5, 10);
      expect(result.data[1]).toBeCloseTo(5, 10);

      // Group 2: single stock -> mean = 100 -> result = 100 - 100 = 0
      expect(result.data[2]).toBeCloseTo(0, 10);
    });

    it('handles mixed NaN values', () => {
      const x = createMatrix(1, 5);
      x.data[0] = 10;
      x.data[1] = NaN;
      x.data[2] = 20;
      x.data[3] = 100;
      x.data[4] = NaN;

      const groups = createMatrix(1, 5);
      groups.data[0] = 1;
      groups.data[1] = 1;
      groups.data[2] = 1;
      groups.data[3] = 2;
      groups.data[4] = 2;

      const result = group_neutralize(x, groups);

      // Group 1: valid values are 10, 20 (NaN excluded)
      // Mean = 15
      expect(result.data[0]).toBeCloseTo(-5, 10);
      expect(isNaN(result.data[1])).toBe(true);
      expect(result.data[2]).toBeCloseTo(5, 10);

      // Group 2: only one valid value (100)
      // Mean = 100
      expect(result.data[3]).toBeCloseTo(0, 10);
      expect(isNaN(result.data[4])).toBe(true);
    });

    it('handles NaN group labels', () => {
      const x = createMatrix(1, 4);
      x.data[0] = 10;
      x.data[1] = 20;
      x.data[2] = 30;
      x.data[3] = 40;

      const groups = createMatrix(1, 4);
      groups.data[0] = 1;
      groups.data[1] = NaN; // NaN group label
      groups.data[2] = 1;
      groups.data[3] = NaN; // NaN group label

      const result = group_neutralize(x, groups);

      // Group 1: stocks 0 and 2 -> mean = (10 + 30) / 2 = 20
      expect(result.data[0]).toBeCloseTo(-10, 10);
      expect(isNaN(result.data[1])).toBe(true);
      expect(result.data[2]).toBeCloseTo(10, 10);
      expect(isNaN(result.data[3])).toBe(true);
    });

    it('processes each day independently', () => {
      const x = createMatrix(2, 4);
      // Day 0
      x.data[0] = 10;
      x.data[1] = 20;
      x.data[2] = 100;
      x.data[3] = 200;
      // Day 1
      x.data[4] = 5;
      x.data[5] = 15;
      x.data[6] = 50;
      x.data[7] = 150;

      const groups = createMatrix(2, 4);
      // Same groups both days
      groups.data[0] = groups.data[4] = 1;
      groups.data[1] = groups.data[5] = 1;
      groups.data[2] = groups.data[6] = 2;
      groups.data[3] = groups.data[7] = 2;

      const result = group_neutralize(x, groups);

      // Day 0: Group 1 mean = 15, Group 2 mean = 150
      expect(result.data[0]).toBeCloseTo(-5, 10);
      expect(result.data[1]).toBeCloseTo(5, 10);
      expect(result.data[2]).toBeCloseTo(-50, 10);
      expect(result.data[3]).toBeCloseTo(50, 10);

      // Day 1: Group 1 mean = 10, Group 2 mean = 100
      expect(result.data[4]).toBeCloseTo(-5, 10);
      expect(result.data[5]).toBeCloseTo(5, 10);
      expect(result.data[6]).toBeCloseTo(-50, 10);
      expect(result.data[7]).toBeCloseTo(50, 10);
    });

    it('throws error for mismatched dimensions', () => {
      const x = createMatrix(2, 3);
      const groups = createMatrix(2, 4); // Different nStocks

      expect(() => group_neutralize(x, groups)).toThrow('Matrix dimensions must match');
    });
  });
});

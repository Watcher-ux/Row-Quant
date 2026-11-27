/**
 * Unit Tests for Cross-Sectional Operators (rank, zscore)
 *
 * Tests cross-sectional operators with comprehensive edge case coverage.
 */

import { describe, it, expect } from 'vitest';
import { rank, zscore } from '../../src/engine/operators';
import { createMatrix, Matrix } from '../../src/engine/ast';

// ============================================================================
// Helper Functions
// ============================================================================

function createMatrixFromData(data: number[][], nStocks: number): Matrix {
  const nDays = data.length;
  const matrix = createMatrix(nDays, nStocks);
  
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      matrix.data[t * nStocks + i] = data[t][i];
    }
  }
  
  return matrix;
}

function getMatrixRow(m: Matrix, day: number): number[] {
  const row: number[] = [];
  const offset = day * m.nStocks;
  for (let i = 0; i < m.nStocks; i++) {
    row.push(m.data[offset + i]);
  }
  return row;
}

function expectArrayClose(actual: number[], expected: number[], tolerance = 1e-10): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    if (isNaN(expected[i])) {
      expect(isNaN(actual[i])).toBe(true);
    } else {
      expect(Math.abs(actual[i] - expected[i])).toBeLessThan(tolerance);
    }
  }
}

// ============================================================================
// rank() Tests
// ============================================================================

describe('rank()', () => {
  it('should return values in [0, 1] for valid inputs', () => {
    const x = createMatrixFromData([[1, 2, 3, 4, 5]], 5);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // Expected: [0, 0.25, 0.5, 0.75, 1]
    expectArrayClose(row, [0, 0.25, 0.5, 0.75, 1]);
  });

  it('should assign 0.5 to a single valid value', () => {
    const x = createMatrixFromData([[42]], 1);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    expectArrayClose(row, [0.5]);
  });

  it('should handle tied values with average rank', () => {
    const x = createMatrixFromData([[1, 2, 2, 3]], 4);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // Ranks: 0 (index 0), 1 (index 1), 2 (index 2), 3 (index 3)
    // Ties at indices 1,2: average rank = (1+2)/2 = 1.5
    // Normalize: 0/(4-1)=0, 1.5/(4-1)=0.5, 1.5/(4-1)=0.5, 3/(4-1)=1
    expectArrayClose(row, [0, 0.5, 0.5, 1]);
  });

  it('should handle all equal values', () => {
    const x = createMatrixFromData([[5, 5, 5, 5]], 4);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // All tied: average rank = (0+1+2+3)/4 / (4-1) = 1.5/3 = 0.5
    expectArrayClose(row, [0.5, 0.5, 0.5, 0.5]);
  });

  it('should handle all NaN input', () => {
    const x = createMatrixFromData([[NaN, NaN, NaN]], 3);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // All NaN input -> all NaN output
    expect(row.every(v => isNaN(v))).toBe(true);
  });

  it('should preserve NaN positions from input', () => {
    const x = createMatrixFromData([[1, NaN, 3, NaN, 5]], 5);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // Valid values: 1, 3, 5 -> ranks 0, 0.5, 1
    expect(row[0]).toBeCloseTo(0);
    expect(isNaN(row[1])).toBe(true);
    expect(row[2]).toBeCloseTo(0.5);
    expect(isNaN(row[3])).toBe(true);
    expect(row[4]).toBeCloseTo(1);
  });

  it('should handle mixed NaN with single valid value', () => {
    const x = createMatrixFromData([[NaN, 42, NaN]], 3);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // Single valid value gets 0.5
    expect(isNaN(row[0])).toBe(true);
    expect(row[1]).toBeCloseTo(0.5);
    expect(isNaN(row[2])).toBe(true);
  });

  it('should be monotonic: x[i] < x[j] => rank(x)[i] <= rank(x)[j]', () => {
    const x = createMatrixFromData([[3, 1, 4, 1, 5]], 5);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    const inputRow = getMatrixRow(x, 0);
    
    // Check monotonicity
    for (let i = 0; i < row.length; i++) {
      for (let j = 0; j < row.length; j++) {
        if (!isNaN(inputRow[i]) && !isNaN(inputRow[j])) {
          if (inputRow[i] < inputRow[j]) {
            expect(row[i]).toBeLessThanOrEqual(row[j]);
          }
        }
      }
    }
  });

  it('should process each day independently', () => {
    const x = createMatrixFromData([
      [1, 2, 3],
      [3, 2, 1],
    ], 3);
    const result = rank(x);
    
    const row0 = getMatrixRow(result, 0);
    const row1 = getMatrixRow(result, 1);
    
    expectArrayClose(row0, [0, 0.5, 1]);
    expectArrayClose(row1, [1, 0.5, 0]);
  });

  it('should handle negative values', () => {
    const x = createMatrixFromData([[-2, -1, 0, 1, 2]], 5);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    expectArrayClose(row, [0, 0.25, 0.5, 0.75, 1]);
  });

  it('should handle two values', () => {
    const x = createMatrixFromData([[10, 20]], 2);
    const result = rank(x);
    const row = getMatrixRow(result, 0);
    
    // Two values: ranks 0 and 1
    expectArrayClose(row, [0, 1]);
  });
});

// ============================================================================
// zscore() Tests
// ============================================================================

describe('zscore()', () => {
  it('should compute z-score correctly', () => {
    const x = createMatrixFromData([[1, 2, 3, 4, 5]], 5);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Mean = 3, Std = sqrt((4+1+0+1+4)/5) = sqrt(2)
    // z-scores: (1-3)/sqrt(2), (2-3)/sqrt(2), 0, (4-3)/sqrt(2), (5-3)/sqrt(2)
    const std = Math.sqrt(2);
    expectArrayClose(row, [-2/std, -1/std, 0, 1/std, 2/std]);
  });

  it('should return 0 for all-equal rows', () => {
    const x = createMatrixFromData([[5, 5, 5, 5]], 4);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // All equal -> std = 0 -> return 0 for all
    expectArrayClose(row, [0, 0, 0, 0]);
  });

  it('should handle all NaN input', () => {
    const x = createMatrixFromData([[NaN, NaN, NaN]], 3);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // All NaN input -> all NaN output
    expect(row.every(v => isNaN(v))).toBe(true);
  });

  it('should preserve NaN positions from input', () => {
    const x = createMatrixFromData([[1, NaN, 3, NaN, 5]], 5);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Valid values: 1, 3, 5 -> mean = 3, std = sqrt((4+0+4)/3) = sqrt(8/3)
    const mean = 3;
    const std = Math.sqrt(8/3);
    
    expect(row[0]).toBeCloseTo((1 - mean) / std);
    expect(isNaN(row[1])).toBe(true);
    expect(row[2]).toBeCloseTo((3 - mean) / std);
    expect(isNaN(row[3])).toBe(true);
    expect(row[4]).toBeCloseTo((5 - mean) / std);
  });

  it('should ignore NaN in mean and std calculations', () => {
    const x = createMatrixFromData([[NaN, 2, 4, NaN]], 4);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Valid values: 2, 4 -> mean = 3, std = 1
    expect(isNaN(row[0])).toBe(true);
    expect(row[1]).toBeCloseTo(-1);
    expect(row[2]).toBeCloseTo(1);
    expect(isNaN(row[3])).toBe(true);
  });

  it('should handle single valid value', () => {
    const x = createMatrixFromData([[NaN, 42, NaN]], 3);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Single value -> std = 0 -> return 0
    expect(isNaN(row[0])).toBe(true);
    expect(row[1]).toBeCloseTo(0);
    expect(isNaN(row[2])).toBe(true);
  });

  it('should process each day independently', () => {
    const x = createMatrixFromData([
      [1, 2, 3],
      [10, 20, 30],
    ], 3);
    const result = zscore(x);
    
    const row0 = getMatrixRow(result, 0);
    const row1 = getMatrixRow(result, 1);
    
    // Day 0: mean = 2, std = sqrt(2/3)
    const std0 = Math.sqrt(2/3);
    expectArrayClose(row0, [-1/std0, 0, 1/std0]);
    
    // Day 1: mean = 20, std = sqrt(200/3)
    const std1 = Math.sqrt(200/3);
    expectArrayClose(row1, [-10/std1, 0, 10/std1]);
  });

  it('should handle negative values', () => {
    const x = createMatrixFromData([[-2, -1, 0, 1, 2]], 5);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Mean = 0, std = sqrt(10/5) = sqrt(2)
    const std = Math.sqrt(2);
    expectArrayClose(row, [-2/std, -1/std, 0, 1/std, 2/std]);
  });

  it('should handle two equal values', () => {
    const x = createMatrixFromData([[5, 5]], 2);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Two equal values -> std = 0 -> return 0
    expectArrayClose(row, [0, 0]);
  });

  it('should have zero mean for valid values', () => {
    const x = createMatrixFromData([[1, 2, 3, 4, 5]], 5);
    const result = zscore(x);
    const row = getMatrixRow(result, 0);
    
    // Sum of z-scores should be approximately 0
    const sum = row.reduce((acc, val) => acc + val, 0);
    expect(Math.abs(sum)).toBeLessThan(1e-10);
  });
});

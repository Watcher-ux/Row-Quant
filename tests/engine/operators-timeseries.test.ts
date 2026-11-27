/**
 * Unit Tests for Time-Series Operators
 */

import { describe, it, expect } from 'vitest';
import { createMatrix, getElement, setElement } from '../../src/engine/ast.js';
import { ts_delay, ts_delta, ts_mean, ts_sum, ts_std_dev, ts_rank, ts_decay_linear, ts_corr } from '../../src/engine/operators.js';

describe('ts_delay', () => {
  it('should return NaN for first d rows', () => {
    const x = createMatrix(5, 2);
    // Fill with sequential values
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_delay(x, 2);

    // First 2 rows should be NaN
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < 2; i++) {
        expect(isNaN(getElement(result, t, i))).toBe(true);
      }
    }
  });

  it('should shift values back by d days for t >= d', () => {
    const x = createMatrix(5, 2);
    // Fill with sequential values
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_delay(x, 2);

    // For t >= 2: result[t][i] should equal x[t-2][i]
    for (let t = 2; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        expect(getElement(result, t, i)).toBe(getElement(x, t - 2, i));
      }
    }
  });

  it('should preserve NaN values', () => {
    const x = createMatrix(5, 2);
    // Fill with values, include some NaN
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, t === 2 ? NaN : t * 10);
      setElement(x, t, 1, t * 10 + 1);
    }

    const result = ts_delay(x, 1);

    // result[3][0] should be NaN (from x[2][0])
    expect(isNaN(getElement(result, 3, 0))).toBe(true);
    // result[3][1] should be 21 (from x[2][1])
    expect(getElement(result, 3, 1)).toBe(21);
  });

  it('should maintain shift invariance property', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const d = 2;
    const result = ts_delay(x, d);

    // Verify: result[t] = x[t-d] for all t >= d
    for (let t = d; t < x.nDays; t++) {
      for (let i = 0; i < x.nStocks; i++) {
        expect(getElement(result, t, i)).toBe(getElement(x, t - d, i));
      }
    }
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    // Stock 1: [100, 200, 300, 400]
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (t + 1) * 100);
    }

    const result = ts_delay(x, 1);

    // First row is NaN
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 0, 1))).toBe(true);

    // Subsequent rows: each stock delayed independently
    expect(getElement(result, 1, 0)).toBe(10);
    expect(getElement(result, 1, 1)).toBe(100);
    expect(getElement(result, 2, 0)).toBe(20);
    expect(getElement(result, 2, 1)).toBe(200);
  });
});

describe('ts_delta', () => {
  it('should return NaN for first d rows', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_delta(x, 2);

    // First 2 rows should be NaN
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < 2; i++) {
        expect(isNaN(getElement(result, t, i))).toBe(true);
      }
    }
  });

  it('should compute x[t] - x[t-d] for t >= d', () => {
    const x = createMatrix(5, 2);
    // Fill with sequential values
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_delta(x, 2);

    // For t >= 2: result[t][i] = x[t][i] - x[t-2][i]
    for (let t = 2; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        const expected = getElement(x, t, i) - getElement(x, t - 2, i);
        expect(getElement(result, t, i)).toBe(expected);
      }
    }
  });

  it('should propagate NaN from either operand', () => {
    const x = createMatrix(5, 2);
    // Set values with NaN at different positions
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, NaN); // Current value NaN
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    setElement(x, 0, 1, NaN); // Past value NaN
    setElement(x, 1, 1, 20);
    setElement(x, 2, 1, 30);
    setElement(x, 3, 1, 40);
    setElement(x, 4, 1, 50);

    const result = ts_delta(x, 2);

    // result[2][0] = NaN - 10 = NaN (current is NaN)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
    // result[2][1] = 30 - NaN = NaN (past is NaN)
    expect(isNaN(getElement(result, 2, 1))).toBe(true);
    // result[3][0] = 40 - 20 = 20
    expect(getElement(result, 3, 0)).toBe(20);
  });

  it('should compute delta with d=1 correctly', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 15, 25, 20]
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 15);
    setElement(x, 2, 0, 25);
    setElement(x, 3, 0, 20);

    const result = ts_delta(x, 1);

    expect(isNaN(getElement(result, 0, 0))).toBe(true); // First row NaN
    expect(getElement(result, 1, 0)).toBe(5);   // 15 - 10
    expect(getElement(result, 2, 0)).toBe(10);  // 25 - 15
    expect(getElement(result, 3, 0)).toBe(-5);  // 20 - 25
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    // Stock 1: [100, 150, 200, 250]
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, 100 + t * 50);
    }

    const result = ts_delta(x, 1);

    expect(getElement(result, 1, 0)).toBe(10);  // 20 - 10
    expect(getElement(result, 1, 1)).toBe(50);  // 150 - 100
    expect(getElement(result, 2, 0)).toBe(10);  // 30 - 20
    expect(getElement(result, 2, 1)).toBe(50);  // 200 - 150
  });
});

describe('ts_mean', () => {
  it('should return NaN when window has fewer than d valid values', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_mean(x, 3);

    // First 2 rows have windows [0], [0,1] with < 3 values
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should compute mean of last d values when available', () => {
    const x = createMatrix(5, 2);
    // Stock 0: [10, 20, 30, 40, 50]
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (t + 1) * 100);
    }

    const result = ts_mean(x, 3);

    // result[2][0] = mean([10, 20, 30]) = 20
    expect(getElement(result, 2, 0)).toBe(20);
    // result[3][0] = mean([20, 30, 40]) = 30
    expect(getElement(result, 3, 0)).toBe(30);
    // result[4][0] = mean([30, 40, 50]) = 40
    expect(getElement(result, 4, 0)).toBe(40);
  });

  it('should ignore NaN values but require d valid values', () => {
    const x = createMatrix(5, 2);
    // Window [0,1,2] has values [10, NaN, 30] - only 2 valid, needs 3
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_mean(x, 3);

    // result[2][0] should be NaN (only 2 valid values in window)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
    // result[3][0] = mean([30, 40]) but needs 3, so NaN
    expect(isNaN(getElement(result, 3, 0))).toBe(true);
    // result[4][0] = mean([30, 40, 50]) = 40
    expect(getElement(result, 4, 0)).toBe(40);
  });

  it('should compute rolling mean correctly with d=2', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);

    const result = ts_mean(x, 2);

    expect(isNaN(getElement(result, 0, 0))).toBe(true); // Window [10] - only 1 value
    expect(getElement(result, 1, 0)).toBe(15);  // mean([10, 20])
    expect(getElement(result, 2, 0)).toBe(25);  // mean([20, 30])
    expect(getElement(result, 3, 0)).toBe(35);  // mean([30, 40])
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    // Stock 1: [100, 200, 300, 400]
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (t + 1) * 100);
    }

    const result = ts_mean(x, 2);

    expect(getElement(result, 1, 0)).toBe(15);   // mean([10, 20])
    expect(getElement(result, 1, 1)).toBe(150);  // mean([100, 200])
    expect(getElement(result, 2, 0)).toBe(25);   // mean([20, 30])
    expect(getElement(result, 2, 1)).toBe(250);  // mean([200, 300])
  });

  it('should handle all-NaN window correctly', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, NaN);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, NaN);
    setElement(x, 3, 0, 40);

    const result = ts_mean(x, 3);

    // result[2][0] should be NaN (all values in window are NaN)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
  });

  it('should compute mean with d=1 (identity for single value)', () => {
    const x = createMatrix(3, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);

    const result = ts_mean(x, 1);

    // Each value should equal itself
    expect(getElement(result, 0, 0)).toBe(10);
    expect(getElement(result, 1, 0)).toBe(20);
    expect(getElement(result, 2, 0)).toBe(30);
  });
});

describe('ts_sum', () => {
  it('should return NaN when window has fewer than d valid values', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_sum(x, 3);

    // First 2 rows have windows [0], [0,1] with < 3 values
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should compute sum of last d values when available', () => {
    const x = createMatrix(5, 2);
    // Stock 0: [10, 20, 30, 40, 50]
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (t + 1) * 100);
    }

    const result = ts_sum(x, 3);

    // result[2][0] = sum([10, 20, 30]) = 60
    expect(getElement(result, 2, 0)).toBe(60);
    // result[3][0] = sum([20, 30, 40]) = 90
    expect(getElement(result, 3, 0)).toBe(90);
    // result[4][0] = sum([30, 40, 50]) = 120
    expect(getElement(result, 4, 0)).toBe(120);
  });

  it('should ignore NaN values but require d valid values', () => {
    const x = createMatrix(5, 2);
    // Window [0,1,2] has values [10, NaN, 30] - only 2 valid, needs 3
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_sum(x, 3);

    // result[2][0] should be NaN (only 2 valid values in window)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
    // result[3][0] = only 2 valid values in window [NaN, 30, 40]
    expect(isNaN(getElement(result, 3, 0))).toBe(true);
    // result[4][0] = sum([30, 40, 50]) = 120
    expect(getElement(result, 4, 0)).toBe(120);
  });

  it('should compute rolling sum correctly with d=2', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);

    const result = ts_sum(x, 2);

    expect(isNaN(getElement(result, 0, 0))).toBe(true); // Window [10] - only 1 value
    expect(getElement(result, 1, 0)).toBe(30);  // sum([10, 20])
    expect(getElement(result, 2, 0)).toBe(50);  // sum([20, 30])
    expect(getElement(result, 3, 0)).toBe(70);  // sum([30, 40])
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    // Stock 1: [100, 200, 300, 400]
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (t + 1) * 100);
    }

    const result = ts_sum(x, 2);

    expect(getElement(result, 1, 0)).toBe(30);   // sum([10, 20])
    expect(getElement(result, 1, 1)).toBe(300);  // sum([100, 200])
    expect(getElement(result, 2, 0)).toBe(50);   // sum([20, 30])
    expect(getElement(result, 2, 1)).toBe(500);  // sum([200, 300])
  });

  it('should compute sum with d=1 (identity for single value)', () => {
    const x = createMatrix(3, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);

    const result = ts_sum(x, 1);

    // Each value should equal itself
    expect(getElement(result, 0, 0)).toBe(10);
    expect(getElement(result, 1, 0)).toBe(20);
    expect(getElement(result, 2, 0)).toBe(30);
  });
});

describe('ts_std_dev', () => {
  it('should return NaN when window has fewer than d valid values', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_std_dev(x, 3);

    // First 2 rows have windows [0], [0,1] with < 3 values
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should compute population standard deviation correctly', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);

    const result = ts_std_dev(x, 3);

    // result[2][0] = std([10, 20, 30])
    // mean = 20, squared diffs = [100, 0, 100], variance = 200/3, std = sqrt(200/3)
    const expected = Math.sqrt(200 / 3);
    expect(getElement(result, 2, 0)).toBeCloseTo(expected, 10);

    // result[3][0] = std([20, 30, 40])
    // mean = 30, squared diffs = [100, 0, 100], variance = 200/3, std = sqrt(200/3)
    expect(getElement(result, 3, 0)).toBeCloseTo(expected, 10);
  });

  it('should return 0 for all-equal values in window', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 10);
    setElement(x, 2, 0, 10);
    setElement(x, 3, 0, 20);

    const result = ts_std_dev(x, 3);

    // result[2][0] = std([10, 10, 10]) = 0
    expect(getElement(result, 2, 0)).toBe(0);
  });

  it('should ignore NaN values but require d valid values', () => {
    const x = createMatrix(5, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_std_dev(x, 3);

    // result[2][0] should be NaN (only 2 valid values in window)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
    // result[4][0] = std([30, 40, 50])
    // mean = 40, squared diffs = [100, 0, 100], variance = 200/3, std = sqrt(200/3)
    expect(getElement(result, 4, 0)).toBeCloseTo(Math.sqrt(200 / 3), 10);
  });

  it('should compute std with d=1 (always 0)', () => {
    const x = createMatrix(3, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);

    const result = ts_std_dev(x, 1);

    // Standard deviation of a single value is 0
    expect(getElement(result, 0, 0)).toBe(0);
    expect(getElement(result, 1, 0)).toBe(0);
    expect(getElement(result, 2, 0)).toBe(0);
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40]
    // Stock 1: [100, 100, 100, 100]
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, 100);
    }

    const result = ts_std_dev(x, 3);

    // Stock 0: std([10, 20, 30]) = sqrt(200/3)
    expect(getElement(result, 2, 0)).toBeCloseTo(Math.sqrt(200 / 3), 10);
    // Stock 1: std([100, 100, 100]) = 0
    expect(getElement(result, 2, 1)).toBe(0);
  });

  it('should compute std with d=2 correctly', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);

    const result = ts_std_dev(x, 2);

    expect(isNaN(getElement(result, 0, 0))).toBe(true); // Window [10] - only 1 value
    // result[1][0] = std([10, 20]) = mean=15, variance=(25+25)/2=25, std=5
    expect(getElement(result, 1, 0)).toBe(5);
    // result[2][0] = std([20, 30]) = mean=25, variance=(25+25)/2=25, std=5
    expect(getElement(result, 2, 0)).toBe(5);
  });
});

describe('ts_rank', () => {
  it('should return NaN when window has fewer than d valid values', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, t * 10 + i);
      }
    }

    const result = ts_rank(x, 3);

    // First 2 rows have windows [0], [0,1] with < 3 values
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should return rank in [0, 1] for sufficient data', () => {
    const x = createMatrix(5, 2);
    // Stock 0: [10, 20, 30, 40, 50] - increasing
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, (t + 1) * 10);
    }

    const result = ts_rank(x, 3);

    // result[2][0] = rank of 30 in [10, 20, 30] = 2/2 = 1.0 (highest)
    expect(getElement(result, 2, 0)).toBe(1.0);
    // result[3][0] = rank of 40 in [20, 30, 40] = 2/2 = 1.0 (highest)
    expect(getElement(result, 3, 0)).toBe(1.0);
    // result[4][0] = rank of 50 in [30, 40, 50] = 2/2 = 1.0 (highest)
    expect(getElement(result, 4, 0)).toBe(1.0);
  });

  it('should handle tied values correctly', () => {
    const x = createMatrix(4, 2);
    // Window will be [10, 20, 20] - two 20s
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 20);
    setElement(x, 3, 0, 30);

    const result = ts_rank(x, 3);

    // result[2][0] = rank of 20 in [10, 20, 20]
    // Values: 10, 20, 20 (sorted)
    // Current is 20, countLess=1, countEqual=2
    // avgRank = (1 + 2)/2 = 1.5, normalized = 1.5 / (3-1) = 0.75
    expect(getElement(result, 2, 0)).toBe(0.75);
  });

  it('should return 0.0 for lowest value in window', () => {
    const x = createMatrix(4, 2);
    // Create a decreasing sequence so current is lowest
    setElement(x, 0, 0, 30);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 10);
    setElement(x, 3, 0, 40);

    const result = ts_rank(x, 3);

    // result[2][0] = rank of 10 in [30, 20, 10] = 0/2 = 0.0 (lowest)
    expect(getElement(result, 2, 0)).toBe(0.0);
  });

  it('should return 0.5 for middle value in window of 3', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 30);
    setElement(x, 2, 0, 20);
    setElement(x, 3, 0, 40);

    const result = ts_rank(x, 3);

    // result[2][0] = rank of 20 in [10, 30, 20] -> sorted [10, 20, 30]
    // 20 is at position 1 out of 3, rank = 1 / (3-1) = 0.5
    expect(getElement(result, 2, 0)).toBe(0.5);
  });

  it('should ignore NaN values but require d valid values', () => {
    const x = createMatrix(5, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_rank(x, 3);

    // result[2][0] should be NaN (only 2 valid values in window)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
    // result[4][0] = rank of 50 in [30, 40, 50] = 1.0
    expect(getElement(result, 4, 0)).toBe(1.0);
  });

  it('should return 0.5 for single valid value (d=1)', () => {
    const x = createMatrix(3, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);

    const result = ts_rank(x, 1);

    // Each single value gets rank 0.5
    expect(getElement(result, 0, 0)).toBe(0.5);
    expect(getElement(result, 1, 0)).toBe(0.5);
    expect(getElement(result, 2, 0)).toBe(0.5);
  });

  it('should process each stock independently', () => {
    const x = createMatrix(4, 2);
    // Stock 0: [10, 20, 30, 40] - increasing
    // Stock 1: [40, 30, 20, 10] - decreasing
    for (let t = 0; t < 4; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(x, t, 1, (4 - t) * 10);
    }

    const result = ts_rank(x, 3);

    // Stock 0: result[2][0] = rank of 30 in [10, 20, 30] = 1.0
    expect(getElement(result, 2, 0)).toBe(1.0);
    // Stock 1: result[2][1] = rank of 20 in [40, 30, 20] = 0.0
    expect(getElement(result, 2, 1)).toBe(0.0);
  });

  it('should handle all equal values in window', () => {
    const x = createMatrix(4, 2);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 10);
    setElement(x, 2, 0, 10);
    setElement(x, 3, 0, 20);

    const result = ts_rank(x, 3);

    // result[2][0] = rank of 10 in [10, 10, 10]
    // All tied, avgRank = (0+2)/2 = 1, normalized = 1 / (3-1) = 0.5
    expect(getElement(result, 2, 0)).toBe(0.5);
  });
});

describe('ts_decay_linear', () => {
  it('should return NaN when window has fewer than d valid values', () => {
    const x = createMatrix(5, 2);
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 2; i++) {
        setElement(x, t, i, (t + 1) * 10);
      }
    }

    const result = ts_decay_linear(x, 3);

    // First 2 rows have windows [0], [0,1] with < 3 values
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should compute weighted mean with linear decay weights', () => {
    const x = createMatrix(5, 1);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_decay_linear(x, 3);

    // result[2][0] = weighted mean of [10, 20, 30] with weights [1, 2, 3]
    // = (1*10 + 2*20 + 3*30) / (1 + 2 + 3) = (10 + 40 + 90) / 6 = 140 / 6 = 23.333...
    expect(getElement(result, 2, 0)).toBeCloseTo(23.333333, 5);

    // result[3][0] = weighted mean of [20, 30, 40] with weights [1, 2, 3]
    // = (1*20 + 2*30 + 3*40) / 6 = (20 + 60 + 120) / 6 = 200 / 6 = 33.333...
    expect(getElement(result, 3, 0)).toBeCloseTo(33.333333, 5);

    // result[4][0] = weighted mean of [30, 40, 50] with weights [1, 2, 3]
    // = (1*30 + 2*40 + 3*50) / 6 = (30 + 80 + 150) / 6 = 260 / 6 = 43.333...
    expect(getElement(result, 4, 0)).toBeCloseTo(43.333333, 5);
  });

  it('should give heaviest weight to newest value', () => {
    const x = createMatrix(3, 1);
    setElement(x, 0, 0, 100);
    setElement(x, 1, 0, 0);
    setElement(x, 2, 0, 0);

    const result = ts_decay_linear(x, 2);

    // result[2][0] = weighted mean of [0, 0] with weights [1, 2]
    // = (1*0 + 2*0) / 3 = 0
    expect(getElement(result, 2, 0)).toBe(0);

    // Now test with newest value being non-zero
    const x2 = createMatrix(3, 1);
    setElement(x2, 0, 0, 0);
    setElement(x2, 1, 0, 0);
    setElement(x2, 2, 0, 100);

    const result2 = ts_decay_linear(x2, 2);

    // result[2][0] = weighted mean of [0, 100] with weights [1, 2]
    // = (1*0 + 2*100) / 3 = 200 / 3 = 66.666...
    expect(getElement(result2, 2, 0)).toBeCloseTo(66.666666, 5);
  });

  it('should handle NaN values correctly', () => {
    const x = createMatrix(5, 1);
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 30);
    setElement(x, 3, 0, 40);
    setElement(x, 4, 0, 50);

    const result = ts_decay_linear(x, 3);

    // result[2][0] should be NaN (only 2 valid values in window [0,1,2]: 10 and 30)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);

    // result[3][0] should be NaN (only 2 valid values in window [1,2,3]: 30 and 40)
    expect(isNaN(getElement(result, 3, 0))).toBe(true);

    // result[4][0] = weighted mean of [30, 40, 50] with weights [1, 2, 3]
    // = (1*30 + 2*40 + 3*50) / 6 = (30 + 80 + 150) / 6 = 260 / 6 = 43.333...
    expect(getElement(result, 4, 0)).toBeCloseTo(43.333333, 5);
  });

  it('should process each stock independently', () => {
    const x = createMatrix(3, 2);
    // Stock 0: [10, 20, 30]
    setElement(x, 0, 0, 10);
    setElement(x, 1, 0, 20);
    setElement(x, 2, 0, 30);
    // Stock 1: [100, 200, 300]
    setElement(x, 0, 1, 100);
    setElement(x, 1, 1, 200);
    setElement(x, 2, 1, 300);

    const result = ts_decay_linear(x, 2);

    // Stock 0: result[2][0] = (1*20 + 2*30) / 3 = 80 / 3 = 26.666...
    expect(getElement(result, 2, 0)).toBeCloseTo(26.666666, 5);

    // Stock 1: result[2][1] = (1*200 + 2*300) / 3 = 800 / 3 = 266.666...
    expect(getElement(result, 2, 1)).toBeCloseTo(266.666666, 5);
  });
});

describe('ts_corr', () => {
  it('should return NaN when window has fewer than d valid pairs', () => {
    const x = createMatrix(5, 1);
    const y = createMatrix(5, 1);
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, (t + 1) * 10);
      setElement(y, t, 0, (t + 1) * 20);
    }

    const result = ts_corr(x, y, 3);

    // First 2 rows have windows [0], [0,1] with < 3 pairs
    expect(isNaN(getElement(result, 0, 0))).toBe(true);
    expect(isNaN(getElement(result, 1, 0))).toBe(true);
  });

  it('should compute perfect positive correlation', () => {
    const x = createMatrix(5, 1);
    const y = createMatrix(5, 1);
    // Perfect positive correlation: y = 2*x
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, t + 1);
      setElement(y, t, 0, 2 * (t + 1));
    }

    const result = ts_corr(x, y, 3);

    // result[2][0] = corr([1, 2, 3], [2, 4, 6]) = 1.0
    expect(getElement(result, 2, 0)).toBeCloseTo(1.0, 10);
    expect(getElement(result, 3, 0)).toBeCloseTo(1.0, 10);
    expect(getElement(result, 4, 0)).toBeCloseTo(1.0, 10);
  });

  it('should compute perfect negative correlation', () => {
    const x = createMatrix(5, 1);
    const y = createMatrix(5, 1);
    // Perfect negative correlation: y = -x
    for (let t = 0; t < 5; t++) {
      setElement(x, t, 0, t + 1);
      setElement(y, t, 0, -(t + 1));
    }

    const result = ts_corr(x, y, 3);

    // result[2][0] = corr([1, 2, 3], [-1, -2, -3]) = -1.0
    expect(getElement(result, 2, 0)).toBeCloseTo(-1.0, 10);
    expect(getElement(result, 3, 0)).toBeCloseTo(-1.0, 10);
    expect(getElement(result, 4, 0)).toBeCloseTo(-1.0, 10);
  });

  it('should return NaN for zero variance', () => {
    const x = createMatrix(3, 1);
    const y = createMatrix(3, 1);
    // x has zero variance
    setElement(x, 0, 0, 5);
    setElement(x, 1, 0, 5);
    setElement(x, 2, 0, 5);
    setElement(y, 0, 0, 1);
    setElement(y, 1, 0, 2);
    setElement(y, 2, 0, 3);

    const result = ts_corr(x, y, 3);

    // result[2][0] should be NaN (x has zero variance)
    expect(isNaN(getElement(result, 2, 0))).toBe(true);
  });

  it('should handle NaN values correctly', () => {
    const x = createMatrix(5, 1);
    const y = createMatrix(5, 1);
    setElement(x, 0, 0, 1);
    setElement(x, 1, 0, NaN);
    setElement(x, 2, 0, 3);
    setElement(x, 3, 0, 4);
    setElement(x, 4, 0, 5);
    setElement(y, 0, 0, 2);
    setElement(y, 1, 0, 4);
    setElement(y, 2, 0, NaN);
    setElement(y, 3, 0, 8);
    setElement(y, 4, 0, 10);

    const result = ts_corr(x, y, 3);

    // result[2][0] should be NaN (only 1 valid pair in window [0..2]: (1,2))
    expect(isNaN(getElement(result, 2, 0))).toBe(true);

    // result[3][0] should be NaN (only 2 valid pairs in window [1..3]: (3,NaN), (4,8))
    expect(isNaN(getElement(result, 3, 0))).toBe(true);

    // result[4][0] should be NaN (only 2 valid pairs in window [2..4]: (4,8), (5,10))
    expect(isNaN(getElement(result, 4, 0))).toBe(true);
  });

  it('should clamp output to [-1, 1]', () => {
    const x = createMatrix(3, 1);
    const y = createMatrix(3, 1);
    setElement(x, 0, 0, 1);
    setElement(x, 1, 0, 2);
    setElement(x, 2, 0, 3);
    setElement(y, 0, 0, 1);
    setElement(y, 1, 0, 2);
    setElement(y, 2, 0, 3);

    const result = ts_corr(x, y, 3);

    const val = getElement(result, 2, 0);
    expect(val).toBeGreaterThanOrEqual(-1);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('should process each stock independently', () => {
    const x = createMatrix(3, 2);
    const y = createMatrix(3, 2);
    // Stock 0: perfect positive correlation
    setElement(x, 0, 0, 1);
    setElement(x, 1, 0, 2);
    setElement(x, 2, 0, 3);
    setElement(y, 0, 0, 2);
    setElement(y, 1, 0, 4);
    setElement(y, 2, 0, 6);
    // Stock 1: perfect negative correlation
    setElement(x, 0, 1, 1);
    setElement(x, 1, 1, 2);
    setElement(x, 2, 1, 3);
    setElement(y, 0, 1, -1);
    setElement(y, 1, 1, -2);
    setElement(y, 2, 1, -3);

    const result = ts_corr(x, y, 3);

    // Stock 0: correlation should be 1.0
    expect(getElement(result, 2, 0)).toBeCloseTo(1.0, 10);

    // Stock 1: correlation should be -1.0
    expect(getElement(result, 2, 1)).toBeCloseTo(-1.0, 10);
  });
});

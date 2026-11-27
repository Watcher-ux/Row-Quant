/**
 * Integration test for Task 10: ts_decay_linear and ts_corr operators
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/engine/parser.js';
import { evaluate } from '../../src/engine/evaluate.js';
import { createMatrix, getElement } from '../../src/engine/ast.js';
import type { EvaluationContext } from '../../src/engine/evaluate.js';

describe('Task 10 Integration: ts_decay_linear and ts_corr', () => {
  // Create a simple evaluation context with test data
  function createTestContext(): EvaluationContext {
    const nDays = 10;
    const nStocks = 3;

    const close = createMatrix(nDays, nStocks);
    const open = createMatrix(nDays, nStocks);
    const high = createMatrix(nDays, nStocks);
    const low = createMatrix(nDays, nStocks);
    const volume = createMatrix(nDays, nStocks);
    const vwap = createMatrix(nDays, nStocks);
    const returns = createMatrix(nDays, nStocks);
    const sector = createMatrix(nDays, nStocks);

    // Fill with test data
    for (let t = 0; t < nDays; t++) {
      for (let i = 0; i < nStocks; i++) {
        close.data[t * nStocks + i] = 100 + t * 10 + i;
        open.data[t * nStocks + i] = 100 + t * 10 + i;
        high.data[t * nStocks + i] = 100 + t * 10 + i + 2;
        low.data[t * nStocks + i] = 100 + t * 10 + i - 2;
        volume.data[t * nStocks + i] = 1000000 * (i + 1);
        vwap.data[t * nStocks + i] = 100 + t * 10 + i + 0.5;
        returns.data[t * nStocks + i] = 0.01 * (t + 1);
        sector.data[t * nStocks + i] = i;
      }
    }

    return {
      data: { open, high, low, close, volume, vwap, returns, sector },
      cells: new Map(),
    };
  }

  it('should parse and evaluate ts_decay_linear(close, 5)', () => {
    const source = 'ts_decay_linear(close, 5)';
    const parseResult = parse(source);

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const context = createTestContext();
    const evalResult = evaluate(parseResult.value, context);

    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify dimensions
    expect(result.nDays).toBe(10);
    expect(result.nStocks).toBe(3);

    // First 4 days should be NaN (need 5 valid values)
    for (let t = 0; t < 4; t++) {
      for (let i = 0; i < 3; i++) {
        expect(isNaN(getElement(result, t, i))).toBe(true);
      }
    }

    // Later days should have valid values
    for (let t = 4; t < 10; t++) {
      for (let i = 0; i < 3; i++) {
        const val = getElement(result, t, i);
        expect(isNaN(val)).toBe(false);
        // Should be weighted average with newest values weighted more
        expect(val).toBeGreaterThan(0);
      }
    }
  });

  it('should parse and evaluate ts_corr(close, open, 5)', () => {
    const source = 'ts_corr(close, open, 5)';
    const parseResult = parse(source);

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const context = createTestContext();
    const evalResult = evaluate(parseResult.value, context);

    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify dimensions
    expect(result.nDays).toBe(10);
    expect(result.nStocks).toBe(3);

    // First 4 days should be NaN (need 5 valid pairs)
    for (let t = 0; t < 4; t++) {
      for (let i = 0; i < 3; i++) {
        expect(isNaN(getElement(result, t, i))).toBe(true);
      }
    }

    // Later days should have valid correlation values
    // Since close and open are very similar in our test data, correlation should be high
    for (let t = 4; t < 10; t++) {
      for (let i = 0; i < 3; i++) {
        const val = getElement(result, t, i);
        expect(isNaN(val)).toBe(false);
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
        // Should be close to 1 for our test data
        expect(val).toBeGreaterThan(0.9);
      }
    }
  });

  it('should parse and evaluate complex expression: rank(ts_decay_linear(close, 3))', () => {
    const source = 'rank(ts_decay_linear(close, 3))';
    const parseResult = parse(source);

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const context = createTestContext();
    const evalResult = evaluate(parseResult.value, context);

    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify dimensions
    expect(result.nDays).toBe(10);
    expect(result.nStocks).toBe(3);

    // After window fills, should have rank values in [0, 1]
    for (let t = 2; t < 10; t++) {
      for (let i = 0; i < 3; i++) {
        const val = getElement(result, t, i);
        expect(isNaN(val)).toBe(false);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should handle ts_corr with self-correlation (should be 1.0)', () => {
    const source = 'ts_corr(close, close, 3)';
    const parseResult = parse(source);

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const context = createTestContext();
    const evalResult = evaluate(parseResult.value, context);

    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Self-correlation should be 1.0 (or very close due to floating point)
    for (let t = 2; t < 10; t++) {
      for (let i = 0; i < 3; i++) {
        const val = getElement(result, t, i);
        if (!isNaN(val)) {
          expect(val).toBeCloseTo(1.0, 10);
        }
      }
    }
  });

  it('should validate ts_decay_linear gives more weight to recent values', () => {
    // Create context where older values are much larger than newer values
    const context = createTestContext();
    const nDays = 5;
    const nStocks = 1;
    
    const testClose = createMatrix(nDays, nStocks);
    testClose.data[0] = 100;  // Oldest
    testClose.data[1] = 90;
    testClose.data[2] = 80;
    testClose.data[3] = 70;
    testClose.data[4] = 60;   // Newest (should have highest weight)
    
    context.data.close = testClose;

    const source = 'ts_decay_linear(close, 5)';
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;
    const val = getElement(result, 4, 0);

    // With linear weights [1, 2, 3, 4, 5] for [100, 90, 80, 70, 60]:
    // = (1*100 + 2*90 + 3*80 + 4*70 + 5*60) / (1+2+3+4+5)
    // = (100 + 180 + 240 + 280 + 300) / 15
    // = 1100 / 15 = 73.333...
    expect(val).toBeCloseTo(73.333333, 5);
  });
});

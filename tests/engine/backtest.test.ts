/**
 * Unit tests for Backtest Module
 */

import { describe, it, expect } from 'vitest';
import {
  computeWeights,
  computePnL,
  computeSharpe,
  computeAnnualReturn,
  computeTurnover,
  computeMaxDrawdown,
  backtest,
} from '../../src/engine/backtest.js';
import { createMatrix, Matrix } from '../../src/engine/ast.js';

describe('computeWeights', () => {
  it('should convert simple alpha to weights with sum=0 and sum|w|=1', () => {
    const alpha = createMatrix(1, 3);
    alpha.data[0] = 1;
    alpha.data[1] = 2;
    alpha.data[2] = 3;

    const weights = computeWeights(alpha);

    // Check dimensions
    expect(weights.nDays).toBe(1);
    expect(weights.nStocks).toBe(3);

    // Alpha values: [1, 2, 3], mean = 2
    // After demeaning: [-1, 0, 1]
    // sum|w| = 1 + 0 + 1 = 2
    // After scaling: [-0.5, 0, 0.5]
    expect(weights.data[0]).toBeCloseTo(-0.5);
    expect(weights.data[1]).toBeCloseTo(0);
    expect(weights.data[2]).toBeCloseTo(0.5);

    // Verify sum = 0
    const sum = weights.data[0] + weights.data[1] + weights.data[2];
    expect(sum).toBeCloseTo(0, 10);

    // Verify sum|w| = 1
    const sumAbs = Math.abs(weights.data[0]) + Math.abs(weights.data[1]) + Math.abs(weights.data[2]);
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should handle NaN alpha by setting weight to exactly 0', () => {
    const alpha = createMatrix(1, 4);
    alpha.data[0] = 1;
    alpha.data[1] = NaN;
    alpha.data[2] = 3;
    alpha.data[3] = NaN;

    const weights = computeWeights(alpha);

    // Alpha values: [1, NaN, 3, NaN]
    // Valid indices: [0, 2]
    // Mean of valid: (1 + 3) / 2 = 2
    // After demeaning: [-1, 0, 1, 0]
    // sum|w| = 1 + 0 + 1 + 0 = 2
    // After scaling: [-0.5, 0, 0.5, 0]
    expect(weights.data[0]).toBeCloseTo(-0.5);
    expect(weights.data[1]).toBe(0); // NaN alpha -> exactly 0
    expect(weights.data[2]).toBeCloseTo(0.5);
    expect(weights.data[3]).toBe(0); // NaN alpha -> exactly 0

    // Verify sum = 0
    const sum = weights.data[0] + weights.data[1] + weights.data[2] + weights.data[3];
    expect(sum).toBeCloseTo(0, 10);

    // Verify sum|w| = 1
    const sumAbs = Math.abs(weights.data[0]) + Math.abs(weights.data[1]) + 
                   Math.abs(weights.data[2]) + Math.abs(weights.data[3]);
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should handle all-NaN alpha by setting all weights to 0', () => {
    const alpha = createMatrix(1, 3);
    alpha.data[0] = NaN;
    alpha.data[1] = NaN;
    alpha.data[2] = NaN;

    const weights = computeWeights(alpha);

    // All NaN -> all weights exactly 0
    expect(weights.data[0]).toBe(0);
    expect(weights.data[1]).toBe(0);
    expect(weights.data[2]).toBe(0);
  });

  it('should handle all-equal alpha (all weights become 0 after demeaning)', () => {
    const alpha = createMatrix(1, 3);
    alpha.data[0] = 5;
    alpha.data[1] = 5;
    alpha.data[2] = 5;

    const weights = computeWeights(alpha);

    // Alpha values: [5, 5, 5], mean = 5
    // After demeaning: [0, 0, 0]
    // sum|w| = 0, so no scaling
    expect(weights.data[0]).toBe(0);
    expect(weights.data[1]).toBe(0);
    expect(weights.data[2]).toBe(0);
  });

  it('should handle single valid alpha stock', () => {
    const alpha = createMatrix(1, 1);
    alpha.data[0] = 42;

    const weights = computeWeights(alpha);

    // Single stock with alpha 42, mean = 42
    // After demeaning: [0]
    // sum|w| = 0, so no scaling
    expect(weights.data[0]).toBe(0);
  });

  it('should handle mixture of positive and negative alpha', () => {
    const alpha = createMatrix(1, 4);
    alpha.data[0] = -2;
    alpha.data[1] = -1;
    alpha.data[2] = 1;
    alpha.data[3] = 2;

    const weights = computeWeights(alpha);

    // Alpha values: [-2, -1, 1, 2], mean = 0
    // After demeaning: [-2, -1, 1, 2] (unchanged)
    // sum|w| = 2 + 1 + 1 + 2 = 6
    // After scaling: [-1/3, -1/6, 1/6, 1/3]
    expect(weights.data[0]).toBeCloseTo(-1/3);
    expect(weights.data[1]).toBeCloseTo(-1/6);
    expect(weights.data[2]).toBeCloseTo(1/6);
    expect(weights.data[3]).toBeCloseTo(1/3);

    // Verify sum = 0
    const sum = weights.data[0] + weights.data[1] + weights.data[2] + weights.data[3];
    expect(sum).toBeCloseTo(0, 10);

    // Verify sum|w| = 1
    const sumAbs = Math.abs(weights.data[0]) + Math.abs(weights.data[1]) + 
                   Math.abs(weights.data[2]) + Math.abs(weights.data[3]);
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should process each day independently', () => {
    const alpha = createMatrix(3, 2);
    
    // Day 0: [1, 3]
    alpha.data[0] = 1;
    alpha.data[1] = 3;
    
    // Day 1: [2, 2]
    alpha.data[2] = 2;
    alpha.data[3] = 2;
    
    // Day 2: [NaN, 5]
    alpha.data[4] = NaN;
    alpha.data[5] = 5;

    const weights = computeWeights(alpha);

    // Day 0: [1, 3], mean = 2, demeaned = [-1, 1], sum|w| = 2, scaled = [-0.5, 0.5]
    expect(weights.data[0]).toBeCloseTo(-0.5);
    expect(weights.data[1]).toBeCloseTo(0.5);

    // Day 1: [2, 2], mean = 2, demeaned = [0, 0], sum|w| = 0, no scaling
    expect(weights.data[2]).toBe(0);
    expect(weights.data[3]).toBe(0);

    // Day 2: [NaN, 5], valid mean = 5, demeaned = [0, 0], sum|w| = 0, no scaling
    expect(weights.data[4]).toBe(0); // NaN alpha -> exactly 0
    expect(weights.data[5]).toBe(0); // Single valid becomes 0 after demeaning
  });

  it('should demean only over valid alpha stocks', () => {
    const alpha = createMatrix(1, 5);
    alpha.data[0] = NaN;
    alpha.data[1] = 1;
    alpha.data[2] = NaN;
    alpha.data[3] = 3;
    alpha.data[4] = NaN;

    const weights = computeWeights(alpha);

    // Valid stocks: [1, 3], mean = 2
    // After demeaning: [0, -1, 0, 1, 0]
    // sum|w| = 0 + 1 + 0 + 1 + 0 = 2
    // After scaling: [0, -0.5, 0, 0.5, 0]
    expect(weights.data[0]).toBe(0);
    expect(weights.data[1]).toBeCloseTo(-0.5);
    expect(weights.data[2]).toBe(0);
    expect(weights.data[3]).toBeCloseTo(0.5);
    expect(weights.data[4]).toBe(0);

    // Verify sum = 0
    let sum = 0;
    for (let i = 0; i < 5; i++) {
      sum += weights.data[i];
    }
    expect(sum).toBeCloseTo(0, 10);

    // Verify sum|w| = 1
    let sumAbs = 0;
    for (let i = 0; i < 5; i++) {
      sumAbs += Math.abs(weights.data[i]);
    }
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should handle zero alpha values correctly', () => {
    const alpha = createMatrix(1, 3);
    alpha.data[0] = -1;
    alpha.data[1] = 0;
    alpha.data[2] = 1;

    const weights = computeWeights(alpha);

    // Alpha values: [-1, 0, 1], mean = 0
    // After demeaning: [-1, 0, 1] (unchanged)
    // sum|w| = 1 + 0 + 1 = 2
    // After scaling: [-0.5, 0, 0.5]
    expect(weights.data[0]).toBeCloseTo(-0.5);
    expect(weights.data[1]).toBe(0);
    expect(weights.data[2]).toBeCloseTo(0.5);
  });

  it('should handle large alpha values without overflow', () => {
    const alpha = createMatrix(1, 2);
    alpha.data[0] = 1e10;
    alpha.data[1] = 1e11;

    const weights = computeWeights(alpha);

    // Should still satisfy constraints
    const sum = weights.data[0] + weights.data[1];
    expect(sum).toBeCloseTo(0, 5);

    const sumAbs = Math.abs(weights.data[0]) + Math.abs(weights.data[1]);
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should handle very small alpha differences', () => {
    const alpha = createMatrix(1, 2);
    alpha.data[0] = 1;
    alpha.data[1] = 1.001;

    const weights = computeWeights(alpha);

    // Should still satisfy constraints despite small differences
    const sum = weights.data[0] + weights.data[1];
    expect(sum).toBeCloseTo(0, 10);

    const sumAbs = Math.abs(weights.data[0]) + Math.abs(weights.data[1]);
    expect(sumAbs).toBeCloseTo(1, 10);
  });

  it('should maintain constraints with many stocks', () => {
    const nStocks = 100;
    const alpha = createMatrix(1, nStocks);
    
    // Create varied alpha values
    for (let i = 0; i < nStocks; i++) {
      alpha.data[i] = Math.sin(i) * 10 + i;
    }
    // Add some NaN values
    alpha.data[10] = NaN;
    alpha.data[50] = NaN;
    alpha.data[90] = NaN;

    const weights = computeWeights(alpha);

    // Verify sum = 0
    let sum = 0;
    for (let i = 0; i < nStocks; i++) {
      sum += weights.data[i];
    }
    expect(sum).toBeCloseTo(0, 8);

    // Verify sum|w| = 1
    let sumAbs = 0;
    for (let i = 0; i < nStocks; i++) {
      sumAbs += Math.abs(weights.data[i]);
    }
    expect(sumAbs).toBeCloseTo(1, 10);

    // Verify NaN alpha -> weight exactly 0
    expect(weights.data[10]).toBe(0);
    expect(weights.data[50]).toBe(0);
    expect(weights.data[90]).toBe(0);
  });
});


describe('computePnL', () => {
  it('should compute daily PnL with delay-1', () => {
    // Create simple weights and returns
    const weights = createMatrix(3, 2);
    const returns = createMatrix(3, 2);

    // Day 0 weights: [0.5, -0.5]
    weights.data[0] = 0.5;
    weights.data[1] = -0.5;

    // Day 1 weights: [0.6, -0.4]
    weights.data[2] = 0.6;
    weights.data[3] = -0.4;

    // Day 2 weights: [0.7, -0.3]
    weights.data[4] = 0.7;
    weights.data[5] = -0.3;

    // Day 0 returns: [0.1, 0.2] (not used due to delay-1)
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;

    // Day 1 returns: [0.02, 0.03]
    returns.data[2] = 0.02;
    returns.data[3] = 0.03;

    // Day 2 returns: [0.01, -0.02]
    returns.data[4] = 0.01;
    returns.data[5] = -0.02;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Verify PnL array length = nDays - 1
    expect(dailyPnL.length).toBe(2);
    expect(cumulativePnL.length).toBe(2);

    // Day 0 weights applied to Day 1 returns:
    // PnL[0] = 0.5 * 0.02 + (-0.5) * 0.03 = 0.01 - 0.015 = -0.005
    expect(dailyPnL[0]).toBeCloseTo(-0.005);
    expect(cumulativePnL[0]).toBeCloseTo(-0.005);

    // Day 1 weights applied to Day 2 returns:
    // PnL[1] = 0.6 * 0.01 + (-0.4) * (-0.02) = 0.006 + 0.008 = 0.014
    expect(dailyPnL[1]).toBeCloseTo(0.014);
    expect(cumulativePnL[1]).toBeCloseTo(-0.005 + 0.014);
  });

  it('should handle NaN returns by skipping them in sum', () => {
    const weights = createMatrix(2, 3);
    const returns = createMatrix(2, 3);

    // Day 0 weights: [0.5, 0.3, 0.2]
    weights.data[0] = 0.5;
    weights.data[1] = 0.3;
    weights.data[2] = 0.2;

    // Day 1 weights: [0.4, 0.4, 0.2]
    weights.data[3] = 0.4;
    weights.data[4] = 0.4;
    weights.data[5] = 0.2;

    // Day 0 returns: [0.1, 0.2, 0.3]
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;
    returns.data[2] = 0.3;

    // Day 1 returns: [0.02, NaN, 0.05]
    returns.data[3] = 0.02;
    returns.data[4] = NaN;
    returns.data[5] = 0.05;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Day 0 weights applied to Day 1 returns:
    // PnL[0] = 0.5 * 0.02 + 0.3 * NaN + 0.2 * 0.05
    //        = 0.01 + 0 (NaN skipped) + 0.01 = 0.02
    expect(dailyPnL[0]).toBeCloseTo(0.02);
    expect(cumulativePnL[0]).toBeCloseTo(0.02);
  });

  it('should handle all-NaN returns for a day', () => {
    const weights = createMatrix(2, 2);
    const returns = createMatrix(2, 2);

    // Day 0 weights: [0.5, -0.5]
    weights.data[0] = 0.5;
    weights.data[1] = -0.5;

    // Day 1 weights: [0.6, -0.4]
    weights.data[2] = 0.6;
    weights.data[3] = -0.4;

    // Day 0 returns: [0.1, 0.2]
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;

    // Day 1 returns: [NaN, NaN]
    returns.data[2] = NaN;
    returns.data[3] = NaN;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Day 0 weights applied to Day 1 returns (all NaN):
    // PnL[0] = 0.5 * NaN + (-0.5) * NaN = 0 (all skipped)
    expect(dailyPnL[0]).toBe(0);
    expect(cumulativePnL[0]).toBe(0);
  });

  it('should build cumulative PnL correctly', () => {
    const weights = createMatrix(5, 1);
    const returns = createMatrix(5, 1);

    // Simple weights (all 1 for simplicity)
    for (let t = 0; t < 5; t++) {
      weights.data[t] = 1;
    }

    // Returns: [0, 0.01, 0.02, -0.01, 0.03]
    returns.data[0] = 0;
    returns.data[1] = 0.01;
    returns.data[2] = 0.02;
    returns.data[3] = -0.01;
    returns.data[4] = 0.03;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Verify length
    expect(dailyPnL.length).toBe(4);
    expect(cumulativePnL.length).toBe(4);

    // Daily PnL (delay-1):
    // PnL[0] = weights[0] * returns[1] = 1 * 0.01 = 0.01
    // PnL[1] = weights[1] * returns[2] = 1 * 0.02 = 0.02
    // PnL[2] = weights[2] * returns[3] = 1 * (-0.01) = -0.01
    // PnL[3] = weights[3] * returns[4] = 1 * 0.03 = 0.03
    expect(dailyPnL[0]).toBeCloseTo(0.01);
    expect(dailyPnL[1]).toBeCloseTo(0.02);
    expect(dailyPnL[2]).toBeCloseTo(-0.01);
    expect(dailyPnL[3]).toBeCloseTo(0.03);

    // Cumulative PnL:
    // cumPnL[0] = 0.01
    // cumPnL[1] = 0.01 + 0.02 = 0.03
    // cumPnL[2] = 0.03 + (-0.01) = 0.02
    // cumPnL[3] = 0.02 + 0.03 = 0.05
    expect(cumulativePnL[0]).toBeCloseTo(0.01);
    expect(cumulativePnL[1]).toBeCloseTo(0.03);
    expect(cumulativePnL[2]).toBeCloseTo(0.02);
    expect(cumulativePnL[3]).toBeCloseTo(0.05);
  });

  it('should verify delay-1 relationship', () => {
    // This test explicitly verifies the delay-1 behavior:
    // weights[t] * returns[t+1] = PnL[t]
    
    const weights = createMatrix(3, 2);
    const returns = createMatrix(3, 2);

    // Set up known weights and returns
    weights.data[0] = 0.6;   // Day 0, Stock 0
    weights.data[1] = -0.6;  // Day 0, Stock 1
    
    weights.data[2] = 0.7;   // Day 1, Stock 0
    weights.data[3] = -0.7;  // Day 1, Stock 1
    
    weights.data[4] = 0.8;   // Day 2, Stock 0
    weights.data[5] = -0.8;  // Day 2, Stock 1

    returns.data[0] = 0.00;  // Day 0, Stock 0
    returns.data[1] = 0.00;  // Day 0, Stock 1
    
    returns.data[2] = 0.05;  // Day 1, Stock 0
    returns.data[3] = 0.03;  // Day 1, Stock 1
    
    returns.data[4] = 0.02;  // Day 2, Stock 0
    returns.data[5] = 0.04;  // Day 2, Stock 1

    const { dailyPnL } = computePnL(weights, returns);

    // Manually compute expected PnL with delay-1:
    
    // PnL[0] uses weights[0] and returns[1]:
    const expectedPnL0 = weights.data[0] * returns.data[2] + 
                         weights.data[1] * returns.data[3];
    // = 0.6 * 0.05 + (-0.6) * 0.03 = 0.03 - 0.018 = 0.012
    expect(dailyPnL[0]).toBeCloseTo(expectedPnL0);
    expect(dailyPnL[0]).toBeCloseTo(0.012);

    // PnL[1] uses weights[1] and returns[2]:
    const expectedPnL1 = weights.data[2] * returns.data[4] + 
                         weights.data[3] * returns.data[5];
    // = 0.7 * 0.02 + (-0.7) * 0.04 = 0.014 - 0.028 = -0.014
    expect(dailyPnL[1]).toBeCloseTo(expectedPnL1);
    expect(dailyPnL[1]).toBeCloseTo(-0.014);
  });

  it('should handle zero weights', () => {
    const weights = createMatrix(2, 3);
    const returns = createMatrix(2, 3);

    // All weights zero
    for (let i = 0; i < 6; i++) {
      weights.data[i] = 0;
    }

    // Various returns
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;
    returns.data[2] = 0.3;
    returns.data[3] = 0.05;
    returns.data[4] = 0.10;
    returns.data[5] = 0.15;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // All PnL should be 0
    expect(dailyPnL[0]).toBe(0);
    expect(cumulativePnL[0]).toBe(0);
  });

  it('should handle negative returns', () => {
    const weights = createMatrix(2, 2);
    const returns = createMatrix(2, 2);

    // Day 0 weights: [0.5, 0.5]
    weights.data[0] = 0.5;
    weights.data[1] = 0.5;

    // Day 1 weights: [0.5, 0.5]
    weights.data[2] = 0.5;
    weights.data[3] = 0.5;

    // Day 0 returns: [0.1, 0.2]
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;

    // Day 1 returns: [-0.03, -0.05]
    returns.data[2] = -0.03;
    returns.data[3] = -0.05;

    const { dailyPnL } = computePnL(weights, returns);

    // Day 0 weights applied to Day 1 returns:
    // PnL[0] = 0.5 * (-0.03) + 0.5 * (-0.05) = -0.015 - 0.025 = -0.04
    expect(dailyPnL[0]).toBeCloseTo(-0.04);
  });

  it('should handle many stocks', () => {
    const nStocks = 100;
    const nDays = 10;
    
    const weights = createMatrix(nDays, nStocks);
    const returns = createMatrix(nDays, nStocks);

    // Fill with varied weights and returns
    for (let t = 0; t < nDays; t++) {
      let sumWeights = 0;
      for (let i = 0; i < nStocks; i++) {
        // Create market-neutral weights
        const w = (i < nStocks / 2) ? 1.0 / nStocks : -1.0 / nStocks;
        weights.data[t * nStocks + i] = w;
        sumWeights += w;
        
        // Random-ish returns
        returns.data[t * nStocks + i] = 0.01 * Math.sin(t + i);
      }
    }

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Verify correct length
    expect(dailyPnL.length).toBe(nDays - 1);
    expect(cumulativePnL.length).toBe(nDays - 1);

    // Verify cumulative sum is correct
    let expectedCum = 0;
    for (let t = 0; t < dailyPnL.length; t++) {
      expectedCum += dailyPnL[t];
      expect(cumulativePnL[t]).toBeCloseTo(expectedCum);
    }
  });

  it('should handle mixed NaN and valid returns', () => {
    const weights = createMatrix(3, 4);
    const returns = createMatrix(3, 4);

    // Day 0 weights: [0.25, 0.25, 0.25, 0.25]
    for (let i = 0; i < 4; i++) {
      weights.data[i] = 0.25;
    }

    // Day 1 weights: [0.3, 0.2, 0.3, 0.2]
    weights.data[4] = 0.3;
    weights.data[5] = 0.2;
    weights.data[6] = 0.3;
    weights.data[7] = 0.2;

    // Day 2 weights: [0.4, 0.1, 0.4, 0.1]
    weights.data[8] = 0.4;
    weights.data[9] = 0.1;
    weights.data[10] = 0.4;
    weights.data[11] = 0.1;

    // Day 0 returns: [0.1, 0.2, 0.3, 0.4]
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;
    returns.data[2] = 0.3;
    returns.data[3] = 0.4;

    // Day 1 returns: [0.02, NaN, 0.03, 0.04]
    returns.data[4] = 0.02;
    returns.data[5] = NaN;
    returns.data[6] = 0.03;
    returns.data[7] = 0.04;

    // Day 2 returns: [NaN, 0.05, NaN, 0.06]
    returns.data[8] = NaN;
    returns.data[9] = 0.05;
    returns.data[10] = NaN;
    returns.data[11] = 0.06;

    const { dailyPnL } = computePnL(weights, returns);

    // PnL[0] = Day 0 weights * Day 1 returns
    // = 0.25 * 0.02 + 0.25 * NaN + 0.25 * 0.03 + 0.25 * 0.04
    // = 0.005 + 0 + 0.0075 + 0.01 = 0.0225
    expect(dailyPnL[0]).toBeCloseTo(0.0225);

    // PnL[1] = Day 1 weights * Day 2 returns
    // = 0.3 * NaN + 0.2 * 0.05 + 0.3 * NaN + 0.2 * 0.06
    // = 0 + 0.01 + 0 + 0.012 = 0.022
    expect(dailyPnL[1]).toBeCloseTo(0.022);
  });

  it('should throw error if dimensions do not match', () => {
    const weights = createMatrix(3, 2);
    const returns = createMatrix(3, 3); // Different nStocks

    expect(() => computePnL(weights, returns)).toThrow('Weights and returns matrices must have same dimensions');
  });

  it('should handle minimum case with 2 days', () => {
    const weights = createMatrix(2, 1);
    const returns = createMatrix(2, 1);

    weights.data[0] = 1.0;
    weights.data[1] = 1.0;

    returns.data[0] = 0.05;
    returns.data[1] = 0.03;

    const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

    // Should have exactly 1 PnL value
    expect(dailyPnL.length).toBe(1);
    expect(cumulativePnL.length).toBe(1);

    // PnL[0] = weights[0] * returns[1] = 1.0 * 0.03 = 0.03
    expect(dailyPnL[0]).toBeCloseTo(0.03);
    expect(cumulativePnL[0]).toBeCloseTo(0.03);
  });
});

describe('computeSharpe', () => {
  it('should compute Sharpe ratio for positive PnL', () => {
    const dailyPnL = [0.01, 0.02, 0.015, 0.025, 0.018];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    const expectedSharpe = (mean / std) * Math.sqrt(252);

    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBeCloseTo(expectedSharpe);
  });

  it('should compute Sharpe ratio for mixed positive and negative PnL', () => {
    const dailyPnL = [0.01, -0.005, 0.02, -0.01, 0.015];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    const expectedSharpe = (mean / std) * Math.sqrt(252);

    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBeCloseTo(expectedSharpe);
  });

  it('should return 0 for constant PnL (std = 0)', () => {
    const dailyPnL = [0.01, 0.01, 0.01, 0.01, 0.01];
    
    // Std = 0, should return 0 to avoid division by zero
    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBe(0);
  });

  it('should return 0 for all-zero PnL', () => {
    const dailyPnL = [0, 0, 0, 0, 0];
    
    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBe(0);
  });

  it('should return 0 for empty PnL array', () => {
    const dailyPnL: number[] = [];
    
    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBe(0);
  });

  it('should handle single PnL value', () => {
    const dailyPnL = [0.01];
    
    // Std = 0 for single value, should return 0
    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBe(0);
  });

  it('should compute negative Sharpe for consistently negative PnL', () => {
    const dailyPnL = [-0.01, -0.02, -0.015, -0.025, -0.018];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    const expectedSharpe = (mean / std) * Math.sqrt(252);

    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBeCloseTo(expectedSharpe);
    expect(sharpe).toBeLessThan(0); // Should be negative
  });

  it('should annualize correctly with sqrt(252)', () => {
    const dailyPnL = [0.001, 0.002, -0.001, 0.003, 0.0015];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    
    const sharpe = computeSharpe(dailyPnL);
    
    // Verify annualization factor
    const dailySharpe = mean / std;
    expect(sharpe).toBeCloseTo(dailySharpe * Math.sqrt(252));
  });

  it('should handle very small PnL values', () => {
    const dailyPnL = [1e-6, 2e-6, -1e-6, 3e-6, 1.5e-6];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    const expectedSharpe = (mean / std) * Math.sqrt(252);

    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBeCloseTo(expectedSharpe);
  });

  it('should handle large PnL values', () => {
    const dailyPnL = [100, 200, -100, 300, 150];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnL.length;
    const std = Math.sqrt(variance);
    const expectedSharpe = (mean / std) * Math.sqrt(252);

    const sharpe = computeSharpe(dailyPnL);
    expect(sharpe).toBeCloseTo(expectedSharpe);
  });
});


describe('computeAnnualReturn', () => {
  it('should compute annual return for positive PnL', () => {
    const dailyPnL = [0.001, 0.002, 0.0015, 0.0025, 0.0018];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const expectedAnnualReturn = mean * 252;

    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
  });

  it('should compute annual return for negative PnL', () => {
    const dailyPnL = [-0.001, -0.002, -0.0015, -0.0025, -0.0018];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const expectedAnnualReturn = mean * 252;

    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
    expect(annualReturn).toBeLessThan(0);
  });

  it('should compute annual return for mixed PnL', () => {
    const dailyPnL = [0.001, -0.002, 0.0015, -0.001, 0.003];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const expectedAnnualReturn = mean * 252;

    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
  });

  it('should return 0 for all-zero PnL', () => {
    const dailyPnL = [0, 0, 0, 0, 0];
    
    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBe(0);
  });

  it('should return 0 for empty PnL array', () => {
    const dailyPnL: number[] = [];
    
    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBe(0);
  });

  it('should handle single PnL value', () => {
    const dailyPnL = [0.01];
    
    const expectedAnnualReturn = 0.01 * 252;
    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
  });

  it('should annualize with factor of 252', () => {
    const dailyPnL = [0.002];
    
    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(0.002 * 252);
    expect(annualReturn).toBeCloseTo(0.504);
  });

  it('should handle very small daily returns', () => {
    const dailyPnL = [0.0001, 0.00015, 0.00012];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const expectedAnnualReturn = mean * 252;

    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
  });

  it('should handle large daily returns', () => {
    const dailyPnL = [100, 150, 200];
    
    const mean = dailyPnL.reduce((s, v) => s + v, 0) / dailyPnL.length;
    const expectedAnnualReturn = mean * 252;

    const annualReturn = computeAnnualReturn(dailyPnL);
    expect(annualReturn).toBeCloseTo(expectedAnnualReturn);
  });
});


describe('computeTurnover', () => {
  it('should compute turnover for changing weights', () => {
    const weights = createMatrix(3, 2);
    
    // Day 0: [0.5, -0.5]
    weights.data[0] = 0.5;
    weights.data[1] = -0.5;
    
    // Day 1: [0.6, -0.6]
    weights.data[2] = 0.6;
    weights.data[3] = -0.6;
    
    // Day 2: [0.4, -0.4]
    weights.data[4] = 0.4;
    weights.data[5] = -0.4;

    const turnover = computeTurnover(weights);

    // Turnover day 0->1: |0.6 - 0.5| + |-0.6 - (-0.5)| = 0.1 + 0.1 = 0.2
    // Turnover day 1->2: |0.4 - 0.6| + |-0.4 - (-0.6)| = 0.2 + 0.2 = 0.4
    // Average: (0.2 + 0.4) / 2 = 0.3
    expect(turnover).toBeCloseTo(0.3);
  });

  it('should return 0 for constant weights', () => {
    const weights = createMatrix(5, 3);
    
    // All days have same weights: [0.5, 0.3, -0.8]
    for (let t = 0; t < 5; t++) {
      weights.data[t * 3 + 0] = 0.5;
      weights.data[t * 3 + 1] = 0.3;
      weights.data[t * 3 + 2] = -0.8;
    }

    const turnover = computeTurnover(weights);
    expect(turnover).toBe(0);
  });

  it('should return 0 for single day', () => {
    const weights = createMatrix(1, 3);
    weights.data[0] = 0.5;
    weights.data[1] = 0.3;
    weights.data[2] = -0.8;

    const turnover = computeTurnover(weights);
    expect(turnover).toBe(0);
  });

  it('should handle complete portfolio flip', () => {
    const weights = createMatrix(2, 2);
    
    // Day 0: [0.5, -0.5]
    weights.data[0] = 0.5;
    weights.data[1] = -0.5;
    
    // Day 1: [-0.5, 0.5] (complete flip)
    weights.data[2] = -0.5;
    weights.data[3] = 0.5;

    const turnover = computeTurnover(weights);

    // Turnover: |-0.5 - 0.5| + |0.5 - (-0.5)| = 1.0 + 1.0 = 2.0
    expect(turnover).toBeCloseTo(2.0);
  });

  it('should handle zero weights', () => {
    const weights = createMatrix(3, 2);
    
    // All weights are 0
    for (let i = 0; i < 6; i++) {
      weights.data[i] = 0;
    }

    const turnover = computeTurnover(weights);
    expect(turnover).toBe(0);
  });

  it('should handle transitions from zero weights', () => {
    const weights = createMatrix(3, 2);
    
    // Day 0: [0, 0]
    weights.data[0] = 0;
    weights.data[1] = 0;
    
    // Day 1: [0.5, -0.5]
    weights.data[2] = 0.5;
    weights.data[3] = -0.5;
    
    // Day 2: [0, 0]
    weights.data[4] = 0;
    weights.data[5] = 0;

    const turnover = computeTurnover(weights);

    // Turnover day 0->1: |0.5 - 0| + |-0.5 - 0| = 0.5 + 0.5 = 1.0
    // Turnover day 1->2: |0 - 0.5| + |0 - (-0.5)| = 0.5 + 0.5 = 1.0
    // Average: (1.0 + 1.0) / 2 = 1.0
    expect(turnover).toBeCloseTo(1.0);
  });

  it('should be non-negative', () => {
    const weights = createMatrix(10, 5);
    
    // Fill with varied weights
    for (let t = 0; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        weights.data[t * 5 + i] = Math.sin(t + i) * 0.2;
      }
    }

    const turnover = computeTurnover(weights);
    expect(turnover).toBeGreaterThanOrEqual(0);
  });

  it('should handle small weight changes', () => {
    const weights = createMatrix(3, 2);
    
    // Day 0: [0.500, -0.500]
    weights.data[0] = 0.500;
    weights.data[1] = -0.500;
    
    // Day 1: [0.501, -0.501]
    weights.data[2] = 0.501;
    weights.data[3] = -0.501;
    
    // Day 2: [0.502, -0.502]
    weights.data[4] = 0.502;
    weights.data[5] = -0.502;

    const turnover = computeTurnover(weights);

    // Turnover day 0->1: |0.501 - 0.500| + |-0.501 - (-0.500)| = 0.001 + 0.001 = 0.002
    // Turnover day 1->2: |0.502 - 0.501| + |-0.502 - (-0.501)| = 0.001 + 0.001 = 0.002
    // Average: (0.002 + 0.002) / 2 = 0.002
    expect(turnover).toBeCloseTo(0.002);
  });

  it('should handle many stocks', () => {
    const nStocks = 100;
    const nDays = 10;
    const weights = createMatrix(nDays, nStocks);
    
    // Fill with varied weights that change over time
    for (let t = 0; t < nDays; t++) {
      for (let i = 0; i < nStocks; i++) {
        weights.data[t * nStocks + i] = Math.cos(t * i * 0.01) / nStocks;
      }
    }

    const turnover = computeTurnover(weights);
    
    // Should be non-negative
    expect(turnover).toBeGreaterThanOrEqual(0);
    
    // Should be reasonably small given the smooth changes
    expect(turnover).toBeLessThan(10);
  });

  it('should average over all days correctly', () => {
    const weights = createMatrix(4, 2);
    
    // Day 0: [0.5, -0.5]
    weights.data[0] = 0.5;
    weights.data[1] = -0.5;
    
    // Day 1: [0.6, -0.6]
    weights.data[2] = 0.6;
    weights.data[3] = -0.6;
    
    // Day 2: [0.5, -0.5]
    weights.data[4] = 0.5;
    weights.data[5] = -0.5;
    
    // Day 3: [0.4, -0.4]
    weights.data[6] = 0.4;
    weights.data[7] = -0.4;

    const turnover = computeTurnover(weights);

    // Manual calculation:
    // Day 0->1: |0.6-0.5| + |-0.6-(-0.5)| = 0.1 + 0.1 = 0.2
    // Day 1->2: |0.5-0.6| + |-0.5-(-0.6)| = 0.1 + 0.1 = 0.2
    // Day 2->3: |0.4-0.5| + |-0.4-(-0.5)| = 0.1 + 0.1 = 0.2
    // Average: (0.2 + 0.2 + 0.2) / 3 = 0.2
    expect(turnover).toBeCloseTo(0.2);
  });
});


describe('computeMaxDrawdown', () => {
  it('should compute max drawdown for declining curve', () => {
    const cumulativePnL = [0.10, 0.08, 0.05, 0.02, 0.01];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak = 0.10 (at start)
    // Max drawdown = 0.10 - 0.01 = 0.09
    expect(maxDrawdown).toBeCloseTo(0.09);
  });

  it('should compute max drawdown for rising then falling curve', () => {
    const cumulativePnL = [0.01, 0.03, 0.05, 0.02, 0.04];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak progression: 0.01, 0.03, 0.05, 0.05, 0.05
    // Drawdowns: 0, 0, 0, 0.03, 0.01
    // Max drawdown = 0.03
    expect(maxDrawdown).toBeCloseTo(0.03);
  });

  it('should return 0 for constantly rising curve', () => {
    const cumulativePnL = [0.01, 0.02, 0.03, 0.04, 0.05];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // No drawdown, always rising
    expect(maxDrawdown).toBe(0);
  });

  it('should return 0 for flat curve', () => {
    const cumulativePnL = [0.05, 0.05, 0.05, 0.05, 0.05];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // No drawdown, constant
    expect(maxDrawdown).toBe(0);
  });

  it('should return 0 for empty array', () => {
    const cumulativePnL: number[] = [];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);
    expect(maxDrawdown).toBe(0);
  });

  it('should handle single value', () => {
    const cumulativePnL = [0.05];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak = 0.05, drawdown = 0
    expect(maxDrawdown).toBe(0);
  });

  it('should handle negative cumulative PnL', () => {
    const cumulativePnL = [-0.01, -0.03, -0.05, -0.02, -0.04];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak progression: 0 (initial), 0, 0, 0, 0
    // Drawdowns: 0.01, 0.03, 0.05, 0.02, 0.04
    // Max drawdown = 0.05
    expect(maxDrawdown).toBeCloseTo(0.05);
  });

  it('should handle recovery after drawdown', () => {
    const cumulativePnL = [0.10, 0.12, 0.08, 0.05, 0.11, 0.13];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak progression: 0.10, 0.12, 0.12, 0.12, 0.12, 0.13
    // Drawdowns: 0, 0, 0.04, 0.07, 0.01, 0
    // Max drawdown = 0.07
    expect(maxDrawdown).toBeCloseTo(0.07);
  });

  it('should handle multiple drawdowns and find the max', () => {
    const cumulativePnL = [0.05, 0.10, 0.08, 0.12, 0.09, 0.15, 0.10];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak progression: 0.05, 0.10, 0.10, 0.12, 0.12, 0.15, 0.15
    // Drawdowns: 0, 0, 0.02, 0, 0.03, 0, 0.05
    // Max drawdown = 0.05
    expect(maxDrawdown).toBeCloseTo(0.05);
  });

  it('should be non-negative', () => {
    const cumulativePnL = [0.01, 0.05, -0.02, 0.10, 0.03];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);
    
    expect(maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('should handle zero cumulative PnL', () => {
    const cumulativePnL = [0, 0, 0, 0, 0];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);
    expect(maxDrawdown).toBe(0);
  });

  it('should track peak correctly through volatility', () => {
    const cumulativePnL = [0.10, 0.08, 0.12, 0.09, 0.15, 0.11, 0.13];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak progression: 0.10, 0.10, 0.12, 0.12, 0.15, 0.15, 0.15
    // Drawdowns: 0, 0.02, 0, 0.03, 0, 0.04, 0.02
    // Max drawdown = 0.04
    expect(maxDrawdown).toBeCloseTo(0.04);
  });

  it('should handle large drawdowns', () => {
    const cumulativePnL = [1.0, 0.5, 0.2, 0.1, 0.05];

    const maxDrawdown = computeMaxDrawdown(cumulativePnL);

    // Peak = 1.0
    // Max drawdown = 1.0 - 0.05 = 0.95
    expect(maxDrawdown).toBeCloseTo(0.95);
  });
});


describe('backtest', () => {
  it('should integrate all components for simple backtest', () => {
    const alpha = createMatrix(3, 2);
    const returns = createMatrix(3, 2);

    // Alpha values
    // Day 0: [1, 3]
    alpha.data[0] = 1;
    alpha.data[1] = 3;
    
    // Day 1: [2, 2]
    alpha.data[2] = 2;
    alpha.data[3] = 2;
    
    // Day 2: [3, 1]
    alpha.data[4] = 3;
    alpha.data[5] = 1;

    // Returns
    // Day 0: [0.1, 0.2] (not used in PnL due to delay-1)
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;
    
    // Day 1: [0.02, 0.03]
    returns.data[2] = 0.02;
    returns.data[3] = 0.03;
    
    // Day 2: [0.01, -0.02]
    returns.data[4] = 0.01;
    returns.data[5] = -0.02;

    const result = backtest(alpha, returns);

    // Verify structure
    expect(result.pnl).toBeDefined();
    expect(result.cumulativePnl).toBeDefined();
    expect(result.sharpe).toBeDefined();
    expect(result.annualReturn).toBeDefined();
    expect(result.turnover).toBeDefined();
    expect(result.maxDrawdown).toBeDefined();

    // Verify PnL length
    expect(result.pnl.length).toBe(2);
    expect(result.cumulativePnl.length).toBe(2);

    // Verify metrics are numbers
    expect(typeof result.sharpe).toBe('number');
    expect(typeof result.annualReturn).toBe('number');
    expect(typeof result.turnover).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');

    // Verify non-negative constraints
    expect(result.turnover).toBeGreaterThanOrEqual(0);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('should handle all-NaN alpha (edge case)', () => {
    const alpha = createMatrix(3, 2);
    const returns = createMatrix(3, 2);

    // All alpha NaN
    for (let i = 0; i < 6; i++) {
      alpha.data[i] = NaN;
    }

    // Various returns
    returns.data[0] = 0.1;
    returns.data[1] = 0.2;
    returns.data[2] = 0.02;
    returns.data[3] = 0.03;
    returns.data[4] = 0.01;
    returns.data[5] = -0.02;

    const result = backtest(alpha, returns);

    // All weights should be 0, so all PnL should be 0
    expect(result.pnl[0]).toBe(0);
    expect(result.pnl[1]).toBe(0);
    expect(result.cumulativePnl[0]).toBe(0);
    expect(result.cumulativePnl[1]).toBe(0);

    // Metrics for zero PnL
    expect(result.sharpe).toBe(0);
    expect(result.annualReturn).toBe(0);
    expect(result.turnover).toBe(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('should handle partial NaN in alpha', () => {
    const alpha = createMatrix(3, 3);
    const returns = createMatrix(3, 3);

    // Day 0: [1, NaN, 3]
    alpha.data[0] = 1;
    alpha.data[1] = NaN;
    alpha.data[2] = 3;
    
    // Day 1: [2, 2, NaN]
    alpha.data[3] = 2;
    alpha.data[4] = 2;
    alpha.data[5] = NaN;
    
    // Day 2: [NaN, NaN, 5]
    alpha.data[6] = NaN;
    alpha.data[7] = NaN;
    alpha.data[8] = 5;

    // Returns
    for (let t = 0; t < 3; t++) {
      for (let i = 0; i < 3; i++) {
        returns.data[t * 3 + i] = 0.01 * (t + i + 1);
      }
    }

    const result = backtest(alpha, returns);

    // Should produce valid results
    expect(result.pnl.length).toBe(2);
    expect(result.cumulativePnl.length).toBe(2);
    
    // All metrics should be defined
    expect(typeof result.sharpe).toBe('number');
    expect(typeof result.annualReturn).toBe('number');
    expect(typeof result.turnover).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
  });

  it('should produce consistent Sharpe and annual return', () => {
    const alpha = createMatrix(10, 5);
    const returns = createMatrix(10, 5);

    // Create varied alpha and returns
    for (let t = 0; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        alpha.data[t * 5 + i] = Math.sin(t + i);
        returns.data[t * 5 + i] = 0.01 * Math.cos(t * i);
      }
    }

    const result = backtest(alpha, returns);

    // Manually verify Sharpe and annual return consistency
    const mean = result.pnl.reduce((s, v) => s + v, 0) / result.pnl.length;
    const variance = result.pnl.reduce((s, v) => s + (v - mean) ** 2, 0) / result.pnl.length;
    const std = Math.sqrt(variance);

    const expectedAnnualReturn = mean * 252;
    const expectedSharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;

    expect(result.annualReturn).toBeCloseTo(expectedAnnualReturn);
    expect(result.sharpe).toBeCloseTo(expectedSharpe);
  });

  it('should handle positive alpha performance', () => {
    const alpha = createMatrix(5, 2);
    const returns = createMatrix(5, 2);

    // Simple alpha that should perform well
    for (let t = 0; t < 5; t++) {
      alpha.data[t * 2 + 0] = 1;  // Long stock 0
      alpha.data[t * 2 + 1] = -1; // Short stock 1
    }

    // Stock 0 outperforms stock 1
    for (let t = 0; t < 5; t++) {
      returns.data[t * 2 + 0] = 0.02;  // Stock 0: +2%
      returns.data[t * 2 + 1] = 0.01;  // Stock 1: +1%
    }

    const result = backtest(alpha, returns);

    // Should have positive returns
    expect(result.annualReturn).toBeGreaterThan(0);
    
    // All PnL should be positive (consistently profitable)
    for (const pnl of result.pnl) {
      expect(pnl).toBeGreaterThan(0);
    }

    // No drawdown for constantly rising
    expect(result.maxDrawdown).toBe(0);
  });

  it('should handle negative alpha performance', () => {
    const alpha = createMatrix(5, 2);
    const returns = createMatrix(5, 2);

    // Alpha that picks losers
    for (let t = 0; t < 5; t++) {
      alpha.data[t * 2 + 0] = 1;  // Long stock 0
      alpha.data[t * 2 + 1] = -1; // Short stock 1
    }

    // Stock 1 outperforms stock 0 (opposite of alpha)
    for (let t = 0; t < 5; t++) {
      returns.data[t * 2 + 0] = 0.01;  // Stock 0: +1%
      returns.data[t * 2 + 1] = 0.02;  // Stock 1: +2%
    }

    const result = backtest(alpha, returns);

    // Should have negative returns
    expect(result.annualReturn).toBeLessThan(0);
    
    // Should have positive drawdown (losses accumulate)
    expect(result.maxDrawdown).toBeGreaterThan(0);
  });

  it('should compute turnover correctly', () => {
    const alpha = createMatrix(4, 2);
    const returns = createMatrix(4, 2);

    // Varying alpha (causes turnover)
    alpha.data[0] = 1; alpha.data[1] = 3;
    alpha.data[2] = 2; alpha.data[3] = 2;
    alpha.data[4] = 3; alpha.data[5] = 1;
    alpha.data[6] = 1; alpha.data[7] = 3;

    // Returns don't affect turnover
    for (let i = 0; i < 8; i++) {
      returns.data[i] = 0.01;
    }

    const result = backtest(alpha, returns);

    // Turnover should be positive (weights change)
    expect(result.turnover).toBeGreaterThan(0);
  });

  it('should have zero turnover for constant alpha', () => {
    const alpha = createMatrix(5, 2);
    const returns = createMatrix(5, 2);

    // Constant alpha (no turnover)
    for (let t = 0; t < 5; t++) {
      alpha.data[t * 2 + 0] = 2;
      alpha.data[t * 2 + 1] = 1;
    }

    // Various returns
    for (let t = 0; t < 5; t++) {
      returns.data[t * 2 + 0] = 0.01 * (t + 1);
      returns.data[t * 2 + 1] = 0.02 * (t + 1);
    }

    const result = backtest(alpha, returns);

    // Turnover should be 0 (weights never change)
    expect(result.turnover).toBe(0);
  });

  it('should track cumulative PnL correctly', () => {
    const alpha = createMatrix(5, 2);
    const returns = createMatrix(5, 2);

    // Simple setup
    for (let t = 0; t < 5; t++) {
      alpha.data[t * 2 + 0] = 1;
      alpha.data[t * 2 + 1] = -1;
      returns.data[t * 2 + 0] = 0.01;
      returns.data[t * 2 + 1] = 0.01;
    }

    const result = backtest(alpha, returns);

    // Verify cumulative is sum of daily
    let cumSum = 0;
    for (let i = 0; i < result.pnl.length; i++) {
      cumSum += result.pnl[i];
      expect(result.cumulativePnl[i]).toBeCloseTo(cumSum);
    }
  });

  it('should handle many days and stocks', () => {
    const nDays = 100;
    const nStocks = 50;
    
    const alpha = createMatrix(nDays, nStocks);
    const returns = createMatrix(nDays, nStocks);

    // Fill with varied data
    for (let t = 0; t < nDays; t++) {
      for (let i = 0; i < nStocks; i++) {
        alpha.data[t * nStocks + i] = Math.sin(t * i * 0.1);
        returns.data[t * nStocks + i] = 0.001 * Math.cos(t + i);
      }
    }

    const result = backtest(alpha, returns);

    // Should produce valid results
    expect(result.pnl.length).toBe(nDays - 1);
    expect(result.cumulativePnl.length).toBe(nDays - 1);
    
    // All metrics should be finite numbers
    expect(isFinite(result.sharpe)).toBe(true);
    expect(isFinite(result.annualReturn)).toBe(true);
    expect(isFinite(result.turnover)).toBe(true);
    expect(isFinite(result.maxDrawdown)).toBe(true);

    // Non-negative constraints
    expect(result.turnover).toBeGreaterThanOrEqual(0);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });
});

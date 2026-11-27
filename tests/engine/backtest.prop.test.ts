/**
 * Property-based tests for backtest weight constraints using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeWeights } from '../../src/engine/backtest.js';
import { createMatrix, Matrix } from '../../src/engine/ast.js';

/**
 * Generator for arbitrary alpha matrices with configurable dimensions
 * Generates matrices with valid finite numbers and some NaN values
 */
function arbitraryMatrix(
  minDays = 1,
  maxDays = 10,
  minStocks = 1,
  maxStocks = 20,
  nanProbability = 0.1
): fc.Arbitrary<Matrix> {
  return fc
    .tuple(
      fc.integer({ min: minDays, max: maxDays }),
      fc.integer({ min: minStocks, max: maxStocks })
    )
    .chain(([nDays, nStocks]) => {
      return fc
        .array(
          fc.oneof(
            fc.float({ min: -1000, max: 1000, noNaN: true }),
            fc.constant(NaN)
          ),
          { minLength: nDays * nStocks, maxLength: nDays * nStocks }
        )
        .map((values) => {
          const matrix = createMatrix(nDays, nStocks);
          // Apply NaN probability
          for (let i = 0; i < values.length; i++) {
            if (Math.random() < nanProbability && !isNaN(values[i])) {
              matrix.data[i] = NaN;
            } else {
              matrix.data[i] = values[i];
            }
          }
          return matrix;
        });
    });
}

/**
 * Generator for edge case matrices:
 * - All NaN
 * - All equal values
 * - Mixed NaN and valid values
 */
function edgeCaseMatrix(): fc.Arbitrary<Matrix> {
  return fc.oneof(
    // All NaN
    fc
      .tuple(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 2, max: 10 })
      )
      .map(([nDays, nStocks]) => {
        const matrix = createMatrix(nDays, nStocks);
        matrix.data.fill(NaN);
        return matrix;
      }),

    // All equal values
    fc
      .tuple(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 2, max: 10 }),
        fc.float({ min: -100, max: 100, noNaN: true })
      )
      .map(([nDays, nStocks, value]) => {
        const matrix = createMatrix(nDays, nStocks);
        matrix.data.fill(value);
        return matrix;
      }),

    // Mixed: some days all NaN, some days all equal, some days mixed
    fc
      .tuple(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 3, max: 15 })
      )
      .chain(([nDays, nStocks]) => {
        return fc
          .array(
            fc.oneof(
              fc.float({ min: -100, max: 100, noNaN: true }),
              fc.constant(NaN)
            ),
            { minLength: nDays * nStocks, maxLength: nDays * nStocks }
          )
          .map((values) => {
            const matrix = createMatrix(nDays, nStocks);
            for (let i = 0; i < values.length; i++) {
              matrix.data[i] = values[i];
            }
            return matrix;
          });
      })
  );
}

describe('Property Tests: Backtest Weight Constraints', () => {
  describe('computeWeights() properties', () => {
    /**
     * Property: Backtest Weight Constraints - Market Neutral
     * **Validates: Requirements 8.1.2, 8.1.4**
     *
     * For all alpha matrices and all days t:
     * - sum(weights[t]) = 0 (within relative tolerance)
     * - Market neutral constraint must hold for each day
     */
    it('**Validates: Requirements 8.1.2, 8.1.4** - sum(weights[t]) = 0 (market neutral)', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 20, 2, 50, 0.3), (alpha) => {
          const weights = computeWeights(alpha);

          // Check each day independently
          for (let t = 0; t < weights.nDays; t++) {
            const offset = t * weights.nStocks;

            // Collect weights for this day
            let sum = 0;
            let sumAbs = 0;
            let hasNonZero = false;

            for (let i = 0; i < weights.nStocks; i++) {
              const w = weights.data[offset + i];
              sum += w;
              sumAbs += Math.abs(w);
              if (Math.abs(w) > 1e-15) {
                hasNonZero = true;
              }
            }

            // If all weights are zero (all alpha was NaN), sum is trivially 0
            if (!hasNonZero) {
              continue;
            }

            // Market neutral: sum should be 0 within relative tolerance
            // Tolerance: 1e-9 × sum|w|, minimum 1e-15
            const tolerance = Math.max(1e-9 * sumAbs, 1e-15);

            if (Math.abs(sum) > tolerance) {
              throw new Error(
                `Market neutral constraint violated: day ${t}, sum(weights) = ${sum}, ` +
                  `sum(|weights|) = ${sumAbs}, tolerance = ${tolerance}`
              );
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    /**
     * Property: Backtest Weight Constraints - Scaled Weights
     * **Validates: Requirements 8.1.3, 8.1.4**
     *
     * For all alpha matrices and all days t:
     * - sum(|weights[t]|) = 1 or all weights = 0 (within relative tolerance)
     * - Weights must be properly scaled for each day
     */
    it('**Validates: Requirements 8.1.3, 8.1.4** - sum(|weights[t]|) = 1 or all zero', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 20, 2, 50, 0.3), (alpha) => {
          const weights = computeWeights(alpha);

          // Check each day independently
          for (let t = 0; t < weights.nDays; t++) {
            const offset = t * weights.nStocks;

            // Collect weights for this day
            let sumAbs = 0;
            let hasNonZero = false;

            for (let i = 0; i < weights.nStocks; i++) {
              const w = weights.data[offset + i];
              sumAbs += Math.abs(w);
              if (Math.abs(w) > 1e-15) {
                hasNonZero = true;
              }
            }

            // If all weights are zero (all alpha was NaN), that's valid
            if (!hasNonZero) {
              continue;
            }

            // Otherwise, sum(|weights|) should be 1 within relative tolerance
            // Tolerance: 1e-9 × sum|w|, minimum 1e-15
            const tolerance = Math.max(1e-9 * sumAbs, 1e-15);

            if (Math.abs(sumAbs - 1.0) > tolerance) {
              throw new Error(
                `Scaling constraint violated: day ${t}, sum(|weights|) = ${sumAbs}, ` +
                  `expected 1.0, tolerance = ${tolerance}`
              );
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    /**
     * Property: NaN Alpha Produces Zero Weight
     * **Validates: Requirements 8.1.1, 8.1.5**
     *
     * For all alpha matrices:
     * - Stocks with NaN alpha receive weight exactly 0
     */
    it('**Validates: Requirements 8.1.1, 8.1.5** - NaN alpha produces weight exactly 0', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 20, 2, 50, 0.4), (alpha) => {
          const weights = computeWeights(alpha);

          // Check each element
          for (let t = 0; t < alpha.nDays; t++) {
            for (let i = 0; i < alpha.nStocks; i++) {
              const idx = t * alpha.nStocks + i;
              const alphaVal = alpha.data[idx];
              const weightVal = weights.data[idx];

              if (isNaN(alphaVal)) {
                // NaN alpha must produce weight exactly 0
                if (weightVal !== 0) {
                  throw new Error(
                    `NaN alpha should produce weight exactly 0: day ${t}, stock ${i}, ` +
                      `alpha = NaN, weight = ${weightVal}`
                  );
                }
              }
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    /**
     * Property: Edge Cases - All NaN Alpha
     * Tests that all-NaN alpha produces all-zero weights
     */
    it('handles all-NaN alpha (all weights = 0)', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1, max: 10 }),
              fc.integer({ min: 2, max: 20 })
            )
            .map(([nDays, nStocks]) => {
              const alpha = createMatrix(nDays, nStocks);
              alpha.data.fill(NaN);
              return alpha;
            }),
          (alpha) => {
            const weights = computeWeights(alpha);

            // All weights should be exactly 0
            for (let i = 0; i < weights.data.length; i++) {
              if (weights.data[i] !== 0) {
                throw new Error(
                  `All-NaN alpha should produce all-zero weights: index ${i}, weight = ${weights.data[i]}`
                );
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    /**
     * Property: Edge Cases - All Equal Alpha
     * Tests that all-equal alpha produces equal weights (after demeaning: all 0)
     */
    it('handles all-equal alpha (weights demean to 0)', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.integer({ min: 1, max: 10 }),
              fc.integer({ min: 2, max: 20 }),
              fc.float({ min: -100, max: 100, noNaN: true })
            )
            .map(([nDays, nStocks, value]) => {
              const alpha = createMatrix(nDays, nStocks);
              alpha.data.fill(value);
              return alpha;
            }),
          (alpha) => {
            const weights = computeWeights(alpha);

            // After demeaning, all equal values become 0
            // All weights should be exactly 0
            for (let i = 0; i < weights.data.length; i++) {
              if (Math.abs(weights.data[i]) > 1e-15) {
                throw new Error(
                  `All-equal alpha should produce all-zero weights after demeaning: ` +
                    `index ${i}, weight = ${weights.data[i]}`
                );
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    /**
     * Property: Edge Cases - Mixed NaN
     * Tests various edge case scenarios with mixed NaN values
     */
    it('handles mixed NaN edge cases', () => {
      fc.assert(
        fc.property(edgeCaseMatrix(), (alpha) => {
          const weights = computeWeights(alpha);

          // Verify both constraints for each day
          for (let t = 0; t < weights.nDays; t++) {
            const offset = t * weights.nStocks;

            let sum = 0;
            let sumAbs = 0;
            let hasNonZero = false;

            for (let i = 0; i < weights.nStocks; i++) {
              const w = weights.data[offset + i];
              sum += w;
              sumAbs += Math.abs(w);
              if (Math.abs(w) > 1e-15) {
                hasNonZero = true;
              }

              // Check NaN alpha -> 0 weight
              const alphaVal = alpha.data[offset + i];
              if (isNaN(alphaVal) && w !== 0) {
                throw new Error(
                  `NaN alpha must produce weight 0: day ${t}, stock ${i}, weight = ${w}`
                );
              }
            }

            if (!hasNonZero) {
              continue;
            }

            // Check market neutral
            const tolerance = Math.max(1e-9 * sumAbs, 1e-15);
            if (Math.abs(sum) > tolerance) {
              throw new Error(
                `Edge case market neutral violation: day ${t}, sum = ${sum}`
              );
            }

            // Check scaling
            if (Math.abs(sumAbs - 1.0) > tolerance) {
              throw new Error(
                `Edge case scaling violation: day ${t}, sum|w| = ${sumAbs}`
              );
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    /**
     * Property: Days Processed Independently
     * Verifies that weight computation is independent across days
     */
    it('processes days independently', () => {
      fc.assert(
        fc.property(arbitraryMatrix(2, 10, 3, 15, 0.2), (alpha) => {
          const weights = computeWeights(alpha);

          // Process each day separately and compare
          for (let t = 0; t < alpha.nDays; t++) {
            const singleDayAlpha = createMatrix(1, alpha.nStocks);
            for (let i = 0; i < alpha.nStocks; i++) {
              singleDayAlpha.data[i] = alpha.data[t * alpha.nStocks + i];
            }

            const singleDayWeights = computeWeights(singleDayAlpha);

            // Compare with the corresponding day in full result
            for (let i = 0; i < alpha.nStocks; i++) {
              const expected = singleDayWeights.data[i];
              const actual = weights.data[t * alpha.nStocks + i];

              if (Math.abs(expected - actual) > 1e-10) {
                throw new Error(
                  `Days not processed independently: day ${t}, stock ${i}, ` +
                    `expected ${expected}, got ${actual}`
                );
              }
            }
          }
        }),
        { numRuns: 500 }
      );
    });

    /**
     * Property: Deterministic Computation
     * Verifies that computeWeights is deterministic
     */
    it('produces deterministic results', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 10, 2, 20, 0.2), (alpha) => {
          const weights1 = computeWeights(alpha);
          const weights2 = computeWeights(alpha);

          // Results should be identical
          for (let i = 0; i < weights1.data.length; i++) {
            if (weights1.data[i] !== weights2.data[i]) {
              throw new Error(
                `Non-deterministic result at index ${i}: ` +
                  `run1 = ${weights1.data[i]}, run2 = ${weights2.data[i]}`
              );
            }
          }
        }),
        { numRuns: 500 }
      );
    });
  });
});

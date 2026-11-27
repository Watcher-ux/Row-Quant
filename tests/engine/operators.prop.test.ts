/**
 * Property-based tests for matrix operators using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  scale,
  group_neutralize,
  ts_rank,
  ts_corr,
} from '../../src/engine/operators.js';
import { createMatrix, Matrix } from '../../src/engine/ast.js';

/**
 * Generator for arbitrary matrices with configurable dimensions
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
 * Generator for group/sector label matrices
 * Generates integer labels from 0 to numGroups-1, with some NaN values
 */
function arbitraryGroupMatrix(
  nDays: number,
  nStocks: number,
  minGroups = 1,
  maxGroups = 5,
  nanProbability = 0.1
): fc.Arbitrary<Matrix> {
  return fc.integer({ min: minGroups, max: maxGroups }).chain((numGroups) => {
    return fc
      .array(
        fc.oneof(
          fc.integer({ min: 0, max: numGroups - 1 }),
          fc.constant(NaN)
        ),
        { minLength: nDays * nStocks, maxLength: nDays * nStocks }
      )
      .map((values) => {
        const matrix = createMatrix(nDays, nStocks);
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

describe('Property Tests: Cross-Sectional Operators', () => {
  describe('scale() properties', () => {
    it('**Validates: Requirements 2.1.11, 2.1.12, 2.1.13** - scale output satisfies sum(|values|) = 1 or all zero', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 10, 2, 20, 0.2), (x) => {
          const result = scale(x);

          // Check each day independently
          for (let t = 0; t < result.nDays; t++) {
            const offset = t * result.nStocks;
            
            // Collect non-NaN values
            const validValues: number[] = [];
            for (let i = 0; i < result.nStocks; i++) {
              const value = result.data[offset + i];
              if (!isNaN(value)) {
                validValues.push(value);
              }
            }

            if (validValues.length === 0) {
              // All NaN - valid
              continue;
            }

            // Compute sum of absolute values
            const sumAbs = validValues.reduce((sum, v) => sum + Math.abs(v), 0);

            // Check: sum(|values|) = 1 OR all values are 0
            const allZero = validValues.every((v) => Math.abs(v) < 1e-10);

            if (allZero) {
              // All zero is valid
              continue;
            }

            // Otherwise, sum(|values|) should be 1
            // Use relative tolerance for floating-point comparison
            const tolerance = 1e-9 * sumAbs;
            const minTolerance = 1e-15;
            const effectiveTolerance = Math.max(tolerance, minTolerance);

            if (Math.abs(sumAbs - 1.0) > effectiveTolerance) {
              throw new Error(
                `scale() invariant violated: sum(|values|) = ${sumAbs}, expected 1.0 (day ${t})`
              );
            }
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('preserves NaN positions from input', () => {
      fc.assert(
        fc.property(arbitraryMatrix(1, 10, 2, 20, 0.3), (x) => {
          const result = scale(x);

          // Check that NaN positions are preserved
          for (let i = 0; i < x.data.length; i++) {
            if (isNaN(x.data[i])) {
              if (!isNaN(result.data[i])) {
                throw new Error(
                  `NaN not preserved at index ${i}: input=NaN, output=${result.data[i]}`
                );
              }
            }
          }
        }),
        { numRuns: 500 }
      );
    });

    it('processes days independently', () => {
      fc.assert(
        fc.property(arbitraryMatrix(2, 5, 3, 10, 0.2), (x) => {
          const result = scale(x);

          // Split into individual day matrices and verify same result
          for (let t = 0; t < x.nDays; t++) {
            const singleDay = createMatrix(1, x.nStocks);
            for (let i = 0; i < x.nStocks; i++) {
              singleDay.data[i] = x.data[t * x.nStocks + i];
            }

            const singleDayResult = scale(singleDay);

            // Compare with the corresponding day in full result
            for (let i = 0; i < x.nStocks; i++) {
              const expected = singleDayResult.data[i];
              const actual = result.data[t * x.nStocks + i];

              if (isNaN(expected) && isNaN(actual)) {
                continue;
              }

              if (Math.abs(expected - actual) > 1e-10) {
                throw new Error(
                  `Days not processed independently: day ${t}, stock ${i}, expected ${expected}, got ${actual}`
                );
              }
            }
          }
        }),
        { numRuns: 500 }
      );
    });
  });

  describe('group_neutralize() properties', () => {
    it('**Validates: Requirements 2.1.14, 2.1.15, 2.1.16** - group means are approximately 0 within tolerance', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(1, 10, 3, 20, 0.2).chain((x) => {
            return arbitraryGroupMatrix(x.nDays, x.nStocks, 1, 5, 0.1).map(
              (groups) => ({ x, groups })
            );
          }),
          ({ x, groups }) => {
            const result = group_neutralize(x, groups);

            // Check each day independently
            for (let t = 0; t < result.nDays; t++) {
              const offset = t * result.nStocks;

              // Build map of group -> values
              const groupMap = new Map<number, number[]>();

              for (let i = 0; i < result.nStocks; i++) {
                const value = result.data[offset + i];
                const group = groups.data[offset + i];

                if (!isNaN(value) && !isNaN(group)) {
                  if (!groupMap.has(group)) {
                    groupMap.set(group, []);
                  }
                  groupMap.get(group)!.push(value);
                }
              }

              // For each group, check that mean ≈ 0
              for (const [groupId, values] of groupMap) {
                if (values.length === 0) {
                  continue;
                }

                const groupMean =
                  values.reduce((sum, v) => sum + v, 0) / values.length;

                // Compute tolerance: 1e-9 × max|x| × n, minimum 1e-15
                const maxAbs = Math.max(...values.map((v) => Math.abs(v)));
                const tolerance = Math.max(
                  1e-9 * maxAbs * values.length,
                  1e-15
                );

                if (Math.abs(groupMean) > tolerance) {
                  throw new Error(
                    `group_neutralize() invariant violated: group ${groupId} mean = ${groupMean}, ` +
                      `expected ≈ 0 within tolerance ${tolerance} (day ${t}, group size ${values.length})`
                  );
                }
              }
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('preserves NaN positions from input', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(1, 10, 3, 20, 0.3).chain((x) => {
            return arbitraryGroupMatrix(x.nDays, x.nStocks, 1, 5, 0.1).map(
              (groups) => ({ x, groups })
            );
          }),
          ({ x, groups }) => {
            const result = group_neutralize(x, groups);

            // Check that NaN positions are preserved
            for (let i = 0; i < x.data.length; i++) {
              if (isNaN(x.data[i])) {
                if (!isNaN(result.data[i])) {
                  throw new Error(
                    `NaN not preserved at index ${i}: input=NaN, output=${result.data[i]}`
                  );
                }
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('handles NaN group labels correctly', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(1, 10, 3, 20, 0.2).chain((x) => {
            return arbitraryGroupMatrix(x.nDays, x.nStocks, 1, 5, 0.3).map(
              (groups) => ({ x, groups })
            );
          }),
          ({ x, groups }) => {
            const result = group_neutralize(x, groups);

            // Stocks with NaN group labels should have NaN output (if input is non-NaN)
            // OR preserve the input if already NaN
            for (let i = 0; i < x.data.length; i++) {
              const value = x.data[i];
              const group = groups.data[i];
              const output = result.data[i];

              if (isNaN(group) && !isNaN(value)) {
                // NaN group label with valid value -> output should be NaN
                if (!isNaN(output)) {
                  throw new Error(
                    `Expected NaN output for NaN group at index ${i}, got ${output}`
                  );
                }
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('processes days independently', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(2, 5, 3, 10, 0.2).chain((x) => {
            return arbitraryGroupMatrix(x.nDays, x.nStocks, 1, 4, 0.1).map(
              (groups) => ({ x, groups })
            );
          }),
          ({ x, groups }) => {
            const result = group_neutralize(x, groups);

            // Split into individual day matrices and verify same result
            for (let t = 0; t < x.nDays; t++) {
              const singleDayX = createMatrix(1, x.nStocks);
              const singleDayGroups = createMatrix(1, x.nStocks);
              
              for (let i = 0; i < x.nStocks; i++) {
                singleDayX.data[i] = x.data[t * x.nStocks + i];
                singleDayGroups.data[i] = groups.data[t * x.nStocks + i];
              }

              const singleDayResult = group_neutralize(singleDayX, singleDayGroups);

              // Compare with the corresponding day in full result
              for (let i = 0; i < x.nStocks; i++) {
                const expected = singleDayResult.data[i];
                const actual = result.data[t * x.nStocks + i];

                if (isNaN(expected) && isNaN(actual)) {
                  continue;
                }

                if (Math.abs(expected - actual) > 1e-10) {
                  throw new Error(
                    `Days not processed independently: day ${t}, stock ${i}, expected ${expected}, got ${actual}`
                  );
                }
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});


describe('Property Tests: Time-Series Operators', () => {
  describe('ts_rank() properties', () => {
    /**
     * Property: ts_rank Output Range
     * **Validates: Requirements 3.1.15**
     * 
     * For all matrices x and window size d:
     * - All non-NaN outputs are in [0, 1]
     */
    it('**Validates: Requirements 3.1.15** - ts_rank output range in [0, 1] or NaN', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(5, 20, 2, 10, 0.2),
          fc.integer({ min: 1, max: 5 }),
          (x, d) => {
            // Ensure d is reasonable
            if (d >= x.nDays) {
              d = Math.max(1, Math.floor(x.nDays / 2));
            }

            const result = ts_rank(x, d);

            // Verify all non-NaN values are in [0, 1]
            for (let t = 0; t < result.nDays; t++) {
              for (let i = 0; i < result.nStocks; i++) {
                const val = result.data[t * result.nStocks + i];
                if (!isNaN(val)) {
                  if (val < 0 || val > 1) {
                    throw new Error(
                      `ts_rank output out of range [0, 1]: ${val} at day ${t}, stock ${i}`
                    );
                  }
                }
              }
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('processes each stock independently', () => {
      fc.assert(
        fc.property(
          arbitraryMatrix(10, 20, 3, 10, 0.1),
          fc.integer({ min: 2, max: 5 }),
          (x, d) => {
            // Ensure we have at least 2 stocks and reasonable d
            if (x.nStocks < 2 || d >= x.nDays) {
              return; // Skip this test case
            }

            const result1 = ts_rank(x, d);

            // Modify one stock's values (stock 0)
            const modifiedX = createMatrix(x.nDays, x.nStocks);
            for (let t = 0; t < x.nDays; t++) {
              for (let i = 0; i < x.nStocks; i++) {
                if (i === 0) {
                  // Modify stock 0
                  modifiedX.data[t * x.nStocks + i] = 999 + t;
                } else {
                  // Keep other stocks the same
                  modifiedX.data[t * x.nStocks + i] = x.data[t * x.nStocks + i];
                }
              }
            }

            const result2 = ts_rank(modifiedX, d);

            // Other stocks (not stock 0) should have same results
            for (let t = 0; t < x.nDays; t++) {
              for (let i = 1; i < x.nStocks; i++) {
                const val1 = result1.data[t * x.nStocks + i];
                const val2 = result2.data[t * x.nStocks + i];

                // Both NaN or both equal (with tolerance)
                if (isNaN(val1) && isNaN(val2)) {
                  continue;
                }
                if (Math.abs(val1 - val2) > 1e-10) {
                  throw new Error(
                    `Stock independence violated: day ${t}, stock ${i}, val1=${val1}, val2=${val2}`
                  );
                }
              }
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('single value in window (d=1) receives rank 0.5', () => {
      fc.assert(
        fc.property(arbitraryMatrix(5, 20, 2, 10, 0.2), (x) => {
          const result = ts_rank(x, 1);

          // Every non-NaN value should be 0.5
          for (let t = 0; t < x.nDays; t++) {
            for (let i = 0; i < x.nStocks; i++) {
              const inputVal = x.data[t * x.nStocks + i];
              const outputVal = result.data[t * x.nStocks + i];

              if (!isNaN(inputVal)) {
                if (Math.abs(outputVal - 0.5) > 1e-10) {
                  throw new Error(
                    `Single value should get rank 0.5: got ${outputVal} at day ${t}, stock ${i}`
                  );
                }
              } else {
                // NaN input should produce NaN output
                if (!isNaN(outputVal)) {
                  throw new Error(
                    `NaN input should produce NaN output at day ${t}, stock ${i}`
                  );
                }
              }
            }
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});

describe('Property Tests: ts_corr', () => {
  /**
   * Property: ts_corr Output Range
   * **Validates: Requirements 3.1.21, 3.1.22**
   * 
   * For all matrices x, y and window size d:
   * - All non-NaN outputs are in [-1, 1]
   * - Output is clamped to handle floating-point rounding
   */
  it('**Validates: Requirements 3.1.21, 3.1.22** - ts_corr output range in [-1, 1] or NaN', () => {
    fc.assert(
      fc.property(
        arbitraryMatrix(5, 20, 2, 10, 0.2),
        arbitraryMatrix(5, 20, 2, 10, 0.2),
        fc.integer({ min: 1, max: 5 }),
        (xBase, yBase, d) => {
          // Ensure x and y have same dimensions
          const nDays = Math.min(xBase.nDays, yBase.nDays);
          const nStocks = Math.min(xBase.nStocks, yBase.nStocks);
          
          const x = createMatrix(nDays, nStocks);
          const y = createMatrix(nDays, nStocks);
          
          for (let t = 0; t < nDays; t++) {
            for (let i = 0; i < nStocks; i++) {
              x.data[t * nStocks + i] = xBase.data[t * xBase.nStocks + i];
              y.data[t * nStocks + i] = yBase.data[t * yBase.nStocks + i];
            }
          }

          // Ensure d is reasonable
          if (d >= nDays) {
            d = Math.max(1, Math.floor(nDays / 2));
          }

          const result = ts_corr(x, y, d);

          // Verify all non-NaN values are in [-1, 1]
          for (let t = 0; t < result.nDays; t++) {
            for (let i = 0; i < result.nStocks; i++) {
              const val = result.data[t * result.nStocks + i];
              if (!isNaN(val)) {
                if (val < -1 || val > 1) {
                  throw new Error(
                    `ts_corr output out of range [-1, 1]: ${val} at day ${t}, stock ${i}`
                  );
                }
              }
            }
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});

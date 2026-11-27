# Implementation Plan: Formula Engine

**Feature**: Formula Engine

## Overview

This implementation plan builds the Row-Quant formula engine in five phases: Parser & AST, Matrix Operators, Evaluator, Dependency Graph, and Backtest. Each task is designed to be completable with passing tests before moving to the next. Property-based tests verify all invariants from semantics.md using fast-check.

The engine is pure TypeScript with no external runtime dependencies, operates on Float64Array matrices in row-major order, and handles NaN for missing data. All code goes in src/engine/, all tests in tests/engine/ (unit tests: *.test.ts, property tests: *.prop.test.ts).

## Tasks

- [x] 1. Define AST Types and Matrix Data Structure
  - Create src/engine/ast.ts with all AST node type definitions (Literal, DataField, CellRef, UnaryOp, BinaryOp, FunctionCall)
  - Define Matrix interface (data: Float64Array, nDays: number, nStocks: number)
  - Implement matrix helpers: createMatrix(), getElement(), setElement()
  - Write unit tests for matrix helpers with bounds checking
  - _Requirements: 1.1, 9.1_

- [x] 2. Implement Tokenizer
  - Create src/engine/parser.ts with Token type and tokenize() function
  - Recognize number literals, identifiers, operators (+, -, *, /, <, >, <=, >=, ==), delimiters (, ), ,
  - Track line and column positions for error reporting
  - Write unit tests for tokenize() with various inputs
  - _Requirements: 1.1_

- [x] 3. Implement Recursive-Descent Parser
  - Define Result<T, E> and ParseError types
  - Implement parse() with parseExpression(), parseComparison(), parseAddSub(), parseMulDiv(), parseUnary(), parsePrimary()
  - Implement helper functions: match(), check(), consume(), previous(), isAtEnd(), isCellReference()
  - Handle operator precedence: comparisons < add/sub < mul/div < unary
  - Return ParseError with position, line, column for invalid input
  - Write unit tests for valid expressions, invalid expressions, operator precedence
  - _Requirements: 1.1_

- [x] 4. Implement AST Printer and Round-Trip Property Test
  - Implement print() function that serializes AST to string
  - Add parentheses to preserve precedence
  - Create tests/engine/parser.prop.test.ts
  - Implement arbitraryAST() generator using fc.letrec() with maxDepth: 5
  - Write property test: ∀ ast: parse(print(ast)) = Ok(ast)
  - Run with 1000+ random ASTs
  - _Requirements: 1.2_
  - _Property: Parser Round-Trip_

- [x] 5. Implement rank() and zscore() Cross-Sectional Operators
  - Create src/engine/operators.ts
  - Implement rank() with tie handling, edge cases (all NaN, single value, all equal)
  - Implement zscore() with edge cases (all NaN, all equal, std = 0)
  - Write unit tests for rank() and zscore() edge cases
  - _Requirements: 2.1_

- [x] 6. Property Tests for rank()
  - Create tests/engine/operators.prop.test.ts
  - Implement arbitraryMatrix() generator with configurable dimensions
  - Write property test: rank output range in [0, 1] or NaN
  - Write property test: rank monotonicity (x[i] < x[j] ⟹ rank(x)[i] ≤ rank(x)[j])
  - Write property test: rank transform invariance (rank(x) = rank(x³) for integer matrices)
  - _Requirements: 2.1_
  - _Properties: Rank Output Range, Rank Monotonicity, Rank Transform Invariance_

- [x] 7. Implement scale() and group_neutralize() Cross-Sectional Operators
  - Implement scale() with edge cases (all NaN, all zero, mixed NaN)
  - Implement group_neutralize() with edge cases (all NaN groups, single-stock groups)
  - Write unit tests for scale() and group_neutralize() edge cases
  - Implement arbitraryGroupMatrix() generator for sector labels
  - Write property test: scale output satisfies sum(|values|) = 1 or all zero
  - Write property test: group_neutralize group means ≈ 0 (within tolerance)
  - _Requirements: 2.1_
  - _Property: group_neutralize Mean Zero_

- [x] 8. Implement ts_delay(), ts_delta(), ts_mean() Time-Series Operators
  - Implement ts_delay() with first d rows as NaN
  - Implement ts_delta() (x[t] - x[t-d])
  - Implement ts_mean() with rolling window, NaN for insufficient data
  - Write unit tests for all three operators
  - Write property test: ts_delay shift invariance (result[t] = x[t-d] for t >= d)
  - _Requirements: 3.1_
  - _Property: ts_delay Shift Invariance_

- [x] 9. Implement ts_sum(), ts_std_dev(), ts_rank() Time-Series Operators
  - Implement ts_sum() with rolling window
  - Implement ts_std_dev() (population std)
  - Implement ts_rank() (rank within window in [0, 1])
  - Handle insufficient window data (< d valid values → NaN) for all operators
  - Write unit tests for all three operators
  - Write property test: ts_rank output range in [0, 1] or NaN
  - _Requirements: 3.1_
  - _Property: ts_rank Output Range_

- [x] 10. Implement ts_decay_linear() and ts_corr() Time-Series Operators
  - Implement ts_decay_linear() with linear decay weights (d, d-1, ..., 1)
  - Verify newest value gets heaviest weight
  - Implement ts_corr() (Pearson correlation over window)
  - Handle insufficient window data
  - Write unit tests for both operators
  - Write property test: ts_corr output range in [-1, 1] or NaN
  - _Requirements: 3.1_
  - _Property: ts_corr Output Range_

- [x] 11. Implement All Element-Wise Operators
  - Implement arithmetic: add(), sub(), mul(), div() (div by 0 → NaN)
  - Implement unary: neg(), abs_op(), sign_op(), log_op() (log ≤0 → NaN), sqrt_op() (sqrt <0 → NaN)
  - Implement comparison: lt(), gt(), lte(), gte(), eq() (return 1 or 0)
  - Implement max_op(), min_op(), if_else()
  - Implement scalar_to_matrix() for broadcasting
  - Verify NaN propagation for all operators
  - Write unit tests for all element-wise operators and scalar broadcasting
  - _Requirements: 4.1_

- [x] 12. Implement Complete Evaluator with Cell References
  - Create src/engine/evaluate.ts
  - Define EvaluationContext (data fields + cell map), EvaluationError
  - Implement evaluate() with pattern matching on AST node types
  - Handle Literal (broadcast), DataField (lookup), CellRef (lookup), UnaryOp, BinaryOp, FunctionCall
  - Implement applyUnaryOp(), applyBinaryOp(), applyFunction() for operator dispatch
  - Validate function argument counts in applyFunction()
  - Implement error propagation (short-circuit on first error)
  - Write unit tests for each AST node type, undefined references, operator dispatch, argument validation
  - _Requirements: 5.1, 6.1_

- [x] 13. Property Test for Evaluation Robustness
  - Implement arbitraryContext() generator for property tests
  - Write property test: ∀ ast, ctx: evaluate(ast, ctx) never throws exceptions
  - Verify evaluate() always returns Result<Matrix, EvaluationError>
  - Test with diverse ASTs and contexts including undefined references
  - Run with 1000+ random cases
  - _Requirements: 6.1_
  - _Property: Evaluation Robustness_

- [x] 14. Implement Dependency Graph Construction
  - Create src/engine/graph.ts
  - Define CellDefinition, DependencyGraph class
  - Implement extractCellReferences() (traverse AST, collect CellRef nodes)
  - Implement addCell() (add cell and extract dependencies)
  - Implement getDependencies() (return dependency list for a cell)
  - Store graph as Map<string, string[]>
  - Write unit tests for extractCellReferences() and addCell()
  - _Requirements: 7.1_

- [x] 15. Implement Topological Sort and Cycle Detection
  - Define CycleError type (message + cycle list)
  - Implement getEvaluationOrder() using DFS with visited/visiting sets
  - Build topological order in reverse post-order
  - Return CycleError when cycle detected with cycle path
  - Handle empty graph (return empty order)
  - Write unit tests for acyclic graphs, cyclic graphs, single cell
  - _Requirements: 7.1_

- [x] 16. Property Test for Topological Order
  - Implement arbitraryAcyclicGraph() generator
  - Write property test: ∀ graph G (acyclic): ∀ cell c, dep d of c: index(d) < index(c) in order
  - Run with diverse acyclic graphs
  - _Requirements: 7.1_
  - _Property: Dependency Graph Topological Order_

- [x] 17. Implement Weight Computation for Backtest
  - Create src/engine/backtest.ts
  - Define BacktestResult interface
  - Implement computeWeights() function
  - Convert alpha to weights: NaN → 0
  - Demean weights over valid (non-NaN) alpha stocks: subtract mean so sum = 0
  - Scale weights: divide by sum(|w|) so sum(|w|) = 1
  - Handle all-zero weights (no scaling needed)
  - Write unit tests for weight computation
  - _Requirements: 8.1_

- [x] 18. Property Test for Weight Constraints
  - Write property test: ∀ alpha: ∀ t: sum(weights(alpha)[t]) = 0 (within tolerance)
  - Write property test: ∀ alpha: ∀ t: sum(|weights(alpha)[t]|) = 1 or all zero
  - Run with diverse alpha matrices
  - _Requirements: 8.1_
  - _Property: Backtest Weight Constraints_

- [x] 19. Implement PnL Computation
  - Implement computePnL() function
  - Apply delay-1: weights[t] * returns[t+1]
  - Compute dailyPnL[t+1] = sum over stocks of w[t][i] * r[t+1][i]
  - Handle NaN returns (skip in sum)
  - Build cumulative PnL array
  - Verify PnL array length = nDays - 1
  - Write unit tests for PnL computation and delay-1 relationship
  - _Requirements: 8.1_

- [x] 20. Implement Performance Metrics (Sharpe, Annual Return, Turnover, Max Drawdown)
  - Implement computeSharpe() (mean / std * sqrt(252); handle zero std)
  - Implement computeAnnualReturn() (mean * 252)
  - Implement computeTurnover() (average daily sum|w[t] - w[t-1]|)
  - Implement computeMaxDrawdown() (track peak, compute max(peak - cumPnL))
  - Implement backtest() function integrating all components
  - Write unit tests for each metric function
  - Write unit tests for complete backtest() and edge cases (all NaN alpha, partial NaN)
  - _Requirements: 8.1_

- [x] 21. Integration Tests for End-to-End Workflows
  - Create tests/engine/integration.test.ts
  - Write test: parse simple expression → evaluate → verify result
  - Write test: parse complex expression → evaluate → verify result
  - Write test: parse → evaluate → backtest → verify metrics
  - Write test: cell references → dependency graph → evaluation order → evaluate
  - Write test: cyclic references → cycle detection → error
  - Write test: undefined cell reference → evaluation error
  - Write test: undefined data field → evaluation error
  - Write test: parse error → no evaluation
  - Create sample market data for integration tests
  - Write test: realistic alpha expression on sample data
  - _Requirements: All_

- [x] 22. Performance Validation
  - Create performance benchmark suite
  - Benchmark: Full backtest on 2500 days × 100 stocks completes in under 100ms
  - Profile for bottlenecks if target not met
  - Optimize identified bottlenecks if needed
  - Document performance results
  - _Requirements: Design performance considerations_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "5", "8", "11"] },
    { "id": 2, "tasks": ["4", "6", "7", "9"] },
    { "id": 3, "tasks": ["10", "12", "14"] },
    { "id": 4, "tasks": ["13", "15", "17"] },
    { "id": 5, "tasks": ["16", "18", "19"] },
    { "id": 6, "tasks": ["20", "21"] },
    { "id": 7, "tasks": ["22"] }
  ]
}
```

## Notes

- **Property-Based Tests (PBT)**: Tasks 4, 6, 7, 8, 9, 10, 13, 16, 18 include property tests using fast-check. Each property test verifies an invariant from the design document with 1000+ random inputs.

- **Test Organization**: Unit tests go in tests/engine/*.test.ts (mirroring src/engine/), property tests in tests/engine/*.prop.test.ts.

- **TypeScript Strict Mode**: All code must compile with strict: true, no `any` types allowed.

- **Pure Functions**: All engine functions must be pure (no side effects, deterministic).

- **Error Handling**: No thrown exceptions - all errors returned as Result<T, E> types.

- **Matrix Layout**: Float64Array in row-major order: element [day][stock] at index day * nStocks + stock.

- **NaN Handling**: Missing data is NaN (never 0). Most operators propagate NaN except cross-sectional operators which ignore NaN while preserving positions.

- **Performance Target**: Full backtest on 2500 days × 100 stocks should complete in under 100ms.

- **Dependencies**: No external runtime dependencies. Dev dependencies: TypeScript, Vitest, fast-check, Vite.

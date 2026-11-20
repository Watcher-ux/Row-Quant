# Requirements Document

**Feature**: Formula Engine

## Introduction

The Row-Quant formula engine is a pure TypeScript computation system that parses WorldQuant BRAIN-style expressions, evaluates them over historical financial data matrices, and produces backtested alpha signals with performance metrics. This document specifies the functional requirements for five core subsystems: a recursive-descent parser that produces strongly-typed ASTs; a comprehensive operator library implementing cross-sectional, time-series, and element-wise operations; an evaluator that recursively computes matrices from AST nodes; a dependency graph manager that tracks cell references and detects cycles; and a delay-1 backtest module that converts alpha matrices into portfolio performance metrics.

The engine operates entirely in-browser within a Web Worker, ensuring non-blocking recalculation. Every value is a matrix (days × stocks) represented as Float64Array in row-major order, with NaN representing missing data. The system is designed to be deterministic, pure (no side effects), and robust (no thrown exceptions).

## Requirements

### 1. Parser Requirements

### 1.1 Expression Parsing

**WHEN** the user provides a source expression string, **THE** parser **SHALL** tokenize the input and construct a strongly-typed AST using recursive-descent with correct operator precedence, **AND** return either a valid AST node or a ParseError with precise position information.

**Acceptance Criteria:**
1.1.1. Parser successfully parses valid arithmetic expressions with operators: +, -, *, /, unary -
1.1.2. Parser successfully parses function calls with 0 to 3 arguments
1.1.3. Parser successfully parses data field references: open, high, low, close, volume, vwap, returns, sector
1.1.4. Parser successfully parses cell references: A1, B12, Z99, etc.
1.1.5. Parser successfully parses comparison operators: <, >, <=, >=, ==
1.1.6. Parser respects operator precedence: comparisons < addition/subtraction < multiplication/division < unary
1.1.7. Parser supports parenthesized expressions for grouping
1.1.8. Parser tokenizer supports exponent notation: 1e-5, 1E+21, 1e10, etc.
1.1.9. Parser returns ParseError with message, position, line, and column for syntax errors
1.1.10. Parser rejects expressions with unmatched parentheses
1.1.11. Parser rejects expressions with invalid identifiers
1.1.12. Parser rejects expressions with unexpected tokens

### 1.2 AST Serialization

**WHEN** the engine needs to verify parser correctness, **THE** parser **SHALL** provide a print function that serializes any valid AST back to source text such that parse(print(ast)) produces an equivalent AST.

**Acceptance Criteria:**
1.2.1. print() generates valid source text for any AST node type
1.2.2. parse(print(ast)) succeeds for all valid ASTs with non-negative finite literals
1.2.3. parse(print(ast)) produces an AST equivalent to the original
1.2.4. Round-trip property verified by fast-check property test with generated literals constrained to non-negative finite numbers only

## 2. Cross-Sectional Operator Requirements

### 2.1 Cross-Sectional Operations

**WHEN** the evaluator applies a cross-sectional operator to a matrix, **THE** operator **SHALL** process each day independently across stocks, ignoring NaN values while preserving their positions, **AND** maintain mathematical invariants specific to each operation.

**Acceptance Criteria:**
2.1.1. rank() returns values in [0, 1] or NaN for all matrix elements
2.1.2. rank() assigns 0.5 to a single valid value in a row
2.1.3. rank() assigns average rank to tied values
2.1.4. rank() is monotonic: if x[t][i] < x[t][j], then rank(x)[t][i] <= rank(x)[t][j]
2.1.5. rank() is invariant to strictly increasing transforms: rank(M) = rank(M³) for integer-valued matrices, verified by property test using cubic transform
2.1.6. rank() preserves NaN positions from input
2.1.7. zscore() returns (x - mean) / std for each day
2.1.8. zscore() returns 0 for all-equal rows
2.1.9. zscore() ignores NaN values in mean and std calculations
2.1.10. zscore() preserves NaN positions from input
2.1.11. scale() normalizes each day so sum(|values|) = 1
2.1.12. scale() returns all zeros for all-zero rows
2.1.13. scale() preserves NaN positions from input
2.1.14. group_neutralize() subtracts group mean within each sector
2.1.15. group_neutralize() produces group mean ≈ 0 for each sector with relative tolerance: 1e-9 × max|x| × n, minimum 1e-15
2.1.16. group_neutralize() preserves NaN positions from input
2.1.17. All cross-sectional operators process days independently (no cross-day dependencies)

## 3. Time-Series Operator Requirements

### 3.1 Time-Series Operations

**WHEN** the evaluator applies a time-series operator to a matrix with window parameter d, **THE** operator **SHALL** process each stock independently across days using a rolling window of size d, **AND** return NaN for windows with insufficient valid data.

**Acceptance Criteria:**
3.1.1. ts_delay(x, d) returns x[t-d] for t >= d
3.1.2. ts_delay(x, d) returns NaN for first d rows
3.1.3. ts_delay(x, d) preserves NaN values: if x[t-d] is NaN, result[t] is NaN
3.1.4. ts_delay(x, d) maintains shift invariance property
3.1.5. ts_delta(x, d) returns x[t] - x[t-d]
3.1.6. ts_delta(x, d) returns NaN for first d rows
3.1.7. ts_mean(x, d) returns mean of last d values
3.1.8. ts_mean(x, d) returns NaN if window has fewer than d valid values
3.1.9. ts_sum(x, d) returns sum of last d values
3.1.10. ts_sum(x, d) returns NaN if window has fewer than d valid values
3.1.11. ts_std_dev(x, d) returns population standard deviation of last d values
3.1.12. ts_std_dev(x, d) returns NaN if window has fewer than d valid values
3.1.13. ts_rank(x, d) returns rank of x[t] within last d values in [0, 1]
3.1.14. ts_rank(x, d) returns NaN if window has fewer than d valid values
3.1.15. ts_rank output range: all non-NaN values in [0, 1]
3.1.16. ts_decay_linear(x, d) returns weighted mean with weights d, d-1, ..., 1
3.1.17. ts_decay_linear(x, d) gives heaviest weight to newest value
3.1.18. ts_decay_linear(x, d) returns NaN if window has fewer than d valid values
3.1.19. ts_corr(x, y, d) returns Pearson correlation over window
3.1.20. ts_corr(x, y, d) returns NaN if window has fewer than d valid values
3.1.21. ts_corr(x, y, d) returns value in [-1, 1] or NaN, with output clamped to handle floating-point rounding
3.1.22. ts_corr(x, y, d) range property verified by property test: all non-NaN outputs in [-1, 1]
3.1.23. All time-series operators process stocks independently (no cross-stock dependencies)
3.1.24. Window parameter d must be >= 1 (validated by evaluator)

## 4. Element-Wise Operator Requirements

### 4.1 Element-Wise Operations

**WHEN** the evaluator applies an element-wise operator to matrix operands, **THE** operator **SHALL** apply the operation to corresponding elements, broadcasting scalars when necessary, **AND** propagate NaN according to standard floating-point rules.

**Acceptance Criteria:**
4.1.1. add(x, y) returns x[t][i] + y[t][i] for all elements
4.1.2. sub(x, y) returns x[t][i] - y[t][i] for all elements
4.1.3. mul(x, y) returns x[t][i] * y[t][i] for all elements
4.1.4. div(x, y) returns x[t][i] / y[t][i] for all elements
4.1.5. div(x, y) returns NaN when y[t][i] = 0
4.1.6. neg(x) returns -x[t][i] for all elements
4.1.7. abs(x) returns |x[t][i]| for all elements
4.1.8. sign(x) returns 1 if x[t][i] > 0, -1 if x[t][i] < 0, 0 if x[t][i] = 0
4.1.9. log(x) returns natural logarithm of x[t][i]
4.1.10. log(x) returns NaN for x[t][i] <= 0
4.1.11. sqrt(x) returns square root of x[t][i]
4.1.12. sqrt(x) returns NaN for x[t][i] < 0
4.1.13. max(x, y) returns maximum of x[t][i] and y[t][i]
4.1.14. min(x, y) returns minimum of x[t][i] and y[t][i]
4.1.15. lt(x, y) returns 1 if x[t][i] < y[t][i], else 0
4.1.16. gt(x, y) returns 1 if x[t][i] > y[t][i], else 0
4.1.17. lte(x, y) returns 1 if x[t][i] <= y[t][i], else 0
4.1.18. gte(x, y) returns 1 if x[t][i] >= y[t][i], else 0
4.1.19. eq(x, y) returns 1 if x[t][i] == y[t][i], else 0
4.1.20. if_else(cond, a, b) returns a[t][i] if cond[t][i] != 0, else b[t][i]
4.1.21. if_else(cond, a, b) propagates NaN from cond or the selected branch only; unselected branch NaN does not propagate
4.1.22. All element-wise operators propagate NaN from their operands: if any operand is NaN, result is NaN
4.1.23. Scalar values broadcast to matrices: scalar op matrix applies scalar to all elements
4.1.24. Matrix dimensions must match for binary operators (validated by evaluator)

## 5. Cell Reference Requirements

### 5.1 Cell Reference Resolution

**WHEN** the evaluator encounters a cell reference in an AST, **THE** evaluator **SHALL** resolve the reference from the evaluation context, **AND** return an error if the cell is undefined or part of a dependency cycle.

**Acceptance Criteria:**
5.1.1. Cell references (A1, B12, Z99, etc.) resolve to matrix values from context
5.1.2. Undefined cell references return EvaluationError with cell name
5.1.3. Cell reference resolution is case-insensitive (A1 = a1)
5.1.4. Cell references support full grid: columns A-Z, rows 1-99
5.1.5. Evaluator validates cell reference format during evaluation

## 6. Evaluator Requirements

### 6.1 AST Evaluation

**WHEN** the engine needs to compute a matrix from an expression, **THE** evaluator **SHALL** recursively traverse the AST, dispatch to appropriate operators, resolve data fields and cell references from context, **AND** return either a result matrix or an error.

**Acceptance Criteria:**
6.1.1. Evaluator processes Literal nodes by broadcasting scalar to matrix
6.1.2. Evaluator processes DataField nodes by looking up field in context
6.1.3. Evaluator processes CellRef nodes by looking up cell in context
6.1.4. Evaluator processes UnaryOp nodes by evaluating operand then applying operator
6.1.5. Evaluator processes BinaryOp nodes by evaluating both operands then applying operator
6.1.6. Evaluator processes FunctionCall nodes by evaluating all arguments then applying function
6.1.7. Evaluator returns EvaluationError for undefined data fields
6.1.8. Evaluator returns EvaluationError for undefined cell references
6.1.9. Evaluator returns EvaluationError for invalid AST node types
6.1.10. Evaluator returns EvaluationError for function calls with wrong argument count
6.1.11. Evaluator propagates errors from child nodes immediately (short-circuit)
6.1.12. Evaluation is deterministic: same AST and context always produce same result
6.1.13. Evaluation has no side effects on input parameters
6.1.14. Evaluation robustness: evaluate() never throws exceptions and returns Result<Matrix, EvaluationError> for any valid AST and context, verified by property test

## 7. Dependency Graph Requirements

### 7.1 Dependency Tracking

**WHEN** cells reference other cells, **THE** dependency graph **SHALL** extract all cell references from ASTs, build a directed graph, perform topological sorting to determine evaluation order, **AND** detect and report any dependency cycles.

**Acceptance Criteria:**
7.1.1. Dependency graph extracts all CellRef nodes from ASTs
7.1.2. Dependency graph builds directed edges from cell to its dependencies
7.1.3. Dependency graph computes topological sort for acyclic graphs
7.1.4. Topological sort ensures dependencies are evaluated before dependents
7.1.5. Topological sort property verified: all deps appear before dependents in order
7.1.6. Dependency graph detects cycles using DFS with visited/visiting sets
7.1.7. Cycle detection returns CycleError with list of cells in cycle
7.1.8. Cycle detection identifies all strongly connected components
7.1.9. Empty graph returns empty evaluation order (valid)
7.1.10. Single cell with no dependencies returns that cell (valid)
7.1.11. Graph supports incremental updates when cell formulas change

## 8. Backtest Requirements

### 8.1 Portfolio Backtesting

**WHEN** the engine needs to evaluate an alpha signal's performance, **THE** backtest module **SHALL** convert the alpha matrix to daily portfolio weights with delay-1, apply market-neutral and scaling constraints, compute daily PnL, **AND** calculate performance metrics including Sharpe ratio, annual return, turnover, and maximum drawdown.

**Acceptance Criteria:**
8.1.1. Alpha values convert to weights: NaN → 0, stocks with NaN alpha receive weight exactly 0
8.1.2. Weights are demeaned each day over stocks with valid (non-NaN) alpha: sum(weights[t]) = 0 with relative tolerance: 1e-9 × sum|w|, minimum 1e-15
8.1.3. Weights are scaled each day: sum(|weights[t]|) = 1 or all weights = 0 with relative tolerance: 1e-9 × sum|w|, minimum 1e-15
8.1.4. Weight constraints verified by property test for all days
8.1.5. WHERE a stock has NaN alpha at time t, THE System SHALL assign weight exactly 0 to that stock
8.1.6. Daily PnL computed with delay-1: PnL[t+1] = sum(weights[t] * returns[t+1])
8.1.7. PnL array has length nDays - 1 (due to delay-1)
8.1.8. Sharpe ratio = mean(PnL) / std(PnL) * sqrt(252)
8.1.9. Annual return = mean(PnL) * 252
8.1.10. Turnover = mean over t of sum(|weights[t] - weights[t-1]|)
8.1.11. Turnover >= 0
8.1.12. Max drawdown computed on cumulative PnL curve
8.1.13. Max drawdown >= 0
8.1.14. Max drawdown = max over t of (peak - cumPnL[t]) where peak = max(cumPnL[0..t])
8.1.15. Backtest handles all-NaN alpha (all weights = 0, PnL = 0)
8.1.16. Backtest handles partial NaN in alpha (NaN → 0 weight)

## 9. Matrix Data Model Requirements

### 9.1 Matrix Representation

**WHEN** the engine stores or manipulates financial data, **THE** matrix data structure **SHALL** use Float64Array in row-major order with explicit dimensions, **AND** represent missing values as NaN.

**Acceptance Criteria:**
9.1.1. Matrix stores data as Float64Array (row-major layout)
9.1.2. Matrix stores nDays and nStocks dimensions
9.1.3. Matrix data.length = nDays * nStocks
9.1.4. Matrix element access: data[day * nStocks + stock]
9.1.5. Missing values represented as NaN, never 0
9.1.6. Matrix dimensions are positive integers
9.1.7. Matrix indices are 0-based: day ∈ [0, nDays), stock ∈ [0, nStocks)
9.1.8. createMatrix() allocates Float64Array of correct size
9.1.9. getElement() bounds-checks indices
9.1.10. setElement() bounds-checks indices

## 10. Error Handling Requirements

### 10.1 Error Propagation

**WHEN** any operation encounters an error condition, **THE** engine **SHALL** return a typed error result with descriptive message and context, **AND** never throw exceptions that would crash the worker.

**Acceptance Criteria:**
10.1.1. Parse errors include message, position, line, and column
10.1.2. Evaluation errors include message and reference to failing AST node
10.1.3. Cycle errors include message and list of cells in cycle
10.1.4. All error paths return Result<T, E> instead of throwing
10.1.5. Errors propagate up the call stack without exceptions
10.1.6. Invalid operations (log of negative, sqrt of negative) return NaN, not errors
10.1.7. Division by zero returns NaN, not error
10.1.8. Undefined references return errors (cell, data field)
10.1.9. Invalid function arguments return errors (wrong count, wrong types)
10.1.10. Error messages are descriptive and actionable

## Glossary

- **AST (Abstract Syntax Tree)**: A tree representation of the syntactic structure of a source expression, where each node represents a construct in the source.
- **Alpha**: A signal or strategy that attempts to predict future returns; represented as a matrix of values where higher values indicate stronger buy signals.
- **Cross-Sectional**: Operations that process data across stocks for a single day (e.g., ranking stocks by their closing prices on a given day).
- **Delay-1**: A backtesting convention where today's weights are applied to tomorrow's returns, simulating realistic trading where positions are established at the end of day t and held through day t+1.
- **EARS Format**: Easy Approach to Requirements Syntax, a structured format for writing clear, unambiguous requirements using WHEN/THE/SHALL keywords.
- **Market Neutral**: A portfolio constraint where the sum of all weights equals zero, meaning the portfolio has no net long or short exposure to the overall market.
- **Matrix**: A two-dimensional array of numbers representing financial data, stored in row-major order as Float64Array with dimensions [days][stocks].
- **NaN (Not a Number)**: A special floating-point value representing missing, undefined, or invalid data; propagates through most operations.
- **Property-Based Testing**: A testing methodology that verifies properties hold for all possible inputs by generating random test cases (using fast-check).
- **Rank**: The percentile position of a value within a set, expressed as a number in [0, 1] where 0 is the lowest and 1 is the highest.
- **Recursive-Descent Parser**: A top-down parsing technique where each non-terminal in the grammar corresponds to a function.
- **Row-Major Order**: A matrix storage layout where elements are stored row-by-row in contiguous memory; element [t][i] is at index t * nStocks + i.
- **Sharpe Ratio**: A measure of risk-adjusted return, calculated as mean return divided by standard deviation, annualized by multiplying by sqrt(252).
- **Time-Series**: Operations that process data across days for a single stock (e.g., computing the 5-day moving average of a stock's closing prices).
- **Topological Sort**: An ordering of nodes in a directed acyclic graph where all dependencies appear before their dependents.
- **Turnover**: A measure of portfolio trading activity, calculated as the average daily sum of absolute weight changes.
- **Web Worker**: A browser API that runs JavaScript in a background thread, preventing long-running computations from blocking the UI.

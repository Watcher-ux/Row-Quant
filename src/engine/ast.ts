/**
 * AST Type Definitions and Matrix Data Structure for Row-Quant Formula Engine
 *
 * This module defines the strongly-typed Abstract Syntax Tree (AST) for WorldQuant BRAIN-style
 * expressions and the Matrix data structure used throughout the engine.
 */

// ============================================================================
// Matrix Data Structure
// ============================================================================

/**
 * Matrix represents financial data as a 2D array stored in row-major order.
 * - data: Float64Array in row-major layout: element [day][stock] at index day * nStocks + stock
 * - nDays: number of trading days (rows)
 * - nStocks: number of stocks (columns)
 * - Missing values are represented as NaN (never 0)
 */
export interface Matrix {
  data: Float64Array;
  nDays: number;
  nStocks: number;
}

/**
 * Creates a new Matrix with the specified dimensions.
 * All elements are initialized to 0.
 *
 * @param nDays - Number of trading days (must be > 0)
 * @param nStocks - Number of stocks (must be > 0)
 * @returns A new Matrix with allocated Float64Array
 * @throws Error if dimensions are not positive integers
 */
export function createMatrix(nDays: number, nStocks: number): Matrix {
  if (nDays <= 0 || nStocks <= 0) {
    throw new Error(`Matrix dimensions must be positive: nDays=${nDays}, nStocks=${nStocks}`);
  }
  if (!Number.isInteger(nDays) || !Number.isInteger(nStocks)) {
    throw new Error(`Matrix dimensions must be integers: nDays=${nDays}, nStocks=${nStocks}`);
  }

  return {
    data: new Float64Array(nDays * nStocks),
    nDays,
    nStocks,
  };
}

/**
 * Gets the element at the specified day and stock index.
 *
 * @param m - The matrix to read from
 * @param day - Day index (0-based, must be in [0, nDays))
 * @param stock - Stock index (0-based, must be in [0, nStocks))
 * @returns The value at the specified position
 * @throws Error if indices are out of bounds
 */
export function getElement(m: Matrix, day: number, stock: number): number {
  if (day < 0 || day >= m.nDays) {
    throw new Error(`Day index out of bounds: day=${day}, nDays=${m.nDays}`);
  }
  if (stock < 0 || stock >= m.nStocks) {
    throw new Error(`Stock index out of bounds: stock=${stock}, nStocks=${m.nStocks}`);
  }

  return m.data[day * m.nStocks + stock];
}

/**
 * Sets the element at the specified day and stock index.
 *
 * @param m - The matrix to write to
 * @param day - Day index (0-based, must be in [0, nDays))
 * @param stock - Stock index (0-based, must be in [0, nStocks))
 * @param value - The value to set
 * @throws Error if indices are out of bounds
 */
export function setElement(m: Matrix, day: number, stock: number, value: number): void {
  if (day < 0 || day >= m.nDays) {
    throw new Error(`Day index out of bounds: day=${day}, nDays=${m.nDays}`);
  }
  if (stock < 0 || stock >= m.nStocks) {
    throw new Error(`Stock index out of bounds: stock=${stock}, nStocks=${m.nStocks}`);
  }

  m.data[day * m.nStocks + stock] = value;
}

// ============================================================================
// AST Node Type Definitions
// ============================================================================

/**
 * Data field names representing available market data.
 */
export type DataFieldName = 'open' | 'high' | 'low' | 'close' | 'volume' | 'vwap' | 'returns' | 'sector';

/**
 * Unary operator names.
 */
export type UnaryOperator = 'neg' | 'abs' | 'sign' | 'log' | 'sqrt';

/**
 * Binary operator names.
 */
export type BinaryOperator = 'add' | 'sub' | 'mul' | 'div' | 'lt' | 'gt' | 'lte' | 'gte' | 'eq' | 'max' | 'min';

/**
 * Function names for cross-sectional, time-series, and conditional operators.
 */
export type FunctionName =
  // Cross-sectional
  | 'rank'
  | 'zscore'
  | 'scale'
  | 'group_neutralize'
  // Time-series
  | 'ts_delay'
  | 'ts_delta'
  | 'ts_mean'
  | 'ts_sum'
  | 'ts_std_dev'
  | 'ts_rank'
  | 'ts_decay_linear'
  | 'ts_corr'
  // Conditional
  | 'if_else';

/**
 * AST Node representing all valid expression constructs.
 * This is a discriminated union type for type-safe pattern matching.
 */
export type ASTNode =
  | { type: 'Literal'; value: number }
  | { type: 'DataField'; name: DataFieldName }
  | { type: 'CellRef'; cell: string }
  | { type: 'UnaryOp'; op: UnaryOperator; operand: ASTNode }
  | { type: 'BinaryOp'; op: BinaryOperator; left: ASTNode; right: ASTNode }
  | { type: 'FunctionCall'; name: FunctionName; args: ASTNode[] };

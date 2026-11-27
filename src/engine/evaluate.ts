/**
 * Evaluator for Row-Quant Formula Engine
 *
 * This module recursively evaluates AST nodes in context to produce result matrices.
 * It handles data fields, cell references, operators, and function calls with proper
 * error propagation.
 */

import type { ASTNode, Matrix, DataFieldName, UnaryOperator, BinaryOperator, FunctionName } from './ast.js';
import { scalar_to_matrix } from './operators.js';
import * as ops from './operators.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Evaluation context containing market data and resolved cell values.
 */
export interface EvaluationContext {
  data: {
    open: Matrix;
    high: Matrix;
    low: Matrix;
    close: Matrix;
    volume: Matrix;
    vwap: Matrix;
    returns: Matrix;
    sector: Matrix;
  };
  cells: Map<string, Matrix>; // Resolved cell values (A1 -> matrix)
}

/**
 * Evaluation error with descriptive message and reference to failing node.
 */
export interface EvaluationError {
  message: string;
  node: ASTNode;
}

/**
 * Result type for evaluation operations.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// ============================================================================
// Main Evaluator
// ============================================================================

/**
 * Recursively evaluates an AST node in the given context to produce a result matrix.
 *
 * @param ast - The AST node to evaluate
 * @param context - Evaluation context with data fields and cell values
 * @returns Result containing either a matrix or an evaluation error
 */
export function evaluate(ast: ASTNode, context: EvaluationContext): Result<Matrix, EvaluationError> {
  switch (ast.type) {
    case 'Literal':
      return evaluateLiteral(ast, context);

    case 'DataField':
      return evaluateDataField(ast, context);

    case 'CellRef':
      return evaluateCellRef(ast, context);

    case 'UnaryOp':
      return evaluateUnaryOp(ast, context);

    case 'BinaryOp':
      return evaluateBinaryOp(ast, context);

    case 'FunctionCall':
      return evaluateFunctionCall(ast, context);

    default:
      return {
        ok: false,
        error: {
          message: `Unknown AST node type: ${(ast as any).type}`,
          node: ast,
        },
      };
  }
}

// ============================================================================
// Node Type Evaluators
// ============================================================================

/**
 * Evaluates a literal node by broadcasting the scalar to a matrix.
 */
function evaluateLiteral(
  ast: { type: 'Literal'; value: number },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  // Get dimensions from any data field (they all have the same dimensions)
  const nDays = context.data.close.nDays;
  const nStocks = context.data.close.nStocks;

  const matrix = scalar_to_matrix(ast.value, nDays, nStocks);
  return { ok: true, value: matrix };
}

/**
 * Evaluates a data field node by looking it up in the context.
 */
function evaluateDataField(
  ast: { type: 'DataField'; name: DataFieldName },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  const field = context.data[ast.name];
  
  if (!field) {
    return {
      ok: false,
      error: {
        message: `Unknown data field: ${ast.name}`,
        node: ast,
      },
    };
  }

  return { ok: true, value: field };
}

/**
 * Evaluates a cell reference node by looking it up in the context.
 */
function evaluateCellRef(
  ast: { type: 'CellRef'; cell: string },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  const cellValue = context.cells.get(ast.cell);

  if (!cellValue) {
    return {
      ok: false,
      error: {
        message: `Undefined cell reference: ${ast.cell}`,
        node: ast,
      },
    };
  }

  return { ok: true, value: cellValue };
}

/**
 * Evaluates a unary operation node.
 */
function evaluateUnaryOp(
  ast: { type: 'UnaryOp'; op: UnaryOperator; operand: ASTNode },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  // Evaluate operand first
  const operandResult = evaluate(ast.operand, context);
  if (!operandResult.ok) {
    return operandResult;
  }

  // Apply unary operator
  try {
    const result = applyUnaryOp(ast.op, operandResult.value);
    return { ok: true, value: result };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: `Error applying unary operator ${ast.op}: ${(error as Error).message}`,
        node: ast,
      },
    };
  }
}

/**
 * Evaluates a binary operation node.
 */
function evaluateBinaryOp(
  ast: { type: 'BinaryOp'; op: BinaryOperator; left: ASTNode; right: ASTNode },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  // Evaluate left operand
  const leftResult = evaluate(ast.left, context);
  if (!leftResult.ok) {
    return leftResult;
  }

  // Evaluate right operand
  const rightResult = evaluate(ast.right, context);
  if (!rightResult.ok) {
    return rightResult;
  }

  // Apply binary operator
  try {
    const result = applyBinaryOp(ast.op, leftResult.value, rightResult.value);
    return { ok: true, value: result };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: `Error applying binary operator ${ast.op}: ${(error as Error).message}`,
        node: ast,
      },
    };
  }
}

/**
 * Evaluates a function call node.
 */
function evaluateFunctionCall(
  ast: { type: 'FunctionCall'; name: FunctionName; args: ASTNode[] },
  context: EvaluationContext
): Result<Matrix, EvaluationError> {
  // Evaluate all arguments
  const argResults: Matrix[] = [];
  
  for (const argNode of ast.args) {
    const argResult = evaluate(argNode, context);
    if (!argResult.ok) {
      return argResult; // Short-circuit on first error
    }
    argResults.push(argResult.value);
  }

  // Apply function
  try {
    const result = applyFunction(ast.name, argResults);
    return { ok: true, value: result };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: `Error calling function ${ast.name}: ${(error as Error).message}`,
        node: ast,
      },
    };
  }
}

// ============================================================================
// Operator Dispatch
// ============================================================================

/**
 * Dispatches a unary operator to its implementation.
 */
function applyUnaryOp(op: UnaryOperator, operand: Matrix): Matrix {
  switch (op) {
    case 'neg':
      return ops.neg(operand);
    case 'abs':
      return ops.abs_op(operand);
    case 'sign':
      return ops.sign_op(operand);
    case 'log':
      return ops.log_op(operand);
    case 'sqrt':
      return ops.sqrt_op(operand);
    default:
      throw new Error(`Unknown unary operator: ${op}`);
  }
}

/**
 * Dispatches a binary operator to its implementation.
 */
function applyBinaryOp(op: BinaryOperator, left: Matrix, right: Matrix): Matrix {
  switch (op) {
    case 'add':
      return ops.add(left, right);
    case 'sub':
      return ops.sub(left, right);
    case 'mul':
      return ops.mul(left, right);
    case 'div':
      return ops.div(left, right);
    case 'lt':
      return ops.lt(left, right);
    case 'gt':
      return ops.gt(left, right);
    case 'lte':
      return ops.lte(left, right);
    case 'gte':
      return ops.gte(left, right);
    case 'eq':
      return ops.eq(left, right);
    case 'max':
      return ops.max_op(left, right);
    case 'min':
      return ops.min_op(left, right);
    default:
      throw new Error(`Unknown binary operator: ${op}`);
  }
}

/**
 * Dispatches a function call to its implementation with argument count validation.
 */
function applyFunction(name: FunctionName, args: Matrix[]): Matrix {
  // Validate argument counts and dispatch
  switch (name) {
    // Cross-sectional operators (1 argument)
    case 'rank':
      validateArgCount(name, args, 1);
      return ops.rank(args[0]);
    
    case 'zscore':
      validateArgCount(name, args, 1);
      return ops.zscore(args[0]);
    
    case 'scale':
      validateArgCount(name, args, 1);
      return ops.scale(args[0]);
    
    case 'group_neutralize':
      validateArgCount(name, args, 2);
      return ops.group_neutralize(args[0], args[1]);

    // Time-series operators (2 arguments: matrix + window)
    case 'ts_delay':
      validateArgCount(name, args, 2);
      return ops.ts_delay(args[0], extractScalar(args[1], name));
    
    case 'ts_delta':
      validateArgCount(name, args, 2);
      return ops.ts_delta(args[0], extractScalar(args[1], name));
    
    case 'ts_mean':
      validateArgCount(name, args, 2);
      return ops.ts_mean(args[0], extractScalar(args[1], name));
    
    case 'ts_sum':
      validateArgCount(name, args, 2);
      return ops.ts_sum(args[0], extractScalar(args[1], name));
    
    case 'ts_std_dev':
      validateArgCount(name, args, 2);
      return ops.ts_std_dev(args[0], extractScalar(args[1], name));
    
    case 'ts_rank':
      validateArgCount(name, args, 2);
      return ops.ts_rank(args[0], extractScalar(args[1], name));
    
    case 'ts_decay_linear':
      validateArgCount(name, args, 2);
      return ops.ts_decay_linear(args[0], extractScalar(args[1], name));

    // Time-series operators (3 arguments: matrix + matrix + window)
    case 'ts_corr':
      validateArgCount(name, args, 3);
      return ops.ts_corr(args[0], args[1], extractScalar(args[2], name));

    // Conditional operator (3 arguments)
    case 'if_else':
      validateArgCount(name, args, 3);
      return ops.if_else(args[0], args[1], args[2]);

    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

/**
 * Validates that a function received the expected number of arguments.
 */
function validateArgCount(functionName: string, args: Matrix[], expected: number): void {
  if (args.length !== expected) {
    throw new Error(
      `Function ${functionName} expects ${expected} argument(s), got ${args.length}`
    );
  }
}

/**
 * Extracts a scalar value from a matrix for use as a parameter.
 * Assumes the matrix is constant (all elements have the same value).
 * Uses the first element as the representative value.
 */
function extractScalar(matrix: Matrix, functionName: string): number {
  const value = matrix.data[0];
  
  if (isNaN(value)) {
    throw new Error(`Function ${functionName} requires a numeric parameter, got NaN`);
  }
  
  // For window parameters, validate it's a positive integer
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `Function ${functionName} requires a positive integer parameter, got ${value}`
    );
  }
  
  return value;
}

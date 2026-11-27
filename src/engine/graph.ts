/**
 * Dependency Graph Module for Row-Quant Formula Engine
 *
 * This module tracks cell dependencies, extracts cell references from ASTs,
 * and manages the directed graph of cell relationships.
 */

import type { ASTNode } from './ast.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * CellDefinition represents a cell and its formula AST.
 */
export interface CellDefinition {
  cell: string;  // e.g., "A1", "B12"
  ast: ASTNode;
}

/**
 * CycleError indicates a circular dependency was detected.
 * Contains the cells forming the cycle.
 */
export interface CycleError {
  message: string;
  cycle: string[];  // The cells forming the cycle (last cell equals first)
}

/**
 * Result type for operations that may fail with an error.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// ============================================================================
// Cell Reference Extraction
// ============================================================================

/**
 * Recursively traverses an AST and collects all CellRef nodes.
 * Returns an array of unique cell references (e.g., ["A1", "B2"]).
 *
 * @param ast - The AST node to traverse
 * @returns Array of unique cell reference strings
 */
export function extractCellReferences(ast: ASTNode): string[] {
  const refs = new Set<string>();

  function traverse(node: ASTNode): void {
    switch (node.type) {
      case 'Literal':
      case 'DataField':
        // No cell references in literals or data fields
        break;

      case 'CellRef':
        // Add the cell reference (normalized to uppercase)
        refs.add(node.cell.toUpperCase());
        break;

      case 'UnaryOp':
        traverse(node.operand);
        break;

      case 'BinaryOp':
        traverse(node.left);
        traverse(node.right);
        break;

      case 'FunctionCall':
        for (const arg of node.args) {
          traverse(arg);
        }
        break;
    }
  }

  traverse(ast);
  return Array.from(refs);
}

// ============================================================================
// Dependency Graph
// ============================================================================

/**
 * DependencyGraph manages cell dependencies and provides methods to
 * add cells, query dependencies, and build the dependency structure.
 */
export class DependencyGraph {
  /**
   * Maps cell name -> array of cells it depends on.
   * Example: if A1 = "B2 + C3", then graph.get("A1") = ["B2", "C3"]
   */
  private graph: Map<string, string[]>;

  constructor() {
    this.graph = new Map();
  }

  /**
   * Adds a cell definition to the graph.
   * Extracts all cell references from the AST and stores them as dependencies.
   *
   * @param def - Cell definition containing cell name and AST
   */
  addCell(def: CellDefinition): void {
    const cellName = def.cell.toUpperCase();
    const dependencies = extractCellReferences(def.ast);
    this.graph.set(cellName, dependencies);
  }

  /**
   * Returns the list of cells that the specified cell depends on.
   *
   * @param cell - Cell name (case-insensitive)
   * @returns Array of cell names this cell depends on, or empty array if cell not found
   */
  getDependencies(cell: string): string[] {
    const cellName = cell.toUpperCase();
    return this.graph.get(cellName) ?? [];
  }

  /**
   * Returns all cells in the graph.
   *
   * @returns Array of all cell names
   */
  getCells(): string[] {
    return Array.from(this.graph.keys());
  }

  /**
   * Removes a cell from the graph.
   *
   * @param cell - Cell name to remove (case-insensitive)
   */
  removeCell(cell: string): void {
    const cellName = cell.toUpperCase();
    this.graph.delete(cellName);
  }

  /**
   * Clears all cells from the graph.
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Returns the number of cells in the graph.
   */
  size(): number {
    return this.graph.size;
  }

  /**
   * Computes the topological order of cells using DFS.
   * Returns the evaluation order (dependencies before dependents) or a CycleError.
   * 
   * Uses depth-first search with visited/visiting sets:
   * - visited: cells fully processed
   * - visiting: cells on current DFS path (cycle detection)
   * 
   * Returns cells in reverse post-order (dependencies first).
   * 
   * @returns Ok with evaluation order, or Err with CycleError if cycle detected
   */
  getEvaluationOrder(): Result<string[], CycleError> {
    // Handle empty graph
    if (this.graph.size === 0) {
      return { ok: true, value: [] };
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    /**
     * DFS visit function. Returns true on success, throws CycleError on cycle.
     */
    const visit = (cell: string, path: string[]): void => {
      // Cycle detected: cell is in the current DFS path
      if (visiting.has(cell)) {
        // Find where the cycle starts
        const cycleStartIndex = path.indexOf(cell);
        const cycle = path.slice(cycleStartIndex).concat([cell]);
        throw {
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
          cycle
        };
      }

      // Already fully processed
      if (visited.has(cell)) {
        return;
      }

      // Mark as being visited (on current path)
      visiting.add(cell);

      // Visit all dependencies
      const deps = this.graph.get(cell) || [];
      for (const dep of deps) {
        visit(dep, path.concat([cell]));
      }

      // Done visiting this cell
      visiting.delete(cell);
      visited.add(cell);
      
      // Add to order in post-order (dependencies added before dependents)
      order.push(cell);
    };

    try {
      // Visit all cells in the graph
      for (const cell of this.graph.keys()) {
        if (!visited.has(cell)) {
          visit(cell, []);
        }
      }

      return { ok: true, value: order };
    } catch (error) {
      return { ok: false, error: error as CycleError };
    }
  }

  /**
   * Checks if the graph contains any cycles.
   * 
   * @returns true if a cycle exists, false otherwise
   */
  hasCycle(): boolean {
    const result = this.getEvaluationOrder();
    return !result.ok;
  }
}

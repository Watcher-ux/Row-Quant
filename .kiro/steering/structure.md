---
inclusion: always
---

# Structure

```
src/
  engine/         pure TS, no React imports
    parser.ts     source -> AST
    ast.ts        AST types
    operators.ts  operator implementations
    evaluate.ts   AST + context -> Matrix
    graph.ts      cell dependency graph, topo order, cycle detection
    backtest.ts   Matrix -> weights -> PnL + metrics
    worker.ts     Web Worker entry
  ui/             React components (Grid, StatusLine, EditLine, CommandMenu, BacktestPanel)
  data/           loader for the bundled dataset
api/translate.ts  serverless LLM function
scripts/          one-off data prep scripts
tests/            mirrors src/engine; *.test.ts unit, *.prop.test.ts property-based
```

Engine code must not import from `ui/`. UI talks to the engine only through the worker messages.

Paste this into Kiro chat in Spec mode (spec name: `formula-engine`):

---

Create a spec for the Row-Quant formula engine described in the steering docs (product, tech, structure, semantics).
Scope: parser + AST, all operators in semantics.md, evaluator, cell dependency graph with cycle detection,
and the delay-1 backtest with metrics. No UI in this spec.
Write requirements in EARS format, one requirement per operator group plus parser, graph and backtest.
Every invariant listed in semantics.md must become an acceptance criterion that is verified by a fast-check property test.
In tasks, put the parser and its round-trip property test first, then operators, then evaluator, then graph, then backtest.
Keep tasks small enough that each one ends with passing tests.

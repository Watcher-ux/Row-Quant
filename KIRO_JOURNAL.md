# Kiro Build Journal — Row-Quant

Running notes for the Kiroween 2026 write-up (how Kiro was used). Newest entries at the bottom.

## 2026-11-20 — Day 1: idea, steering, first spec

**Idea.** Resurrection category: VisiCalc (1979) brought back as a quant research workbench. Each cell holds a BRAIN-style alpha expression, and recalculating runs a backtest. Chosen over a Yahoo Pipes revival because VisiCalc is better known, and an alpha formula is already a spreadsheet cell.

**Steering (written before any code).** Four docs in `.kiro/steering/`:
- `product.md`, `tech.md`, `structure.md`: always included.
- `semantics.md`: fileMatch on `src/engine/**` and `tests/**`. This is the source of truth for every operator and for the backtest, and it lists the invariants that must be property-tested.
- Why: Kiro gets the exact operator semantics only when it is working on engine code, so they don't take up context during UI work.

**Spec: `formula-engine`, design-first workflow.** Prompt in `SPEC_PROMPT.md`. Picked design-first because the engine is mostly math whose semantics are fixed in advance, so the design drives the requirements rather than the other way round. Kiro produced requirements (10 EARS groups), design (with 10 correctness properties) and 26 tasks in 8 waves. Cost: ~12 credits, ~30 min.

**Spec review before running any task.** Found these on paper:
- Bug: the backtest demeaned weights across all stocks, so stocks with NaN alpha still got a nonzero position. Root cause: my own ambiguous wording in `semantics.md`. Fix: weight 0 for NaN alpha, demean and scale over valid stocks only, plus a property test for it.
- `if_else` would have propagated NaN from the branch it didn't select.
- The round-trip property test would have failed: negative literals parse as `neg(x)`, and the tokenizer didn't support exponents.
- Absolute 1e-10 tolerances fail on large-magnitude inputs such as volume. Switched to relative tolerances.
- Rank-invariance test: affine float transforms can create ties. Switched to integer matrices and an `x³` transform.
- `ts_corr` can overshoot ±1 from float error, so it is now clamped and has a range test.
- Missing invariant "evaluate never throws" replaced the near-trivial determinism property test.
- Cut tasks to save credits: dispatch merged into the evaluator, TSDoc and final-validation tasks dropped, benchmark trimmed to one.

**Takeaway for the write-up.** These issues were caught in the spec before any code existed. With vibe coding, the backtest bug would have shown up as a Sharpe ratio that looked plausible but was wrong, and finding it would have meant a debugging session.

**Credits.** 40 free credits, ~28 left after the spec. Held "Run All Tasks" until the 4,000-credit hackathon code arrives.

## 2026-11-20 (evening): spec revision

Gave Kiro one revision prompt with all 8 review fixes. It updated `semantics.md`, requirements, design and tasks together, which was the point of keeping semantics in steering: one source of truth, and the spec followed it.
- Applied: weights only over valid alpha (with a NaN ⇒ 0 property test), if_else NaN rule, exponent literals, relative tolerances, rank invariance on integer matrices with x³, ts_corr clamp, "never throws" robustness property test. 26 tasks → 22.
- Checked Kiro's output instead of trusting it. Two slips found:
  - It wrote a UTF-8 BOM at the start of `semantics.md`. The BOM sits in front of the front matter and could stop the `fileMatch` inclusion from being recognised, so I stripped it.
  - When it renumbered the tasks it dropped the Web Worker task along with the two I asked to delete. Decided the worker task goes into the upcoming UI spec, where it belongs anyway.

## 2026-11-21: data script (Vibe mode)

Used Vibe mode, not a spec: a one-off fetch script doesn't need requirements and a design. Rule of thumb from here on is specs where correctness matters (the engine) and vibe mode for throwaway tooling.
- Kiro's first version looked right (100 tickers, 11 sectors, adjusted prices, missing days kept as missing), but review caught two problems:
  - `json.dump` would have written bare `NaN`, which isn't valid JSON, so the browser couldn't have loaded the file. Fixed by converting to `null` and writing with `allow_nan=False`.
  - The output would have been about 15 MB. Dropped vwap (the loader computes it), wrote volume as integers, and pinned the date range so results are reproducible.
- Result: `public/data/market.json`, 10.4 MB, 2,513 days × 100 stocks, 2016-11-21 to 2026-11-19. Checked it with a script: valid JSON, no missing values in any field, no price jumps over 1.8× or under 0.45× day to day (so splits are adjusted). Survivorship bias is noted in the README.

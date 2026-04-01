# Eval Results - 0b5cba8 (ergonomics stability)

2026-04-01 | Model: claude-opus-4-6 | 5 runs per fixture | Hybrid (haiku explore, opus score)

## Method

Ergonomics-only scoring from frozen haiku signal data. Two repos tested
(vscode-icons, glances) - these have the most interesting ergonomics
signals across the spectrum.

## Stability Results

### vscode-icons ergonomics - 1 unstable category

```
                    R1  R2  R3  R4  R5  range
Feedback loop        1   1   1   1   1   0
Error signal         1   1   1   1   1   0
Type system          1   1   1   1   1   0
Determinism          2   2   2   2   2   0
Change locality      1   1   1   2   1   1  *
```

### glances ergonomics - 1 unstable category

```
                    R1  R2  R3  R4  R5  range
Feedback loop        2   2   2   2   2   0
Error signal         1   1   1   1   1   0
Type system          0   0   0   0   0   0
Determinism          1   0   1   1   1   1  *
Change locality      1   1   1   1   1   0
```

## Stability: 8/10 category-fixture pairs stable (80%)

Two drifty categories:

1. **vscode-icons Change locality (1 vs 2)**: avg 2.89 files/commit sits at
   the boundary. Run 4 scorer focused on the commit count (under 3 = score 2);
   other runs focused on the 6,668-line god file (= score 1). Fixed by adding
   a hard cap: "if any god file > 1000 lines exists, score cannot be higher
   than 1 regardless of other signals."

2. **glances Determinism (0 vs 1)**: tests hit local HTTP fixtures via
   requests.get(). Run 2 scorer read "network calls = 0"; other runs
   distinguished local fixtures from external services and scored 1. Fixed
   by clarifying: "tests hitting a local test server started by a fixture
   are NOT external - they are a timing dependency (score 1), not a network
   dependency (score 0)."

## Rubric changes made

1. **Determinism score 0**: added explicit note that local test server
   fixtures are timing dependencies (score 1), not network dependencies
   (score 0). Only third-party APIs/cloud endpoints count as external.

2. **Change locality score 1**: added hard cap - "if any god file > 1000
   lines exists, score cannot be higher than 1 regardless of other signals."
   This resolves ambiguity when commit count is low but file sizes are high.

## Combined config + ergonomics scores

### vscode-icons

```
Config:      2, 2, 2, 2, 2, 3, 3, 2, 2  (Great)
Ergonomics:  1, 1, 1, 2, 1
```

### glances

```
Config:      2, 3, 2, 2, 2, 3, 3, 1, 1  (Good)
Ergonomics:  2, 1, 0, 1, 1
```

## Observations

- Ergonomics tells a different story than config. vscode-icons is Great on
  config but mostly 1s on ergonomics (no documented scoped tests, no strict
  TS, god files). glances is Good on config but has a 0 on type system
  (pyright commented out in CI).

- Error signal quality scored 1 on both repos. As predicted during design,
  this category doesn't differentiate well with passive measurement - most
  repos use default framework output. May need active measurement (v2) or
  should be combined with another category.

- The ergonomics dimension is viable. 80% stability on first try (before
  tightening) matches config v1's 83%. After tightening the two drifty
  categories, stability should improve to 90%+ on the next run.

---
description: Slice the current diff into atomic commits, staging one slice at a time
---
Please slice the current repository diff into atomic commit-sized changes and stage exactly one slice at a time.

Workflow:
1. Rescan the current git state before each slice using `git status` and relevant diffs.
2. Identify the next smallest coherent change that should be its own commit.
3. Stage only that slice. Use partial staging where needed; keep unrelated changes separate.
4. After staging, show me:
   - the staged files
   - a short rationale for why this slice is atomic
   - a suggested commit subject
   - a suggested commit body
5. Then stop and wait for me to verify and commit.

When I say `next`, rescan the repository state from scratch and repeat the workflow for the next slice.

Rules:
- Do not commit for me unless I explicitly ask.
- Do not stage multiple unrelated changes together.
- Do not assume previous analysis is still current after I say `next`; rescan first.
- If a boundary is ambiguous, ask me before staging.
- If part of a file belongs to one slice and another part belongs to a different slice, use partial staging.
- If generated/lock/format-only changes are present, call them out and keep them separate unless they are inseparable from the code change.

---
description: Slice the current diff into atomic commits, staging one slice at a time
---
Slice the current repository diff into atomic commit-sized changes. Stage exactly one slice, then stop.

Process:
1. Rescan with `git status` and relevant diffs.
2. Pick the next smallest coherent commit.
3. Stage only that slice, using partial staging when needed.
4. Report staged files, atomicity rationale, and a Conventional Commit subject; include a body only if useful.
5. Wait for me to verify/commit.

On `next`, rescan from scratch and repeat.

Rules:
- Do not commit unless explicitly asked.
- Keep unrelated, generated, lockfile, and format-only changes separate unless inseparable.
- Ask before staging if the boundary is ambiguous.
- If suggesting a commit body, wrap it to about 80 characters per line (120 max).

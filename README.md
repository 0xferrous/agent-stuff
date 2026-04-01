# Extensions

| Extension | Description |
|-----------|-------------|
| [`bash-sane`](extensions/bash-sane/) | Parsed bash approval gate with one-time, session, and persistent directory-scoped policies |
| [`bash-permission-gate.ts`](extensions/bash-permission-gate.ts) | Simple confirmation prompt before executing bash commands |
| [`block-sensitive-files.ts`](extensions/block-sensitive-files.ts) | Blocks access to sensitive files (.env, .envrc, etc.) and redacts sensitive env vars from tool results and bash outputs |
| [`agent-summary.ts`](extensions/agent-summary.ts) | Shows an Agent Summary of consulted (read) and changed (write/edit) files after each turn |
| [`notify.ts`](extensions/notify.ts) | Desktop notifications when agent finishes (Ghostty, iTerm2, WezTerm, Kitty) |
| [`idle-inhibit.ts`](extensions/idle-inhibit.ts) | Holds a systemd idle inhibitor while the agent is running (requires `systemd-inhibit`) |
| [`turn-timer.ts`](extensions/turn-timer.ts) | Show live turn and session timing in status bar |
| [`followup.ts`](extensions/followup.ts) | Adds a /followup command to queue repeated follow-up user messages |
| [`vendored/read-mode.ts`](extensions/vendored/read-mode.ts) | Fullscreen read mode that scrolls conversation history with a pinned follow-up input (upstream: `minghinmatthewlam/pi-read-mode`) |
| [`vendored/tps.ts`](extensions/vendored/tps.ts) | Shows tokens-per-second performance metrics at end of agent run (upstream: `badlogic/pi-mono`) |

## Usage

```bash
# Single file extension
pi -e ./extensions/<name>.ts

# Directory extension
pi -e ./extensions/bash-sane

# Multiple extensions
pi -e ./extensions/turn-timer.ts -e ./extensions/notify.ts

# Auto-load (copy to ~/.pi/agent/extensions/)
cp ./extensions/<name>.ts ~/.pi/agent/extensions/
cp -r ./extensions/bash-sane ~/.pi/agent/extensions/
cp ./extensions/vendored/read-mode.ts ~/.pi/agent/extensions/
cp ./extensions/vendored/tps.ts ~/.pi/agent/extensions/
```

`vendored/read-mode.ts` upstream: <https://github.com/minghinmatthewlam/pi-read-mode>

`vendored/tps.ts` upstream: <https://github.com/badlogic/pi-mono/blob/main/.pi/extensions/tps.ts>

Or add to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/path/to/repo/extensions/turn-timer.ts",
    "/path/to/repo/extensions/notify.ts"
  ]
}
```

`bash-sane` stores persistent rules in `~/.pi/agent/pi-bash-sane.policy.json`. If you install `extensions/bash-sane/` standalone, run `npm install` in that directory first. See `extensions/bash-sane/SPEC.md` for behavior and policy details.

## Template

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("event_name", async (event, ctx) => {
    // your code
  });
}
```

# Skills

| Skill | Description |
|-------|-------------|
| [`nix-search`](skills/nix-search) | Search and query NixOS packages and options using nix-search-tv |
| [`rust-crate-locator`](skills/rust-crate-locator) | Locate source code directory of Rust dependencies from the cargo registry cache |
| [`gitbook-scraper`](skills/gitbook-scraper) | Scrape GitBook documentation sites into Markdown files |
| [`diataxis-documentation-framework`](skills/diataxis-documentation-framework) | Apply Diátaxis to audit, write, and restructure documentation by user need |

## Usage

Skills are loaded automatically by pi when placed in `~/.pi/agent/skills/` or referenced by path.

```bash
# Copy skill to pi's skills directory
cp -r ./skills/rust-crate-locator ~/.pi/agent/skills/

# Or reference by path (pi loads SKILL.md)
pi --skill ./skills/rust-crate-locator/SKILL.md
```

## Skill Template

Skills are defined in `SKILL.md` files with frontmatter metadata:

```markdown
---
name: skill-name
description: Brief description of when to use this skill
---

# Skill Title

Detailed documentation of the skill's purpose and usage.
```

# Themes

| Theme | Description |
|-------|-------------|
| [`gruvbox-dark.json`](themes/gruvbox-dark.json) | Classic Gruvbox dark theme with warm earthy colors |
| [`gruvbox-material-dark-hard.json`](themes/gruvbox-material-dark-hard.json) | Gruvbox Material dark hard variant with improved contrast |

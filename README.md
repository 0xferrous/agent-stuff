# Extensions

| Extension | Description |
|-----------|-------------|
| [`bash-permission-gate.ts`](extensions/bash-permission-gate.ts) | Ask for confirmation before executing bash commands |
| [`block-sensitive-files.ts`](extensions/block-sensitive-files.ts) | Intercepts read, write, and edit tool calls and rejects access to sensitive files like .env, .envrc, etc. |
| [`notify.ts`](extensions/notify.ts) | Desktop notifications when agent finishes (Ghostty, iTerm2, WezTerm, Kitty) |
| [`turn-timer.ts`](extensions/turn-timer.ts) | Show live turn and session timing in status bar |

## Usage

```bash
# Single extension
pi -e ./extensions/<name>.ts

# Multiple extensions
pi -e ./extensions/turn-timer.ts -e ./extensions/notify.ts

# Auto-load (copy to ~/.pi/agent/extensions/)
cp ./extensions/<name>.ts ~/.pi/agent/extensions/
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/path/to/repo/extensions/turn-timer.ts",
    "/path/to/repo/extensions/notify.ts"
  ]
}
```

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

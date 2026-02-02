# Extensions

| Extension | Description |
|-----------|-------------|
| [`bash-permission-gate.ts`](extensions/bash-permission-gate.ts) | Ask for confirmation before executing bash commands |
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

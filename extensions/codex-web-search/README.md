# codex-web-search

Enable Codex web search by patching `before_provider_request` payloads for Codex models.

## Usage

```bash
pi -e ./extensions/codex-web-search
```

Or copy the directory to an auto-loaded location:

```bash
cp -r ./extensions/codex-web-search ~/.pi/agent/extensions/
```

## State

State is in-memory only.

Defaults:
- enabled: `true`
- live: `false`

## Command

- `/codex-web-search` opens the native mode picker UI
- `/codex-web-search [off|cached|live]` sets the mode directly

Modes:
- off = enabled off
- cached = enabled on, live off
- live = enabled on, live on

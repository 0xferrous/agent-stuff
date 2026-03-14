# bash-sane spec

## Goal

Prompt before unknown `bash` tool executions using `just-bash` parsing and a directory-scoped policy file.

## Policy file

Path: `~/.pi/agent/pi-bash-sane.policy.json`

If missing, create it automatically.

If invalid JSON, warn the user and continue in session-only mode for the current pi runtime.

## Policy shape

```json
{
  "version": 1,
  "directories": {
    "/a": [
      { "effect": "allow", "path": ["git"] }
    ],
    "/a/b": [
      { "effect": "deny", "path": ["git", "push"] }
    ]
  }
}
```

Rules may also be raw exact-command rules when bash parsing cannot produce a confident command path:

```json
{
  "effect": "allow",
  "raw": "if foo; then bar; fi"
}
```

## Directory scoping

Rules are stored in a single global file, but each rule belongs to a directory key.

For cwd `/a/b/c/d`, load/apply directory entries in this order:

- `/`
- `/a`
- `/a/b`
- `/a/b/c`
- `/a/b/c/d`

More local directories take precedence over less local ones.

## Rule precedence

### Path rules

For parsed command paths:

1. deeper directory scope wins
2. within the same directory, longer matching command path wins
3. if still tied, later rule in the directory array wins

Example:

- `/a`: allow `git`
- `/a/b`: deny `git push`
- `/a/b/c`: allow `git push`

In `/a/b/c`, `git push` is allowed.

### Raw rules

For raw exact-command fallback rules:

1. deeper directory scope wins
2. if tied, later rule wins

## Prompt actions

The action menu contains exactly:

- `allow`
- `allow(session)`
- `allow(persistent)`
- `deny`
- `deny(session)`
- `deny(persistent)`

Semantics:

- `allow`: one-time allow for the current invocation only
- `deny`: one-time deny for the current invocation only
- `allow(session)` / `deny(session)`: mutate the in-memory policy for this pi session only
- `allow(persistent)` / `deny(persistent)`: write a rule to the policy file and also update in-memory policy

## Parsing and matching

Use `just-bash`'s parser.

Behavior:

- extract all commands that can be confidently found in the bash expression
- use command/path extraction based on shell parsing plus argv-level option stripping
- if **all** extracted commands are allowed by policy, allow the execution
- if any extracted command is denied by policy, block the execution
- otherwise prompt

If parsing succeeds but the extension cannot confidently derive command paths for all relevant commands, prompt on the raw full bash string.

## Command path extraction

For a simple command:

- start from the command name and literal args
- skip a hardcoded wrapper prefix when present
- after wrapper skipping, ignore most shell builtins
- supervise external commands and `source`
- strip recognized leading global options before extracting subcommands/args
- generate command-path candidates as prefixes, capped at depth 7

The shell parser provides command name and argv structure, but not CLI semantics. So `bash-sane` uses a hybrid approach:

- `just-bash` parses shell syntax
- `bash-sane` applies generic argv rules plus small command-specific specs for well-known commands

The parser still does **not** know true semantic subcommand boundaries, so user choice determines the stored prefix level.

Example:

- raw words: `git remote add origin x`
- candidate prefixes:
  - `git`
  - `git remote`
  - `git remote add`
  - `git remote add origin`
  - `git remote add origin x`

Example with leading global options:

- raw: `systemctl --user status wispd.service`
- extracted words: `systemctl status wispd.service`

## Wrapper handling

Hardcoded wrappers skipped in v1:

- `sudo`
- `env`
- `command`
- `nohup`
- `time`
- `builtin`

Special handling:

- `env` also skips leading `NAME=value` args after the wrapper

## Leading option handling

After wrapper skipping, `bash-sane` strips recognized leading global options before extracting the command path.

### Generic rules

- `--` ends leading-option scanning
- `--option=value` and `-o=value` are treated as self-contained option tokens
- clustered short flags like `-xeu` are treated as self-contained flags
- unknown bare options default to consuming one following token as their value
- extraction then starts at the first remaining positional token

### Command-specific specs

`bash-sane` currently has small specs for:

- `systemctl`
- `git`
- `gh`
- `nix`
- `journalctl`
- `nix-store`

These specs define:

- known flags that do **not** consume following tokens
- known options that consume one or more following tokens
- some commands that should stay command-only after option stripping (for example `journalctl`)

Examples:

- `systemctl --user status wispd.service` -> `systemctl status wispd.service`
- `git -C /tmp/repo status` -> `git status`
- `gh --repo owner/repo pr status` -> `gh pr status`
- `nix --extra-experimental-features 'nix-command flakes' build .#hello` -> `nix build .#hello`

## Builtins

Ignore shell builtins in v1 except:

- `source`

`source` is supervised.

## Prompt flow

### Parsed command path flow

For session rules:

1. choose action
2. choose command prefix

Directory scope is the current cwd.

For persistent rules:

1. choose action
2. choose command prefix
3. choose directory scope from current cwd or any ancestor up to `/`

For one-time `allow` / `deny`, no rule is recorded.

### Raw fallback flow

If command-path extraction is not confident enough, prompt against the raw full bash string.

Session rules use the current cwd.
Persistent rules let the user choose a directory scope from cwd up to `/`.

## Multi-command expressions

If the parser yields multiple commands and all are already allowed, allow.

If any is denied, block.

If some are unknown, prompt for the unknown command(s). If command-path extraction is not reliable enough for the whole expression, fall back to raw-command prompting.

## Non-interactive behavior

If a command is already allowed or denied by policy, apply the policy.

If prompting would be required but no UI is available, block by default.

## Notifications

- invalid JSON policy: warn and continue with session-only behavior
- allow-by-policy: silent
- deny-by-policy: block and include the matched policy in the reason

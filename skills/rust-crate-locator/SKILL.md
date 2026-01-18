---
name: rust-crate-locator
description: Locates the source code directory of Rust dependencies. Given a crate name and version, finds where the crate's source is stored on disk. Use when the agent needs to read or explore the source code of a dependency in a Rust project.
---

# Rust Crate Locator

## Overview

This skill helps you find the source code location of Rust crate dependencies. Crates downloaded from crates.io are stored in the cargo registry cache.

## Usage

### Find a crate's source directory

```bash
./scripts/locate-crate.js <crate-name> [version]
```

**Examples:**

```bash
# Find specific version (returns single path)
./scripts/locate-crate.js serde 1.0.193

# Read version(s) from Cargo.lock (may return multiple paths if crate has multiple versions)
./scripts/locate-crate.js serde
```

## Workflow

1. **Identify the crate name and version** you need to locate. This can be found in `Cargo.toml` under `[dependencies]` or via `cargo tree`.

2. **Run the locate script** with the crate name:
   - With version: Returns the exact match (single path)
   - Without version: Reads `Cargo.lock` to find all installed versions of that crate (may return multiple paths if different dependencies use different versions)

   ```bash
   ./scripts/locate-crate.js <crate-name> [version]
   ```

3. **The script returns** the path(s) to the crate's source directory.

4. **Use the returned path** with the `read` tool to explore the source code:
   ```bash
   read /path/to/returned/directory/src/lib.rs
   ```

## Alternative: Using cargo metadata

If the crate is a local path dependency or git dependency, use:

```bash
cargo metadata --format-version 1 | jq '.packages[] | select(.name == "<crate-name>") | .manifest_path'
```

## How Cargo Stores Crates

- **crates.io dependencies**: `~/.cargo/registry/src/index.crates.io-XXXX/<crate>-<version>/`
- **git dependencies**: `~/.cargo/git/checkouts/<repo-hash>/<commit-hash>/`
- **path dependencies**: As specified in `Cargo.toml`

The `index.crates.io-XXXX` directory contains all crates.io dependencies, where `XXXX` is a unique hash.

## Tips

- Use `cargo tree` to see the full dependency tree with versions:
  ```bash
  cargo tree --depth 1
  ```

- For workspaces, run commands from the workspace root.

- If the crate hasn't been built yet, run `cargo build` first to ensure it's downloaded.

- When running without a version argument, the script reads `Cargo.lock` from the current directory to find the installed version. Make sure you're in the project directory containing `Cargo.lock`.

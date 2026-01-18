#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const crateName = process.argv[2];
const version = process.argv[3];

if (!crateName) {
  console.error("Usage: locate-crate.js <crate-name> [version]");
  process.exit(1);
}

// Get versions to find
let versionsToFind = version ? [version] : [];

if (!version && fs.existsSync("Cargo.lock")) {
  const lockContent = fs.readFileSync("Cargo.lock", "utf8");
  const matches = lockContent.matchAll(
    /\[\[package\]\]\s*\nname = "(\w+)"\s*\nversion = "([^"]+)"/g,
  );
  const cargoLockVersions = [];
  for (const match of matches) {
    if (match[1] === crateName) cargoLockVersions.push(match[2]);
  }
  console.log(
    `Found following versions in Cargo.lock: ${cargoLockVersions.join(", ")}`,
  );
  versionsToFind.push(...cargoLockVersions);
}

// Find index.crates.io directory
const registrySrc = path.join(
  process.env.CARGO_HOME || path.join(os.homedir(), ".cargo"),
  "registry",
  "src",
);
const indexDir = fs
  .readdirSync(registrySrc)
  .find((d) => d.startsWith("index.crates.io-"));

if (!indexDir) {
  console.error("index.crates.io directory not found");
  process.exit(1);
}

// Find matching crate directories
const prefix = `${crateName}-`;
const entries = fs.readdirSync(path.join(registrySrc, indexDir));
const matches = entries
  .filter((e) => e.startsWith(prefix))
  .filter(
    (e) =>
      versionsToFind.length === 0 ||
      versionsToFind.includes(e.slice(prefix.length)),
  )
  .map((e) => path.join(registrySrc, indexDir, e));

if (matches.length === 0) {
  console.error(`Crate '${crateName}' not found`);
  process.exit(1);
}

console.log(matches.join("\n"));

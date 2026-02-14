---
name: gitbook-scraper
description: Scrape GitBook documentation sites into Markdown files. Use when you need to archive docs locally, prepare them for LLM/RAG ingestion, or analyze docs offline.
---

# GitBook Scraper

## Overview

This skill exports a GitBook docs site to Markdown files using the site sitemap plus `pandoc` conversion.

It is best for:
- Offline documentation snapshots
- Converting docs for knowledge bases / RAG pipelines
- Reviewing docs in plain text/Markdown workflows

## Quick Start

From this repository root:

```bash
./skills/gitbook-scraper/scripts/scrape-gitbook.nu <gitbook-base-url> <output-dir> [max-pages]
```

Example:

```bash
./skills/gitbook-scraper/scripts/scrape-gitbook.nu \
  https://docs.example.com \
  ./tmp/docs-example-md \
  300
```

## What the script does

1. Fetches `sitemap.xml` from the GitBook base URL
2. Collects in-domain page URLs
3. Downloads each page
4. Converts HTML to Markdown (`gfm`) using `pandoc`
5. Writes one `.md` file per page plus a `SUMMARY.md` index

## Requirements

The script is self-contained via nix-shell shebang and includes:

- `nushell`
- `curl`
- `pandoc`
- `python3`

Run it directly:

```bash
./skills/gitbook-scraper/scripts/scrape-gitbook.nu https://docs.example.com ./out
```

## Output layout

Given output directory `./out`, the skill creates:

- `out/index.md` (homepage)
- `out/<path>.md` (docs pages)
- `out/SUMMARY.md` (page index)

## Notes and limitations

- GitBook pages with heavy client-side rendering may include extra UI text.
- The script prefers `<main>` content when present, but fallback conversion may still include navigation noise.
- Some pages can fail due to rate limiting or anti-bot controls.
- If a site has no sitemap, use a crawler-based approach as fallback.

## Agent usage pattern

When asked to scrape a GitBook site:

1. Confirm base URL and output directory
2. Run the script with a sensible `max-pages` limit (e.g. 200–500)
3. Verify `SUMMARY.md` and a few converted files
4. Report completion and any failed URLs

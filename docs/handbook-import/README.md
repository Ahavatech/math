# Handbook import

Put one Markdown file per handbook page in this folder, then run:

```bash
npm run handbook:import
```

This only prints a plan (dry run). Nothing is written until you add `--apply`:

```bash
npm run handbook:import -- --apply
```

## File format

Each file starts with a front matter block (between two `---` lines), followed by the page
body in Markdown.

```
---
title: Admission Requirements
slug: admission-requirements
parent: programmes
order: 1
summary: What you need to apply for a place in the department.
---
## Overview

Write the page body here using Markdown: **bold**, *italic*, lists, [links](https://example.com),
and math with `$x^2$` (inline) or `$$x^2 + y^2 = r^2$$` (its own line, displayed).
```

- `title` and `slug` are required. `slug` becomes the page's web address.
- `parent` is optional: the slug of another page in this same batch, or an existing handbook page.
  The handbook tree only supports two levels, so a page whose parent itself has a parent is
  skipped and reported, not imported.
- `order` is optional (defaults to 0): where the page sits among its siblings. You can always
  reorder pages afterwards in Admin, then Handbook.
- `summary` is optional: a short one-line description shown on the handbook's start page.

## What the importer does and does not do

- Converts the Markdown body to HTML, including `$...$`/`$$...$$` math, the same way the admin
  rich text editor does.
- Sanitises the result with the same allowlist every other rich text field uses.
- Creates every new page as a **draft** - nothing appears publicly until an admin reviews it and
  sets it to Published.
- **Never overwrites a page that already exists** (matched by slug). If you re-run the importer
  after an admin has edited a page, that file is skipped and reported, not touched.

## SAMPLE-welcome.md

This folder ships one clearly marked sample file (`SAMPLE-welcome.md`) so you can see the import
work end to end before writing real content. Delete it, or leave it: re-running the importer will
simply skip it once it has been imported.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE = resolve(__dirname, '../../CHANGELOG.md');
const TARGET = resolve(__dirname, '../docs/changelog.md');

const FRONTMATTER = `---
id: changelog
title: Changelog
description: Release history for ng-ncached. Mirrored from CHANGELOG.md in the repository.
sidebar_position: 99
---

`;

const raw = await readFile(SOURCE, 'utf8');

// Strip the leading "# Changelog" heading (and any blank lines that follow)
// so the frontmatter title is the only H1 on the page.
const body = raw.replace(/^#\s+Changelog\s*\n+/, '');

await writeFile(TARGET, FRONTMATTER + body, 'utf8');

console.log(`[ncached-docs] Copied CHANGELOG.md → ${TARGET}`);

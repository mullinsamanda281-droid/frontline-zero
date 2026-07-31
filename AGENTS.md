# AGENTS.md — Guidelines for AI coding agents

## Project

FRONTLINE ZERO — browser-based low-poly multiplayer FPS (Three.js + TypeScript + Vite).

## Stack

* Three.js + TypeScript + Vite
* Node.js >= 20
* State: this repo is being seeded; the first issue (`[P0] Scaffold`) establishes the project structure.

## Commands

* `npm install` — install dependencies
* `npm run dev` — start Vite dev server
* `npm run build` — type-check + production build
* `npm run preview` — preview production build
* `npm test` — run unit tests (Vitest)

## Conventions

* TypeScript strict mode. No `any` unless unavoidable and commented.
* Every feature lands with unit tests where practical.
* Keep 60+ FPS on integrated GPUs as the performance contract: draw calls < 500, visible triangles < 150k.
* Prefer low-poly geometry (500–2,000 tris per prop), flat colors, minimal textures (256–512 px).
* No comments unless they explain non-obvious intent.
* Read the issue acceptance criteria before starting; verify each one before opening a PR.

## Issue workflow

* Work one issue at a time, from the Issues tab.
* Reference the issue number in the PR (e.g., "Closes #12").
* Ask for clarification on the issue before guessing when acceptance criteria are ambiguous.

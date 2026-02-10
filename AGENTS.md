# Oxide

This is a monorepo for Oxide, a Svelte Web framework with SSR support, built on top of Vite and Nitro. It also serves as a file system router for Svelte.

## General rules

- Read the damn DOCS.md before doing anything.
- If a package contains SPECIFICATION.md, read it before working on that package.
- If you change anything in packages/oxidejs that's worth mentioning, please update the IMPLEMENTATION.md file.
- Do not run commands yourself. Tell me what should I run.
- Use Bun runtime for development.
- Use Context7 MCP to get more context about nitrojs/nitro and vitejs/vite if needed.

## Project Structure

- packages/oxidejs/ - Core of the framework.
- starters/minimal/ - A starter template for Oxide projects.
- DOCS.md - Documentation of the project.

## Code Standards

- Use strict TypeScript (also ensure your <script> tags in .svelte files have lang="ts").
- Use Tailwind for styling, no plain CSS.
- Always use Svelte 5 runes for state management.
- Avoid adding comments or keep them concise and relevant.
- Prioritize code readability and maintainability.
- IMPORTANT: DO NOT STUB OR MOCK ANYTHING IN THE CODEBASE.
- Avoid else statements, prefer early returns and pattern matching.
- Never use lower-level APIs directly unless asked for. Avoid `$$render` and similar.

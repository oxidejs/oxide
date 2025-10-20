# Oxide

This is a monorepo for Oxide, a Svelte Web framework with SSG support, built on top of Vite and Nitro. It also serves as a file system router for Svelte.

## Project Structure

- packages/framework/ - Core of the framework.
- packages/starter/ - A starter template for Oxide projects.
- docs/ - Documentation of the project.

## Code Standards

- Use strict TypeScript (also ensure your <script> tags in .svelte files have lang="ts").
- Use Tailwind for styling, no plain CSS.
- Always use Svelte 5 runes for state management.
- Avoid adding comments or keep them concise and relevant.
- Prioritize code readability and maintainability.
- IMPORTANT: DO NOT STUB OR MOCK ANYTHING IN THE CODEBASE.
- Avoid else statements, prefer early returns and pattern matching.
- Do not run commands yourself. Tell me what should I run.

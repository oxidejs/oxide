# Project Structure

Simple, organized structure for Oxide projects.

## Basic Structure

```
my-oxide-app/
├── src/
│   ├── app/                 # Routes and API
│   │   ├── index.svelte     # Homepage (/)
│   │   ├── about.svelte     # About page (/about)
│   │   ├── users/
│   │   │   └── [id].svelte  # User page (/users/123)
│   │   └── api/
│   │       ├── users.ts     # User API (/api/users/*)
│   │       └── posts.ts     # Posts API (/api/posts/*)
│   ├── lib/                 # Shared code
│   │   ├── components/      # Reusable components
│   │   ├── utils/           # Helper functions
│   │   └── orpc/            # API setup
│   ├── app.html             # HTML template
│   ├── app.svelte           # Root component
│   └── app.css              # Global styles
├── .oxide/                  # Generated files
│   └── types.d.ts           # Route types
├── public/                  # Static files
└── package.json
```

## src/app/

Your routes and API endpoints:

- `.svelte` files → web pages
- `.ts` files → API routes
- `index.svelte` → root path (`/`)
- `[param].svelte` → dynamic routes
- `(group)/` → organize without affecting URLs

## src/lib/

Shared code and components:

```
src/lib/
├── components/
│   ├── ui/
│   │   ├── Button.svelte
│   │   └── Input.svelte
│   └── forms/
│       └── LoginForm.svelte
├── utils/
│   ├── format.ts
│   └── validation.ts
└── orpc/
    ├── index.ts      # Base setup
    ├── context.ts    # Request context
    └── middleware.ts # Auth & logging
```

Import from `lib` using the `$lib` alias:

```typescript
import Button from "$lib/components/ui/Button.svelte";
import { formatDate } from "$lib/utils/format";
import { base } from "$lib/orpc";
```

## Generated Files

Oxide automatically generates:

- `.oxide/types.d.ts` - Route and API types
- `.oxide/routes.json` - Route manifest

Don't edit these files directly.

## Static Assets

Put static files in `public/`:

```
public/
├── favicon.ico
├── images/
│   └── logo.svg
└── robots.txt
```

Access them from root URL: `/favicon.ico`, `/images/logo.svg`

## Configuration Files

- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite configuration with Oxide
- `tailwind.config.js` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration

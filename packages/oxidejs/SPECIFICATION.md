# Router

Oxide includes a hybrid SSR+SPA router that handles server-side rendering for the initial page load and seamlessly transitions to a client-side single-page application. [v3.nitro](https://v3.nitro.build/docs/renderer)

## File-System Based Routing

The router automatically discovers routes from the `src/routes/` directory in your project. Routes are matched using rou3, a lightweight routing library that powers Nitro's routing system. [reddit](https://www.reddit.com/r/ccna/comments/12hdy14/routing_logic_and_forwarding_decisions/)

### Route Files

- **Regular routes**: Create `.svelte` files in `src/routes/` that correspond to URL paths
- **Index routes**: Use `index.svelte` for the root of a directory
- **Dynamic parameters**: Use brackets for dynamic segments like `[id].svelte` or `[slug].svelte`
- **Wildcard routes**: Use `[...path].svelte` to match multiple path segments

### Special Files

**+layout.svelte**

Layout files wrap their child routes and can be nested. A layout at any level applies to all routes within that directory and its subdirectories. Layouts are useful for shared navigation, headers, footers, or any UI that persists across multiple routes.

**+error.svelte**

Error boundaries catch errors that occur in child routes and display fallback UI. When an error occurs during rendering or data loading, the nearest error boundary up the tree will handle it.

Both layout and error files can use Svelte 5's `await` blocks to load data server-side during SSR and client-side during navigation.

## How It Works

### Initial Load (SSR)

When a user first visits your application, Nitro's renderer handles the request server-side. The router matches the URL to the appropriate route component, loads any necessary layout and error boundary components, and executes Svelte 5's `await` blocks on the server. The fully rendered HTML is sent to the browser along with the hydration script. [v3.nitro](https://v3.nitro.build/docs/renderer)

### Client-Side Navigation (SPA)

After the initial page loads, the router takes over all subsequent navigation. Link clicks are intercepted and handled client-side, browser history is managed with the History API, and route components are dynamically loaded and mounted without full page reloads. [semaphore](https://semaphore.io/blog/view-transitions-api-spas)

### Code Splitting

Each route component is automatically split into a separate JavaScript chunk. This means users only download the code needed for the current route, improving initial load times. Vite automatically handles shared dependencies and deduplication across# Oxide Router [tanstack](https://tanstack.com/router/v1/docs/framework/react/guide/automatic-code-splitting)

## Overview

Oxide's router is a hybrid SSR+SPA routing solution designed for modern web applications. It delivers server-rendered HTML on initial load for optimal performance and SEO, then seamlessly transitions to a single-page application with instant client-side navigation. [v3.nitro](https://v3.nitro.build/docs)

## Core Concepts

### Hybrid Rendering

The router operates in two phases: [svelte](https://svelte.dev/tutorial/kit/ssr)

- **Server-Side Rendering (SSR)**: On initial page load, routes are rendered on the server using Nitro's renderer system. Data loading happens server-side through Svelte 5's `await` blocks, ensuring users receive fully-rendered HTML immediately.

- **Client-Side Navigation (SPA)**: After hydration, the router intercepts all link clicks and handles navigation client-side. Subsequent route changes load instantly without full page reloads, providing a native app-like experience.

### File-System Based Routing

Routes are automatically discovered from your `src/routes/` directory. The router uses a file-system convention where each `.svelte` file becomes a route: [reddit](https://www.reddit.com/r/ccna/comments/12hdy14/routing_logic_and_forwarding_decisions/)

- `index.svelte` maps to the directory's base path
- `about.svelte` creates an `/about` route
- `[id].svelte` creates a dynamic parameter route
- `[...path].svelte` creates a wildcard catch-all route

Route matching is powered by rou3, providing fast and reliable path resolution.

## Special Files

### Layouts (+layout.svelte)

Layout files wrap child routes and enable shared UI components like navigation bars, sidebars, or footers. Layouts support nesting, allowing you to compose complex page structures: [svelte](https://svelte.dev/tutorial/kit/ssr)

- Place `+layout.svelte` in any directory to wrap all routes within that directory
- Nested layouts automatically compose from root to leaf
- Layouts can load their own data using `await` blocks
- Changes between routes that share a layout preserve the layout's state

### Error Boundaries (+error.svelte)

Error boundary files catch errors in child routes and display fallback UI. They prevent errors from crashing your entire application:

- Place `+error.svelte` in any directory to handle errors for routes within that directory
- Nested error boundaries allow granular error handling
- If no local error boundary exists, errors bubble up to parent boundaries
- Error boundaries receive error information as props for custom error displays

## Automatic Code Splitting

Every route component, layout, and error boundary is automatically split into separate JavaScript chunks. This ensures users only download the code needed for the current page: [github](https://github.com/TanStack/router/discussions/1315)

- Initial page load includes only the current route and its layout chain
- Subsequent navigations load route chunks on-demand
- Vite automatically deduplicates shared dependencies across chunks
- Preloaded routes are cached and load instantly when navigated to

## Proximity Preloading

The router implements aggressive preloading strategies to make navigation feel instant: [emewjin.github](https://emewjin.github.io/spa-preloading/)

### Hover Preloading

When users hover over a link, the router begins loading that route's code and data. By the time they click, the route is already cached and renders immediately.

### Viewport Preloading

Links visible in the viewport are automatically preloaded with low priority. This uses the Intersection Observer API to detect visible links and loads them during browser idle time.

### Touch Preloading

On mobile devices, the router preloads routes on `touchstart` events, which fire before the `click` event. This provides instant navigation on touch devices.

All preloaded routes are cached, so repeated navigations to the same route require no additional loading.

## View Transitions

The router leverages the native View Transitions API for smooth, animated transitions between routes. When supported by the browser: [ramiin](https://ramiin.se/posts/5?slug=smooth-dom-transitions-in-spas-using-the-view-transitions-api)

- Route changes trigger automatic cross-fade animations
- Shared elements can be morphed between pages using CSS `view-transition-name`
- Transitions are hardware-accelerated and performant
- Fallback to instant updates on unsupported browsers

You control transition appearance entirely through CSS, keeping the router lightweight and flexible.

## Scroll Management

The router provides configurable scroll behavior to match your application's needs:

- **Auto**: Scrolls to top on new pages, restores position on browser back/forward
- **Preserve**: Maintains current scroll position during navigation
- **Top**: Always scrolls to top on any navigation

Individual navigations can override the default behavior with custom scroll positions.

## Navigation Lifecycle

Client-side navigation follows a predictable lifecycle:

1. Link click or programmatic navigation triggers route change
2. Optional loading callback fires for custom loading indicators
3. Route component loads (instantly if preloaded)
4. View transition begins (if supported)
5. New route component mounts and renders
6. Browser history updates
7. Scroll position adjusts based on configuration
8. Optional completion callback fires

Errors at any stage are caught by the nearest error boundary, preventing application crashes.

## Programmatic Navigation

Beyond clicking links, you can navigate programmatically using the router API:

- Navigate to any route from your code
- Preload routes manually for predictable loading
- Control scroll position on navigation
- Replace history entries instead of pushing new ones

## Configuration Options

### Scroll Behavior

Choose how the router handles scroll position during navigation (`auto`, `preserve`, or `top`).

### Loading Callbacks

Provide optional callbacks that fire when navigation starts and ends. Use these to implement custom loading indicators, progress bars, or loading states.

### Preloading Toggle

Disable automatic preloading for debugging or testing scenarios.

### View Transitions Toggle

Disable view transitions if you prefer instant route changes or need to support specific use cases.

## Head Management

The router integrates seamlessly with Svelte's built-in `<svelte:head>` component for managing document head content. Each route can declare its own title, meta tags, and other head elements without additional router APIs.

## Data Loading

Data loading uses Svelte 5's experimental `await` blocks, which work identically on both server and client:

- On initial SSR load, `await` blocks resolve server-side before HTML is sent
- On client-side navigation, `await` blocks resolve in the browser
- Svelte's hydration automatically handles the SSR-to-client data handoff
- No special data loading APIs or serialization required

## Browser Compatibility

The router targets modern browsers and uses cutting-edge web APIs:

- View Transitions API (with fallback for unsupported browsers)
- Intersection Observer for viewport preloading
- Native ES modules and dynamic imports
- History API for navigation

All features degrade gracefully on older browsers while maintaining core functionality.

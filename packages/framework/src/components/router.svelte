<script lang="ts">
  import { onMount, onDestroy, getContext, setContext } from 'svelte';

  type RouterStatus = 'ready' | 'loading' | 'not-found' | 'error';

  interface RouterProps {
    fallback?: any;
    base?: string;
    loading?: any;
    error?: any;
  }

  let { fallback = null, base = '', loading, error }: RouterProps = $props();

  const isBrowser = typeof window !== 'undefined';

  // Router state
  let routes: any[] = $state([]);
  let routerState = $state<RouterStatus>('ready');
  let currentLocation = $state({ pathname: '/', search: '', hash: '' });
  let currentRoute = $state<any>(null);
  let currentParams = $state<Record<string, string>>({});
  let currentComponent = $state<any>(null);
  let routerError = $state<Error | null>(null);
  let isNavigating = $state(false);

  // Route loading
  async function loadRoutes() {
    try {
      const routesModule = await import('$oxide');
      routes = routesModule.routes || [];
    } catch (error) {
      routes = [];
      routerState = 'not-found';
    }
  }

  // Navigation
  function navigate(path: string, options: any = {}) {
    if (!isBrowser) return;

    const action = options.replace ? 'replaceState' : 'pushState';
    history[action]({}, '', base + path);
    isNavigating = true;
    updateLocation();
  }

  function generatePath(name: string, params: Record<string, any> = {}) {
    const route = findRouteByName(name);
    if (!route) {
      throw new Error(`Route "${name}" not found`);
    }

    let path = route.path;
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        path = path.replace('*', value.join('/'));
        continue;
      }
      const paramRegex = new RegExp(`:${key}\\??`, 'g');
      path = path.replace(paramRegex, String(value));
    }
    path = path.replace(/\/:[^/]+\?/g, '');
    return path || '/';
  }

  // Router context
  const routerContext = {
    navigate,
    location: () => currentLocation,
    route: () => currentRoute,
    params: () => currentParams,
    generatePath
  };
  setContext('router', routerContext);

  // Route utilities
  function findRouteByName(name: string): any {
    function searchRoutes(routeList: any[]): any {
      for (const route of routeList) {
        if (route.name === name) return route;
        if (route.children) {
          const found = searchRoutes(route.children);
          if (found) return found;
        }
      }
      return null;
    }
    return searchRoutes(routes);
  }

  function findMatchingRoute(pathname: string): any {
    function searchRoutes(routeList: any[], parentPath = '', ancestors: any[] = []): any {
      for (const route of routeList) {
        const routePath = buildRoutePath(parentPath, route.path);

        if (routePath === pathname) {
          return {
            leafRoute: route,
            layoutChain: ancestors,
            params: extractParams(pathname, route, routePath)
          };
        }

        if (route.children?.length > 0) {
          const childMatch = searchRoutes(route.children, routePath, [...ancestors, route]);
          if (childMatch) return childMatch;
        }
      }
      return null;
    }

    return searchRoutes(routes);
  }

  function buildRoutePath(parentPath: string, routePath: string): string {
    if (parentPath === '' || parentPath === '/') {
      return routePath.startsWith('/') ? routePath : '/' + routePath;
    }

    const combined = `${parentPath}/${routePath}`.replace(/\/+/g, '/');
    return combined.startsWith('/') ? combined : '/' + combined;
  }

  function extractParams(pathname: string, route: any, routePath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pathSegments = pathname.split('/').filter(Boolean);
    const routeSegments = routePath.split('/').filter(Boolean);

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (routeSegment?.startsWith(':')) {
        const paramName = routeSegment.replace(/^:|[?*]$/g, '');
        if (pathSegment !== undefined) {
          params[paramName] = decodeURIComponent(pathSegment);
        }
      }
    }

    return params;
  }

  // Location and route updates
  async function updateLocation(): Promise<void> {
    if (!isBrowser) return;

    if (isNavigating) {
      routerState = 'loading';
    }

    const url = new URL(window.location.href);
    let pathname = url.pathname;

    if (base && pathname.startsWith(base)) {
      pathname = pathname.slice(base.length) || '/';
    }

    currentLocation = {
      pathname,
      search: url.search,
      hash: url.hash
    };

    const matchResult = findMatchingRoute(pathname);

    if (matchResult) {
      try {
        currentRoute = matchResult.leafRoute;
        currentParams = matchResult.params;
        await loadRouteComponents(matchResult);
        routerState = 'ready';
        isNavigating = false;
        return;
      } catch (error) {
        console.error('Failed to load route:', error);
        routerError = error as Error;
        routerState = 'error';
        isNavigating = false;
        return;
      }
    }

    currentRoute = null;
    currentParams = {};
    currentComponent = null;
    routerState = 'not-found';
    isNavigating = false;
  }

  // Component loading
  async function loadRouteComponents(matchResult: any): Promise<void> {
    const { leafRoute, layoutChain } = matchResult;

    try {
      const leafComponent = await loadComponent(leafRoute.component);

      if (layoutChain?.length > 0) {
        const loadedLayouts = await Promise.all(
          layoutChain.map((layout: any) => loadComponent(layout.component))
        );

        currentComponent = {
          isLayout: true,
          layouts: loadedLayouts,
          leafComponent
        };
      } else {
        currentComponent = { isLayout: false, component: leafComponent };
      }

      routerState = 'ready';
    } catch (error) {
      console.error('Failed to load components:', error);
      routerError = error as Error;
      routerState = 'error';
      throw error;
    }
  }

  async function loadComponent(component: any): Promise<any> {
    if (typeof component === 'function') {
      const module = await component();
      return module.default || module;
    }
    return component;
  }

  // Event handlers
  function handlePopState(): void {
    isNavigating = true;
    updateLocation();
  }

  function handleLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href]') as HTMLAnchorElement;

    if (!link || link.target === '_blank' || link.download) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    event.preventDefault();
    navigate(href);
  }

  // SSR support
  function initializeSSR() {
    try {
      const locationContext = getContext('location');
      const ssrRoute = getContext('ssrRoute');

      if (locationContext && ssrRoute) {
        currentLocation = {
          pathname: locationContext.pathname,
          search: locationContext.search || '',
          hash: locationContext.hash || ''
        };

        currentRoute = ssrRoute.leafRoute;
        currentParams = ssrRoute.params;
        currentComponent = { isLayout: false, component: ssrRoute.leafRoute.component };
        routerState = 'ready';
      }
    } catch {
      // Contexts not available during client-side rendering
    }
  }

  // Lifecycle
  onMount(async () => {
    await loadRoutes();

    if (isBrowser) {
      updateLocation();
      window.addEventListener('popstate', handlePopState);
      document.addEventListener('click', handleLinkClick);
    } else {
      routerState = 'ready';
    }
  });

  $effect(() => {
    if (!isBrowser) {
      initializeSSR();
    }
  });

  onDestroy(() => {
    if (isBrowser) {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick);
    }
  });
</script>

{#if routerState === 'loading'}
  <div class="flex items-center justify-center min-h-screen">
    {#if loading}
      {@render loading()}
    {:else}
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading...</p>
      </div>
    {/if}
  </div>
{/if}

{#if routerState === 'ready' && currentComponent}
  {#if currentComponent.isLayout}
    {@render renderLayouts(currentComponent.layouts, currentComponent.leafComponent)}
  {:else}
    {@const Component = currentComponent.component}
    <Component params={currentParams} {...currentParams} />
  {/if}
{/if}

{#if routerState === 'not-found'}
  <div class="flex items-center justify-center min-h-screen">
    {#if fallback}
      {@const FallbackComponent = fallback}
      <FallbackComponent />
    {:else}
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-800 mb-4">404 - Page Not Found</h1>
        <p class="text-gray-600">The page you are looking for could not be found.</p>
      </div>
    {/if}
  </div>
{/if}

{#if routerState === 'error'}
  <div class="flex items-center justify-center min-h-screen">
    {#if error}
      {@render error({ routerError })}
    {:else}
      <div class="text-center p-8">
        <h1 class="text-2xl font-bold text-red-600 mb-4">Router Error</h1>
        <p class="text-gray-600 mb-4">Failed to initialize router: {routerError?.message || 'Unknown error'}</p>
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onclick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    {/if}
  </div>
{/if}

{#snippet renderLayouts(layouts, leafComponent)}
  {#if layouts.length > 0}
    {@const Layout = layouts[0]}
    <Layout params={currentParams} {...currentParams}>
      {#snippet children()}
        {#if layouts.length > 1}
          {@render renderLayouts(layouts.slice(1), leafComponent)}
        {:else}
          {@const LeafComponent = leafComponent}
          <LeafComponent params={currentParams} {...currentParams} />
        {/if}
      {/snippet}
    </Layout>
  {/if}
{/snippet}

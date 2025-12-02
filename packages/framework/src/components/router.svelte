<script lang="ts">
  import { onMount, onDestroy, getContext, setContext } from 'svelte';
  import { ROUTER_CONTEXT_KEY } from '@oxidejs/framework/client';

  export interface Location {
    pathname: string;
    search: string;
    hash: string;
  }

  export interface RouteParams {
    [key: string]: string;
  }

  interface RouterContext {
    navigate: (path: string, options?: { replace?: boolean }) => void;
    location: () => Location;
    params: () => RouteParams;
  }

  function setRouterContext(context: RouterContext): void {
    setContext(ROUTER_CONTEXT_KEY, context);
  }

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
  let currentLocation = $state<Location>({ pathname: '/', search: '', hash: '' });
  let currentRoute = $state<any>(null);
  let currentParams = $state<RouteParams>({});
  let currentComponents = $state<any[]>([]);
  let routerError = $state<Error | null>(null);
  let isNavigating = $state(false);

  // Route loading
  async function loadRoutes() {
    try {
      const routesModule = await import('$oxide');
      routes = routesModule.routes || [];
    } catch (error) {
      console.error('Failed to load routes:', error);
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

  // Router context for virtual module
  const routerContext = {
    navigate,
    location: () => currentLocation,
    params: () => currentParams,
  };

  // Set context for virtual module functions
  setRouterContext(routerContext);

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
    async function searchRoutes(routeList: any[], parentPath = '', ancestors: any[] = []): Promise<any> {
      for (const route of routeList) {
        const routePath = buildRoutePath(parentPath, route.path);
        const matchResult = matchSingleRoute(pathname, route, routePath);

        if (matchResult.matches) {
          return {
            leafRoute: route,
            layoutChain: ancestors.filter(a => a.hasComponent),
            params: matchResult.params,
            fullPath: routePath
          };
        }

        if (route.children?.length > 0) {
          const newAncestors = route.hasComponent ? [...ancestors, route] : ancestors;
          const childMatch = await searchRoutes(route.children, routePath, newAncestors);
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

    const combined = `${parentPath}${routePath}`.replace(/\/+/g, '/');
    return combined.startsWith('/') ? combined : '/' + combined;
  }

  function matchSingleRoute(pathname: string, route: any, routePath: string) {
    const params: Record<string, string> = {};

    if (routePath === pathname) {
      return { matches: true, params };
    }

    const pathSegments = pathname.split('/').filter(Boolean);
    const routeSegments = routePath.split('/').filter(Boolean);

    // Handle catch-all routes
    if (routeSegments.includes('*')) {
      const catchAllIndex = routeSegments.findIndex(seg => seg === '*');

      let matches = true;
      for (let i = 0; i < catchAllIndex; i++) {
        if (i >= pathSegments.length) {
          matches = false;
          break;
        }

        const routeSegment = routeSegments[i];
        const pathSegment = pathSegments[i];

        if (routeSegment.startsWith(':')) {
          const paramName = routeSegment.slice(1);
          params[paramName] = decodeURIComponent(pathSegment);
        } else if (routeSegment !== pathSegment) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const catchAllParam = route.params?.find((p: string) =>
          p.startsWith('catch-') || route.params.indexOf(p) === route.params.length - 1
        ) || 'catchAll';

        const remainingSegments = pathSegments.slice(catchAllIndex);
        const paramName = catchAllParam.startsWith('catch-')
          ? catchAllParam.replace('catch-', '')
          : catchAllParam;

        params[paramName] = remainingSegments.join('/');
        return { matches: true, params };
      }

      return { matches: false, params: {} };
    }

    // Handle regular dynamic routes
    if (pathSegments.length !== routeSegments.length) {
      return { matches: false, params: {} };
    }

    let matches = true;
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pathSegment = pathSegments[i];

      if (routeSegment.startsWith(':')) {
        const paramName = routeSegment.slice(1);
        params[paramName] = decodeURIComponent(pathSegment);
      } else if (routeSegment !== pathSegment) {
        matches = false;
        break;
      }
    }

    return { matches, params };
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

    try {
      const matchResult = await findMatchingRoute(pathname);

      if (matchResult) {
        currentRoute = matchResult.leafRoute;
        currentParams = matchResult.params;
        await loadRouteComponents(matchResult);
        routerState = 'ready';
        isNavigating = false;
        return;
      }

      // No route matched - check for catch-all
      const catchAllRoute = findCatchAllRoute();
      if (catchAllRoute) {
        currentRoute = catchAllRoute;
        currentParams = { catchAll: pathname.slice(1) };
        await loadRouteComponents({ leafRoute: catchAllRoute, layoutChain: [], params: currentParams });
        routerState = 'ready';
        isNavigating = false;
        return;
      }

      currentRoute = null;
      currentParams = {};
      currentComponents = [];
      routerState = 'not-found';
      isNavigating = false;
    } catch (error) {
      console.error('Failed to update location:', error);
      routerError = error as Error;
      routerState = 'error';
      isNavigating = false;
    }
  }

  function findCatchAllRoute(): any {
    function search(routeList: any[]): any {
      for (const route of routeList) {
        if (route.path.includes('*')) {
          return route;
        }
        if (route.children) {
          const found = search(route.children);
          if (found) return found;
        }
      }
      return null;
    }
    return search(routes);
  }

  // Component loading
  async function loadRouteComponents(matchResult: any): Promise<void> {
    const { leafRoute, layoutChain } = matchResult;

    try {
      const components = [];

      // Load layout components
      if (layoutChain?.length > 0) {
        for (const layout of layoutChain) {
          const layoutComponent = await loadComponent(layout.component);
          components.push({
            type: 'layout',
            component: layoutComponent,
            route: layout
          });
        }
      }

      // Load leaf component
      if (leafRoute.hasComponent) {
        const leafComponent = await loadComponent(leafRoute.component);
        components.push({
          type: 'page',
          component: leafComponent,
          route: leafRoute
        });
      }

      currentComponents = components;
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
        currentComponents = [{
          type: 'page',
          component: ssrRoute.leafRoute.component,
          route: ssrRoute.leafRoute
        }];
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

{#if routerState === 'ready' && currentComponents.length > 0}
  {@render renderComponents(currentComponents, 0)}
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
        <p class="text-sm text-gray-500 mt-4">Path: {currentLocation.pathname}</p>
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

{#snippet renderComponents(components, index)}
  {#if index < components.length}
    {@const comp = components[index]}
    {@const Component = comp.component}

    {#if comp.type === 'layout'}
      <Component params={currentParams} {...currentParams}>
        {#snippet children()}
          {@render renderComponents(components, index + 1)}
        {/snippet}
      </Component>
    {:else}
      <Component params={currentParams} {...currentParams} />
    {/if}
  {/if}
{/snippet}

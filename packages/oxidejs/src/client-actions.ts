import type { LinkOptions, NavigationOptions } from "./types.js";

// Global navigation function - set by the client router
let globalNavigate: ((pathname: string, options?: NavigationOptions) => Promise<void>) | null =
  null;
let globalPreloader: ((pathname: string) => Promise<void>) | null = null;

export function setGlobalNavigate(
  navigate: (pathname: string, options?: NavigationOptions) => Promise<void>,
): void {
  globalNavigate = navigate;
}

export function setGlobalPreloader(preloader: (pathname: string) => Promise<void>): void {
  globalPreloader = preloader;
}

interface LinkActionOptions extends LinkOptions {
  disabled?: boolean;
}

export function link(
  node: HTMLAnchorElement,
  options: LinkActionOptions = {},
): {
  update: (newOptions: LinkActionOptions) => void;
  destroy: () => void;
} {
  if (typeof window === "undefined") {
    return {
      update: () => {},
      destroy: () => {},
    };
  }

  let currentOptions = { ...options };
  let cleanupPreloader: (() => void) | undefined;

  function shouldIntercept(event: MouseEvent): boolean {
    if (currentOptions.disabled) return false;
    if (!node.href) return false;
    if (node.hasAttribute("data-oxide-reload")) return false;
    if (node.target && node.target !== "_self") return false;
    if (node.download) return false;
    if (node.rel === "external") return false;
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

    try {
      const url = new URL(node.href);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function handleClick(event: MouseEvent): void {
    if (!shouldIntercept(event) || !globalNavigate) return;

    event.preventDefault();

    try {
      const url = new URL(node.href);
      const pathname = url.pathname + url.search + url.hash;

      const navigationOptions: NavigationOptions = {
        replaceState: currentOptions.replaceState,
        noscroll: currentOptions.noscroll,
        keepfocus: currentOptions.keepfocus,
      };

      globalNavigate(pathname, navigationOptions);
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }

  function setupPreloading(): void {
    if (!node.href || !globalPreloader) return;
    if (
      node.hasAttribute("data-oxide-preload") &&
      node.getAttribute("data-oxide-preload") === "off"
    ) {
      return;
    }

    const preloadMode = currentOptions.preload || "hover";
    if (preloadMode === false) return;

    try {
      const url = new URL(node.href);
      if (url.origin !== window.location.origin) return;

      const pathname = url.pathname + url.search + url.hash;
      let timeoutId: number;

      const preload = () => {
        if (globalPreloader) {
          globalPreloader(pathname).catch((err) => {
            console.warn("Preload failed for", pathname, err);
          });
        }
      };

      const handleMouseEnter = (): void => {
        if (preloadMode === "hover" || preloadMode === "intent" || preloadMode === true) {
          timeoutId = window.setTimeout(preload, 50);
        }
      };

      const handleMouseLeave = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const handleFocus = (): void => {
        if (preloadMode === "intent" || preloadMode === true) {
          preload();
        }
      };

      const handleTouchStart = (): void => {
        if (preloadMode === "intent" || preloadMode === true) {
          preload();
        }
      };

      // Viewport-based preloading
      let observer: IntersectionObserver | null = null;
      if (preloadMode === "viewport" || preloadMode === true) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                preload();
                observer?.unobserve(node);
              }
            });
          },
          { rootMargin: "100px" },
        );
        observer.observe(node);
      }

      // Add event listeners
      if (preloadMode === "hover" || preloadMode === "intent" || preloadMode === true) {
        node.addEventListener("mouseenter", handleMouseEnter);
        node.addEventListener("mouseleave", handleMouseLeave);
        node.addEventListener("focus", handleFocus);
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
      }

      cleanupPreloader = (): void => {
        if (timeoutId) clearTimeout(timeoutId);
        node.removeEventListener("mouseenter", handleMouseEnter);
        node.removeEventListener("mouseleave", handleMouseLeave);
        node.removeEventListener("focus", handleFocus);
        node.removeEventListener("touchstart", handleTouchStart);
        observer?.disconnect();
      };
    } catch {
      // Invalid URL, skip preloading
    }
  }

  node.addEventListener("click", handleClick);
  setupPreloading();

  return {
    update(newOptions: LinkActionOptions): void {
      currentOptions = { ...newOptions };
      cleanupPreloader?.();
      setupPreloading();
    },
    destroy(): void {
      node.removeEventListener("click", handleClick);
      cleanupPreloader?.();
    },
  };
}

interface LinksActionOptions {
  preload?: boolean | "hover" | "viewport" | "intent";
  disabled?: boolean;
}

export function links(
  node: HTMLElement,
  options: LinksActionOptions = {},
): {
  update: (newOptions: LinksActionOptions) => void;
  destroy: () => void;
} {
  if (typeof window === "undefined") {
    return {
      update: () => {},
      destroy: () => {},
    };
  }

  let currentOptions = { ...options };
  let linkActions = new Map<HTMLAnchorElement, ReturnType<typeof link>>();
  let observer: MutationObserver | null = null;

  function shouldEnhanceLink(anchor: HTMLAnchorElement): boolean {
    if (currentOptions.disabled) return false;
    if (anchor.hasAttribute("data-oxide-reload")) return false;
    if (!anchor.href) return false;

    try {
      const url = new URL(anchor.href);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function enhanceLink(anchor: HTMLAnchorElement): void {
    if (linkActions.has(anchor) || !shouldEnhanceLink(anchor)) return;

    const action = link(anchor, {
      preload: currentOptions.preload,
    });
    linkActions.set(anchor, action);
  }

  function unenhanceLink(anchor: HTMLAnchorElement): void {
    const action = linkActions.get(anchor);
    if (action) {
      action.destroy();
      linkActions.delete(anchor);
    }
  }

  function scanAndEnhanceLinks(): void {
    const anchors = node.querySelectorAll("a[href]");
    anchors.forEach((anchor) => {
      enhanceLink(anchor as HTMLAnchorElement);
    });
  }

  function handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");

    if (!anchor || !shouldEnhanceLink(anchor) || !globalNavigate) return;
    if (anchor.hasAttribute("data-oxide-reload")) return;

    // The individual link action should handle this, but this is a fallback
    // for dynamically added links that haven't been enhanced yet
    if (!linkActions.has(anchor)) {
      enhanceLink(anchor);
    }
  }

  // Set up delegation for click events
  node.addEventListener("click", handleClick);

  // Initial scan
  scanAndEnhanceLinks();

  // Watch for dynamically added/removed links
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Handle added nodes
        mutation.addedNodes.forEach((addedNode) => {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            const element = addedNode as Element;

            // Check if the added node is a link
            if (element.tagName === "A") {
              enhanceLink(element as HTMLAnchorElement);
            }

            // Check for links inside the added node
            const anchors = element.querySelectorAll("a[href]");
            anchors.forEach((anchor) => {
              enhanceLink(anchor as HTMLAnchorElement);
            });
          }
        });

        // Handle removed nodes
        mutation.removedNodes.forEach((removedNode) => {
          if (removedNode.nodeType === Node.ELEMENT_NODE) {
            const element = removedNode as Element;

            // Check if the removed node is a link
            if (element.tagName === "A") {
              unenhanceLink(element as HTMLAnchorElement);
            }

            // Check for links inside the removed node
            const anchors = element.querySelectorAll("a[href]");
            anchors.forEach((anchor) => {
              unenhanceLink(anchor as HTMLAnchorElement);
            });
          }
        });
      });
    });

    observer.observe(node, {
      childList: true,
      subtree: true,
    });
  }

  return {
    update(newOptions: LinksActionOptions): void {
      currentOptions = { ...newOptions };

      // Update all existing link actions
      linkActions.forEach((action, anchor) => {
        if (shouldEnhanceLink(anchor)) {
          action.update({ preload: currentOptions.preload });
        } else {
          unenhanceLink(anchor);
        }
      });

      // Re-scan for new links
      scanAndEnhanceLinks();
    },
    destroy(): void {
      node.removeEventListener("click", handleClick);
      observer?.disconnect();

      // Clean up all link actions
      linkActions.forEach((action) => {
        action.destroy();
      });
      linkActions.clear();
    },
  };
}

// Export individual navigation functions for programmatic use
export async function navigate(href: string, options: NavigationOptions = {}): Promise<void> {
  if (!globalNavigate) {
    console.warn("Oxide router not initialized");
    return;
  }

  return globalNavigate(href, options);
}

export async function preloadRoute(href: string): Promise<void> {
  if (!globalPreloader) {
    console.warn("Oxide preloader not available");
    return;
  }

  return globalPreloader(href);
}

// Navigation utilities
export function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function isSameOriginUrl(href: string): boolean {
  return !isExternalUrl(href);
}

export function normalizeUrl(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    let pathname = url.pathname;

    // Remove trailing slash except for root
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    return pathname + url.search + url.hash;
  } catch {
    return href;
  }
}

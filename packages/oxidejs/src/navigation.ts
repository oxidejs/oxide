import type { LinkPreloader } from "./preload";

// Global navigation function and preloader
let globalNavigate: ((pathname: string) => Promise<void>) | null = null;
let globalPreloader: LinkPreloader | null = null;

export function setGlobalNavigate(navigate: (pathname: string) => Promise<void>): void {
  globalNavigate = navigate;
}

export function setGlobalPreloader(preloader: LinkPreloader): void {
  globalPreloader = preloader;
}

// Svelte action for client-side navigation with preloading
export function link(node: HTMLAnchorElement): { destroy: () => void } {
  // Guard against SSR
  if (typeof window === "undefined") {
    return { destroy: () => {} };
  }

  let cleanupPreloader: (() => void) | undefined;

  function handleClick(event: MouseEvent): void {
    if (
      globalNavigate &&
      node.href &&
      node.origin === window.location.origin &&
      !node.target &&
      !node.download &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      const pathname = new URL(node.href).pathname;
      history.pushState({}, "", node.href);
      globalNavigate(pathname);
    }
  }

  node.addEventListener("click", handleClick);

  // Set up preloading if available
  if (globalPreloader) {
    cleanupPreloader = globalPreloader.observeLink(node);
  }

  return {
    destroy(): void {
      node.removeEventListener("click", handleClick);
      cleanupPreloader?.();
    },
  };
}

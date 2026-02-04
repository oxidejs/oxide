// Legacy navigation utilities for backwards compatibility
import { getOxideRouter } from "./client.js";

// Legacy link action for backwards compatibility
export function link(node: HTMLAnchorElement): { destroy: () => void } {
  // Guard against SSR
  if (typeof window === "undefined") {
    return { destroy: () => {} };
  }

  function handleClick(event: MouseEvent): void {
    const router = getOxideRouter();
    if (
      router &&
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
      const pathname =
        new URL(node.href).pathname + new URL(node.href).search + new URL(node.href).hash;
      router.navigateTo(pathname);
    }
  }

  node.addEventListener("click", handleClick);

  return {
    destroy(): void {
      node.removeEventListener("click", handleClick);
    },
  };
}

// Re-export the main navigation functions from actions
export { link as linkAction, links, navigate, preloadRoute } from "./actions.js";

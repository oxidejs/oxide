<script lang="ts">
    import type { ComponentType } from "svelte";
    import type { OxideUrl } from "../src/types.js";

    let {
        error,
        errorComponent,
        fallbackComponent,
        params = {},
        url,
        retry
    }: {
        error: Error;
        errorComponent?: ComponentType;
        fallbackComponent?: ComponentType;
        params?: Record<string, any>;
        url?: OxideUrl;
        retry?: () => void;
    } = $props();

    const shouldRenderErrorComponent = $derived(errorComponent && error);
    const shouldRenderFallback = $derived(!errorComponent && error);
</script>

{#if shouldRenderErrorComponent}
    {@const ErrorComponent = errorComponent}
    <ErrorComponent {error} {params} {url} {retry} />
{:else if shouldRenderFallback}
    <div class="error-fallback" style="padding: 2rem; text-align: center; color: #ef4444; border: 1px solid #ef4444; border-radius: 8px; margin: 1rem; background: #fef2f2;">
        <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem;">Something went wrong</h1>
        <p style="margin: 0 0 1rem 0; color: #7f1d1d;">
            {error.message || "An unexpected error occurred"}
        </p>
        {#if retry}
            <button
                onclick={retry}
                style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;"
            >
                Try Again
            </button>
        {/if}
        <button
            onclick={() => window.location.href = "/"}
            style="padding: 0.5rem 1rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
            Go Home
        </button>
    </div>
{/if}

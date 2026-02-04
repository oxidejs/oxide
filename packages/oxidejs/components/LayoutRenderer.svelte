<script lang="ts">
    import LayoutRenderer from './LayoutRenderer.svelte';
    import type { ComponentType } from "svelte";

    let {
        routeComponent,
        layoutComponents = [],
        params = {},
        layoutIndex = 0
    }: {
        routeComponent: ComponentType;
        layoutComponents: ComponentType[];
        params: Record<string, any>;
        layoutIndex?: number;
    } = $props();

    const currentLayout = $derived(layoutComponents[layoutIndex]);
    const hasMoreLayouts = $derived(layoutIndex < layoutComponents.length - 1);
    const shouldRenderRoute = $derived(layoutIndex >= layoutComponents.length);
</script>

{#if shouldRenderRoute}
    <svelte:component this={routeComponent} {params} />
{:else}
    <svelte:component this={currentLayout}>
        {#snippet children()}
            <LayoutRenderer
                {routeComponent}
                {layoutComponents}
                {params}
                layoutIndex={layoutIndex + 1}
            />
        {/snippet}
    </svelte:component>
{/if}

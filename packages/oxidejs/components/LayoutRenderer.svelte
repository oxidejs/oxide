<script lang="ts">
    import LayoutRenderer from './LayoutRenderer.svelte';
    import type { ComponentType } from "svelte";
    import type { OxideUrl } from "../src/types.js";

    let {
        routeComponent,
        layoutComponents = [],
        params = {},
        url,
        layoutIndex = 0
    }: {
        routeComponent: ComponentType;
        layoutComponents: ComponentType[];
        params: Record<string, any>;
        url: OxideUrl;
        layoutIndex?: number;
    } = $props();

    const currentLayout = $derived(layoutComponents[layoutIndex]);
    const hasMoreLayouts = $derived(layoutIndex < layoutComponents.length - 1);
    const shouldRenderRoute = $derived(layoutIndex >= layoutComponents.length);
</script>

{#if shouldRenderRoute}
    {@const Component = routeComponent}
    <Component {params} {url} />
{:else}
    {@const Layout = currentLayout}
    <Layout {params} {url}>
        {#snippet children()}
            <LayoutRenderer
                {routeComponent}
                {layoutComponents}
                {params}
                {url}
                layoutIndex={layoutIndex + 1}
            />
        {/snippet}
    </Layout>
{/if}

<script lang="ts">
    import type { ComponentType } from "svelte";
    import type { OxideUrl } from "../src/types.js";
    // Self-import for recursive layout rendering
    import Self from "./LayoutRenderer.svelte";

    let {
        routeComponent,
        layoutComponents = [],
        params = {},
        url,
        layoutIndex = 0,
    }: {
        routeComponent?: ComponentType;
        layoutComponents: ComponentType[];
        params: Record<string, any>;
        url: OxideUrl;
        layoutIndex?: number;
    } = $props();

    const currentLayout = $derived(layoutComponents[layoutIndex]);
    const shouldRenderRoute = $derived(layoutIndex >= layoutComponents.length);
</script>

{#if shouldRenderRoute}
    {#if routeComponent}
        {@const Component = routeComponent}
        <Component {params} {url} />
    {/if}
{:else}
    {@const Layout = currentLayout}
    <Layout {params} {url}>
        {#snippet children()}
            <Self
                {routeComponent}
                {layoutComponents}
                {params}
                {url}
                layoutIndex={layoutIndex + 1}
            />
        {/snippet}
    </Layout>
{/if}

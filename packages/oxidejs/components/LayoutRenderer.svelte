<script lang="ts">
    import type { ComponentType } from "svelte";
    import type { OxideUrl } from "../src/types.js";

    let {
        routeComponent,
        layoutComponents = [],
        params = {},
        url,
        layoutIndex = 0,
        routeBody
    }: {
        routeComponent?: ComponentType;
        layoutComponents: ComponentType[];
        params: Record<string, any>;
        url: OxideUrl;
        layoutIndex?: number;
        routeBody?: string;
    } = $props();

    const currentLayout = $derived(layoutComponents[layoutIndex]);
    const shouldRenderRoute = $derived(layoutIndex >= layoutComponents.length);
</script>

{#if shouldRenderRoute}
    {#if routeBody}
        {@html routeBody}
    {:else if routeComponent}
        {@const Component = routeComponent}
        <Component {params} {url} />
    {/if}
{:else}
    {@const Layout = currentLayout}
    <Layout {params} {url}>
        {#snippet children()}
            <svelte:self
                {routeComponent}
                {layoutComponents}
                {params}
                {url}
                layoutIndex={layoutIndex + 1}
                {routeBody}
            />
        {/snippet}
    </Layout>
{/if}

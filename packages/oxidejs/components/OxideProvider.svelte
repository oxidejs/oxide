<script lang="ts">
    import { setContext } from "svelte";
    import { getOxideRouter } from "../src/client.js";
    import { ROUTER_CONTEXT_KEY, ROUTE_CONTEXT_KEY, PAYLOAD_CONTEXT_KEY } from "../src/context.js";
    import type { Snippet } from "svelte";

    let {
        children
    }: {
        children: Snippet;
    } = $props();

    const router = getOxideRouter();

    if (router) {
        setContext(ROUTER_CONTEXT_KEY, router);
        setContext(ROUTE_CONTEXT_KEY, router.route);
        setContext(PAYLOAD_CONTEXT_KEY, router.payload);
    }
</script>

{@render children()}

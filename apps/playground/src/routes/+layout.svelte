<script lang="ts">
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <title>Oxide - Index</title>
</svelte:head>

<div class="flex flex-col min-h-screen">
    <main class="flex-1 flex flex-col">
        {@render children()}
    </main>
    <footer class="flex items-center justify-center">
        <p>Oxide + Nitro + Vite</p>
    </footer>
</div>

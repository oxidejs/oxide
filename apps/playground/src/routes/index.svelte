<script lang="ts">
    import { client } from "$lib/orpc";

    let timesClicked = $state(0)

    const ping = await client.ping()

    function increase() {
        timesClicked += 1
    }

    async function getPing() {
        const ping = await client.ping()
        console.log('>>>P', ping)
    }
</script>

<div class="flex-1 flex flex-col justify-center items-center">
    <div class="p-4 border rounded flex flex-col gap-4 max-w-xl w-full">
        <h2 class="text-lg font-semibold">Welcome to Oxide</h2>
        <p>Times clicked: {timesClicked}</p>
        <button class="btn btn-lg" onclick={increase}>Click me</button>
        <button class="btn btn-lg" onclick={getPing}>Get Ping</button>
        <p>ping: {ping}</p>
    </div>
</div>

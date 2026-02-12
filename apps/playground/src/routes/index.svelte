<script lang="ts">
    let timesClicked = $state(0)

    const pokemon = await fetch('https://pokeapi.co/api/v2/pokemon/charizard').then((r) => r.json())

    function increase() {
        timesClicked += 1
    }
</script>

<div class="flex-1 flex flex-col justify-center items-center">
    <div class="p-4 border rounded flex flex-col gap-4 max-w-xl w-full">
        <h2 class="text-lg font-semibold">Welcome to Oxide</h2>
        <p>Times clicked: {timesClicked}</p>
        <button class="btn btn-lg" onclick={increase}>Click me</button>
        <p>{pokemon.name}</p>
    </div>
</div>

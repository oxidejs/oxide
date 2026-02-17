<script lang="ts">
    import { ofetch } from "ofetch";
    import { hydratable } from "svelte";

    let timesClicked = $state(0)
    let currentPokemon = $state('charizard')

    const pokemonList = await hydratable('pokemonList', () => ofetch('https://pokeapi.co/api/v2/pokemon')) 
    const pokemon = $derived(await ofetch(`https://pokeapi.co/api/v2/pokemon/${currentPokemon}`))

    function increase() {
        timesClicked += 1
    }
</script>

<div class="flex-1 flex flex-col justify-center items-center">
    <div class="grid grid-cols-2 gap-8 container items-start">
        <div class="card">
            <header>
                <h2>Hydration</h2>
            </header>
            <section>
                <p data-testid="times-clicked" data-times-clicked={timesClicked}>Times clicked: {timesClicked}</p>
            </section>
            <footer>
                <button class="btn btn-lg" onclick={increase} data-testid="increase-times-clicked">Increase</button>
            </footer>
        </div>
        <div class="card">
            <header>
                <h2>Async SSR</h2>
            </header>
            <section class="flex flex-col gap-2">
                <label class="label" for="pokemonName">Pick the pokemon</label>
                <select id="pokemonName" class="select w-80" bind:value={currentPokemon} data-testid="select-pokemon">
                    <optgroup label="Pokemon">
                        {#each pokemonList.results as pokemon}
                            <option selected={pokemon.name === currentPokemon} value={pokemon.name}>{pokemon.name}</option>
                        {/each}
                    </optgroup>
                </select>
                <img data-testid="pokemon-image" src={pokemon.sprites.other.showdown.front_default} class="size-32 object-fit shrink-0" alt={currentPokemon} />
                {#if currentPokemon === 'blastoise'}
                    <p>BIG MAN BLASTOISE!</p>
                {/if}
            </section>
        </div>
    </div>
</div>

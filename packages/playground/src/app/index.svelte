<script lang="ts">
  import { rpc } from "$oxide";

  const ping = await rpc.example.ping();

  async function greet() {
    const result = await rpc.example.greet({ name: "John" });
    console.log(result);
  }

  async function redirect() {
    const result = await rpc.example.redirect();
    console.log(result);
  }
</script>

<p>{ping}</p>

<button onclick={greet} class="btn btn-primary">greet</button>
<button onclick={redirect} class="btn btn-primary">redirect</button>

<script lang="ts">
  interface Props {
    params?: Record<string, string>;
    children?: import('svelte').Snippet;
  }

  let { params = {}, children }: Props = $props();
</script>

<div class="users-layout">
  <nav>
    <h2>Users Section</h2>
  </nav>
  <main>
    {@render children?.()}
  </main>
</div>

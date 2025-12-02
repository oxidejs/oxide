<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();
</script>

<div>
  <h1>Home Page</h1>
  <p>Welcome to the Oxide framework!</p>
</div>

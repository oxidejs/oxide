<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();

  const notFoundPath = $derived(params.catchAll || '');
</script>

<div>
  <h1>404 - Page Not Found</h1>
  <p>The page you are looking for could not be found.</p>
  {#if notFoundPath}
    <p>Path: /{notFoundPath}</p>
  {/if}
  <a href="/">Go Home</a>
</div>

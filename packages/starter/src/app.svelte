<script lang="ts">
  let { router, url } = $props()
</script>

<p>{url.pathname}</p>

<a href="/">Home</a>
<a href="/about">About</a>

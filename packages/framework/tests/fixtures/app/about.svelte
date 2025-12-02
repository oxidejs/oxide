<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();
</script>

<div>
  <h1>About Page</h1>
  <p>This is the about page of our application.</p>
</div>

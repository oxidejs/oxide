<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();
</script>

<div>
  <h1>All Users</h1>
  <div>
    <div>
      <h3>John Doe</h3>
      <a href="/users/john">View Profile</a>
    </div>
    <div>
      <h3>Jane Smith</h3>
      <a href="/users/jane">View Profile</a>
    </div>
  </div>
</div>

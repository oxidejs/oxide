<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();

  const userId = $derived(params.id || '');

  const user = $derived({
    id: userId,
    name: userId === 'john' ? 'John Doe' : userId === 'jane' ? 'Jane Smith' : 'Unknown User',
    email: `${userId}@example.com`
  });
</script>

<div>
  <h1>{user.name}</h1>
  <p>ID: {userId}</p>
  <p>Email: {user.email}</p>
  <a href="/users">← Back to Users</a>
</div>

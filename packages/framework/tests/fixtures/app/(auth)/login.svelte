<script lang="ts">
  interface Props {
    params?: Record<string, string>;
  }

  let { params = {} }: Props = $props();

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state('');

  function handleSubmit() {
    isLoading = true;
    error = '';

    setTimeout(() => {
      if (email === 'admin@example.com' && password === 'password') {
        window.location.href = '/dashboard';
      } else {
        error = 'Invalid email or password';
      }
      isLoading = false;
    }, 1000);
  }
</script>

<div>
  <h1>Login</h1>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form onsubmit|preventDefault={handleSubmit}>
    <div>
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        required
        placeholder="Enter your email"
      />
    </div>

    <div>
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        placeholder="Enter your password"
      />
    </div>

    <button type="submit" disabled={isLoading}>
      {isLoading ? 'Logging in...' : 'Login'}
    </button>
  </form>

  <div>
    <p>Don't have an account? <a href="/register">Sign up</a></p>
  </div>
</div>

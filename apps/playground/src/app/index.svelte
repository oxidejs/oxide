<script lang="ts">
  import { rpc } from "$oxide";
  import { action } from "$lib/forms"
  import { authClient } from "$lib/auth-client";
  import { toast } from "svelte-sonner";

  let email = $state('')
  let otp = $state('')

  const ping = await rpc.example.ping();
  const value = await rpc.example.get();
  const session = await authClient.getSession()

  async function greet() {
    const result = await rpc.example.greet({ name: "John" });
    console.log(result);
  }

  async function redirect() {
    const result = await rpc.example.redirect();
    console.log(result);
  }

  async function setValue() {
    await rpc.example.set({ value: "test" });
  }

  async function sendOtp() {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in"
    })
    if (error) {
      return toast.error(error.message ?? "Auth error")
    }
  }

  async function verifyOtp() {
    const { error } = await authClient.signIn.emailOtp({
      email,
      otp
    })
    if (error) {
      return toast.error(error.message ?? "Auth error")
    }
  }
</script>

<p>{session?.data?.user.email ?? 'Signed Out'}</p>
<p>{ping}</p>
<p>{value}</p>

<button onclick={greet} class="btn btn-primary">greet</button>
<button onclick={redirect} class="btn btn-primary">redirect</button>
<button onclick={setValue} class="btn btn-primary">set</button>

<form {@attach action(rpc.example.greet)}>
  <input type="text" name="name" class="input" />
  <button type="submit" class="btn btn-primary">submit</button>
</form>

<form>
  <input type="text" name="email" class="input" bind:value={email} />
  <input type="text" name="otp" class="input" bind:value={otp} />
  <button type="button" class="btn btn-primary" onclick={sendOtp}>send otp</button>
  <button type="button" class="btn btn-primary" onclick={verifyOtp}>verify otp</button>
</form>

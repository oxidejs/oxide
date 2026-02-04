<script lang="ts">
    import { link } from "oxidejs";

    let { params = {} }: { params: Record<string, string> } = $props();



    const userId = params.id || "unknown";
    const isValidId = /^\d+$/.test(userId);



    // Simulate an error for testing error boundaries
    if (userId === "error") {
        throw new Error("Simulated user loading error");
    }
</script>

<div class="p-4 max-w-xl">
    <h2 class="text-lg font-semibold mb-4">User Profile</h2>

    {#if isValidId}
        <div class="border rounded p-4 mb-4">
            <p class="mb-2"><strong>User ID:</strong> {userId}</p>
            <p class="mb-2"><strong>Name:</strong> User {userId}</p>
            <p class="mb-2"><strong>Email:</strong> user{userId}@example.com</p>
        </div>
    {:else}
        <div class="border border-yellow-500 rounded p-4 mb-4 bg-yellow-50">
            <p class="text-yellow-800">Invalid user ID: {userId}</p>
            <p class="text-sm text-yellow-600 mt-2">User ID should be a number</p>
        </div>
    {/if}

    <div class="flex gap-2 flex-wrap">
        <a href="/" class="btn" use:link>Home</a>
        <a href="/user/123" class="btn" use:link>User 123</a>
        <a href="/user/456" class="btn" use:link>User 456</a>
        <a href="/user/invalid" class="btn" use:link>Invalid User</a>
        <a href="/user/error" class="btn bg-red-500 text-white" use:link>Test Error</a>
    </div>
</div>

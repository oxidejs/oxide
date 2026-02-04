<script lang="ts">
    import { link } from "oxidejs";

    let { error, params = {}, retry }: {
        error: Error;
        params?: Record<string, string>;
        retry?: () => void;
    } = $props();

    const userId = params.id || "unknown";
</script>

<div class="p-4 max-w-xl">
    <div class="border border-red-500 rounded-lg p-6 bg-red-50">
        <div class="flex items-center mb-4">
            <svg class="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <h2 class="text-lg font-semibold text-red-800">User Route Error</h2>
        </div>

        <div class="mb-4">
            <p class="text-red-700 mb-2">
                <strong>Error:</strong> {error.message}
            </p>
            {#if userId}
                <p class="text-sm text-red-600">
                    Failed to load user: <strong>{userId}</strong>
                </p>
            {/if}
        </div>

        <div class="flex gap-2 flex-wrap">
            {#if retry}
                <button
                    onclick={retry}
                    class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                    Try Again
                </button>
            {/if}
            <a href="/user/123" class="btn" use:link>Go to Valid User</a>
            <a href="/" class="btn" use:link>Go Home</a>
        </div>
    </div>

    <div class="mt-4 p-4 border rounded bg-blue-50">
        <p class="text-sm text-blue-700">
            <strong>Debug Info:</strong> This error was caught by the user route error boundary.
            Error boundaries help provide better user experience when things go wrong.
        </p>
    </div>
</div>

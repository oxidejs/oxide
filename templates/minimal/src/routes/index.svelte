<script lang="ts">
    import { link } from "oxidejs";

    let timesClicked = $state(0)

    function increase() {
        timesClicked += 1
    }
</script>

<div class="flex-1 flex flex-col justify-center items-center">
    <div class="p-4 border rounded flex flex-col gap-4 max-w-xl w-full">
        <h2 class="text-lg font-semibold">Welcome to Oxide</h2>
        <p>Times clicked: {timesClicked}</p>
        <button class="btn btn-lg" onclick={increase}>Click me</button>

        <div class="grid grid-cols-2 gap-2 mt-4">
            <a href="/nested/ok" class="btn" use:link>Nested Route</a>
            <a href="/user/123" class="btn" use:link>User 123</a>
            <a href="/user/error" class="btn bg-red-100 text-red-700" use:link>Test Error</a>
            <a href="/docs" class="btn" use:link>Documentation</a>
            <a href="/docs/getting-started" class="btn" use:link>Getting Started</a>
            <a href="/docs/api/components" class="btn" use:link>API Docs</a>
        </div>

        <div class="mt-4 p-3 bg-gray-50 rounded text-sm">
            <p class="font-medium mb-2">Test Features:</p>
            <ul class="space-y-1 text-gray-600">
                <li>• Client-side navigation with use:link</li>
                <li>• Dynamic routes with parameters</li>
                <li>• Error boundaries and error handling</li>
                <li>• Catch-all routes for flexible routing</li>
                <li>• Layout composition and nesting</li>
            </ul>
        </div>
    </div>
</div>

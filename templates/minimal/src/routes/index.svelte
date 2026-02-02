<script lang="ts">
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

        <div class="flex gap-4 mt-4">
            <a href="/nested/ok" class="btn">Go to Nested Route</a>
            <a href="/" class="btn">Home</a>
        </div>
    </div>
</div>

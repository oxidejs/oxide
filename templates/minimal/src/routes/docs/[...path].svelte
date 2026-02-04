<script lang="ts">
    import { link } from "oxidejs";

    let { params = {} }: { params: Record<string, string> } = $props();

    const docsPath = params.path || "";
    const pathSegments = docsPath.split("/").filter(Boolean);

    // Simulate different doc sections
    const sections = {
        "getting-started": {
            title: "Getting Started",
            content: "Welcome to the getting started guide! This section covers basic setup and installation."
        },
        "api": {
            title: "API Reference",
            content: "Complete API documentation with examples and usage patterns."
        },
        "guides": {
            title: "Guides",
            content: "Step-by-step guides for common tasks and advanced usage."
        },
        "examples": {
            title: "Examples",
            content: "Real-world examples and code samples to help you get started."
        }
    };

    const currentSection = pathSegments[0] || "overview";
    const sectionData = sections[currentSection as keyof typeof sections];
</script>

<div class="p-4 max-w-4xl">
    <nav class="mb-6 text-sm">
        <ol class="flex items-center space-x-2 text-gray-600">
            <li><a href="/" class="hover:text-blue-600" use:link>Home</a></li>
            <li class="mx-2">/</li>
            <li><a href="/docs" class="hover:text-blue-600" use:link>Docs</a></li>
            {#each pathSegments as segment, index}
                <li class="mx-2">/</li>
                <li class={index === pathSegments.length - 1 ? "text-gray-900 font-medium" : "hover:text-blue-600"}>
                    {#if index < pathSegments.length - 1}
                        <a href="/docs/{pathSegments.slice(0, index + 1).join('/')}" use:link>{segment}</a>
                    {:else}
                        {segment}
                    {/if}
                </li>
            {/each}
        </ol>
    </nav>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <!-- Sidebar -->
        <aside class="md:col-span-1">
            <nav class="space-y-2">
                <h3 class="font-semibold text-gray-900 mb-3">Documentation</h3>
                <ul class="space-y-1">
                    <li>
                        <a
                            href="/docs"
                            class="block px-3 py-2 rounded {currentSection === 'overview' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}"
                            use:link
                        >
                            Overview
                        </a>
                    </li>
                    {#each Object.keys(sections) as section}
                        <li>
                            <a
                                href="/docs/{section}"
                                class="block px-3 py-2 rounded {currentSection === section ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}"
                                use:link
                            >
                                {sections[section as keyof typeof sections].title}
                            </a>
                        </li>
                    {/each}
                </ul>
            </nav>
        </aside>

        <!-- Main content -->
        <main class="md:col-span-3">
            {#if currentSection === "overview" || !sectionData}
                <div class="prose max-w-none">
                    <h1 class="text-3xl font-bold text-gray-900 mb-6">Documentation</h1>

                    {#if docsPath}
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <p class="text-yellow-800">
                                <strong>Catch-all route active:</strong> Path captured as "{docsPath}"
                            </p>
                            <p class="text-sm text-yellow-700 mt-2">
                                This demonstrates how catch-all routes work with the [...path] syntax.
                            </p>
                        </div>
                    {/if}

                    <p class="text-gray-600 mb-6">
                        Welcome to the Oxide framework documentation. This demonstrates a catch-all route
                        that can handle any path under /docs/*.
                    </p>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {#each Object.entries(sections) as [key, section]}
                            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                <h3 class="font-semibold mb-2">
                                    <a href="/docs/{key}" class="text-blue-600 hover:text-blue-800" use:link>
                                        {section.title}
                                    </a>
                                </h3>
                                <p class="text-sm text-gray-600">{section.content}</p>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="prose max-w-none">
                    <h1 class="text-3xl font-bold text-gray-900 mb-6">{sectionData.title}</h1>

                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p class="text-blue-800">
                            <strong>Current path:</strong> /docs/{docsPath}
                        </p>
                        <p class="text-sm text-blue-700 mt-2">
                            Path segments: {JSON.stringify(pathSegments)}
                        </p>
                    </div>

                    <p class="text-gray-700 mb-6">{sectionData.content}</p>

                    <div class="bg-gray-50 border rounded-lg p-4">
                        <h3 class="font-semibold mb-3">Try these paths:</h3>
                        <div class="space-y-2">
                            <a href="/docs/getting-started/installation" class="block text-blue-600 hover:text-blue-800" use:link>
                                → /docs/getting-started/installation
                            </a>
                            <a href="/docs/api/components/button" class="block text-blue-600 hover:text-blue-800" use:link>
                                → /docs/api/components/button
                            </a>
                            <a href="/docs/guides/routing/dynamic" class="block text-blue-600 hover:text-blue-800" use:link>
                                → /docs/guides/routing/dynamic
                            </a>
                        </div>
                    </div>
                </div>
            {/if}
        </main>
    </div>
</div>

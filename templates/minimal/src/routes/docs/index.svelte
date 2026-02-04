<script lang="ts">
    import { link } from "oxidejs";

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
</script>

<div class="p-4 max-w-4xl">
    <nav class="mb-6 text-sm">
        <ol class="flex items-center space-x-2 text-gray-600">
            <li><a href="/" class="hover:text-blue-600" use:link>Home</a></li>
            <li class="mx-2">/</li>
            <li class="text-gray-900 font-medium">Docs</li>
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
                            class="block px-3 py-2 rounded bg-blue-100 text-blue-700"
                            use:link
                        >
                            Overview
                        </a>
                    </li>
                    {#each Object.keys(sections) as section}
                        <li>
                            <a
                                href="/docs/{section}"
                                class="block px-3 py-2 rounded text-gray-700 hover:bg-gray-100"
                                use:link
                            >
                                {sections[section].title}
                            </a>
                        </li>
                    {/each}
                </ul>
            </nav>
        </aside>

        <!-- Main content -->
        <main class="md:col-span-3">
            <div class="prose max-w-none">
                <h1 class="text-3xl font-bold text-gray-900 mb-6">Documentation</h1>

                <p class="text-gray-600 mb-6">
                    Welcome to the Oxide framework documentation. This is the main overview page
                    that provides an introduction to all available documentation sections.
                </p>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p class="text-blue-800">
                        <strong>Index route:</strong> This page demonstrates the /docs index route
                        that handles requests to /docs without any additional path segments.
                    </p>
                </div>

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

                <div class="mt-6 bg-gray-50 border rounded-lg p-4">
                    <h3 class="font-semibold mb-3">Try these paths:</h3>
                    <div class="space-y-2">
                        <a href="/docs/getting-started" class="block text-blue-600 hover:text-blue-800" use:link>
                            → /docs/getting-started
                        </a>
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
        </main>
    </div>
</div>

# Oxide Documentation

## FAQ:

### What is Oxide?

Oxide is a Svelte meta framework that serves as a thin addition to Nitro.js. It's literally just a renderer for Nitro and a hybrid (server-side rendering/client-side) router for Svelte.

### Is it production-ready?

Not really. It's cutting-edge technology, so use it carefully.

### What's the idea behind Oxide?

There are a few paradigms and ideas:

- We don't hide the internals of Vite and Nitro, so it's highly extensible.
- It is opinionated, but you can easily replace its parts with alternatives.
- We target modern browsers and APIs.
- We avoid reinventing the wheel and instead provide the framework with patterns you may already know.
- We want this framework to be accessible to LLMs, debuggers, and anything else that helps you build better, safer apps.

### How is it different from SvelteKit?

SvelteKit is an excellent meta-framework for building serious apps with Svelte. However, it has undergone a few iterations and must support apps built with older Svelte APIs, as well as apps built with Svelte 5 and experimental APIs. Oxide, on the other hand, is cutting-edge and focused on the latest APIs. There are no loaders, form actions, remote functions, or other SvelteKit APIs. Why spend time deciding which APIs to use when you can just load data server-side with the await API?

### Why is it a Nitro plugin and not a Vite plugin?

Nitro is a powerful tool for building modern, advanced web applications. Oxide avoids interfering with and overriding Nitro's default behaviors as much as possible.
While developing with Oxide, you can enjoy all of Nitro's standard features. This means you can use the tasks, server routes, web sockets, KV, and cache that come with Nitro.

### Does Oxide support static site generation (SSG)?

Not yet, but it will be available once prerendering support is implemented in Nitro: https://github.com/nitrojs/nitro/issues/3461.

### Where can I deploy my Oxide app?

You can deploy your Oxide app anywhere that Nitro supports, including Vercel, Netlify, Cloudflare Workers, and more.

### Can I migrate an existing SvelteKit app to Oxide?

Yes, but it may require some effort. Since Oxide and SvelteKit have different architectures and APIs, you'll need to adapt your code accordingly. However, if your app is built with modern Svelte APIs, the migration process should be easier.

### Is there a CLI tool for scaffolding Oxide projects?

No, but there are two starter templates available that you can use as a starting point for your projects:

- `minimal`: A minimal Oxide project with just the essentials.
- `maximal`: A more feature-rich Oxide project with additional tools and libraries that are convenient for building SaaS applications.

### What is the roadmap for Oxide?

Oxide is still in its early stages. There will be a link to the roadmap once it is clarified.

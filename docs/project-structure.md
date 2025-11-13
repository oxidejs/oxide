# Project Structure

Learn where do modules and components belong to.

```
├── .oxide/ — Directory for build-time generated typings.
├── node_modules/
├── src/
│   ├── app/ — Directory for view routes and oRPC routers.
│   ├── lib/ — Directory for your application's library.
│   ├── app.css — Main styling entry.
│   ├── app.svelte — Main app component.
│   ├── client.ts — Client side app entry.
│   └── server.ts — Server side app entry.
├── .gitignore
├── .prettierrc
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

## src/app/

The `src/app` directory is the heart of your full-stack application. You should add there all the view handlers and [oRPC routers](/orpc).

Read the dedicated [Routing](/routing) guide to learn more about the view routes.

## src/lib/

The `src/lib` directory is where you should put your reusable UI components and utilities.

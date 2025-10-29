# Project Structure

Learn where do modules and components belong to.

```
├── .oxide/ — Directory for build-time generated typings.
├── node_modules/
├── src/
│   ├── app/ — Directory for view routes.
│   ├── lib/ — Directory for your application's library.
│   ├── routers/ — Directory for oRPC routers.
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

The `src/app` directory is the heart of your full-stack application. You should add there all the view and API routes.

Read the dedicated [Routing](/routing) guide to learn more about the view routes.

## src/lib/

The `src/lib` directory is where you should put your reusable UI components and utilities.

## src/routers/

The `src/routers` directory is where you should add all oRPC routers to be automatically served unter `/rpc` path.

Read the dedicated [oRPC](/orpc) guide to learn more about the routers.

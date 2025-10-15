import { hydrate } from "svelte";
import "./app.css";
import App from "./app.svelte";

const context = new Map();
context.set("location", new URL(window.location.href));

const app = hydrate(App, {
  target: document.getElementById("app")!,
  context,
});

export default app;

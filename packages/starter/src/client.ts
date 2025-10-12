import { hydrate } from "svelte";
import "./app.css";
import App from "./app.svelte";

const app = hydrate(App, {
  target: document.getElementById("app")!,
  props: {
    router: null,
    url: new URL(window.location.href),
  },
});

export default app;

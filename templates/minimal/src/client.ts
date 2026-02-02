import { initializeOxideRouter } from "oxidejs";
import routesManifest from "../.oxide/client-routes.js";
import "./app.css";

// Initialize Oxide router with routes manifest from generated file
initializeOxideRouter(routesManifest);

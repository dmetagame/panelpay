import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [
      react(),
      {
        name: "panelpay-local-api",
        configureServer(server) {
          server.middlewares.use("/api", async (req, res) => {
            try {
              const { default: handler } =
                await server.ssrLoadModule("/api/index.ts");
              await handler(req, res);
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: (e as Error).message }));
            }
          });
        },
      },
    ],
    server: { host: "0.0.0.0" },
  };
});

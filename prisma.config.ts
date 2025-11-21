import { defineConfig, env } from "prisma/config";
import { config } from "./src/config/index.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // adapter
  datasource: {
    url: config.dbUri,
  },
});

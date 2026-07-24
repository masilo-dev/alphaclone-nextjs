#!/usr/bin/env node

import nextEnv from "@next/env";
import { validateProductionEnv } from "./production-env.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false, console);

const soft =
  process.argv.includes("--warn-only") ||
  process.env.VALIDATE_ENV_WARN_ONLY === "1" ||
  process.env.VALIDATE_ENV_WARN_ONLY === "true";

const result = validateProductionEnv(process.env);
if (!result.ok) {
  const stream = soft ? process.stdout : process.stderr;
  stream.write(
    soft
      ? "[startup] Production environment validation warnings (continuing so healthchecks can pass):\n"
      : "[startup] Production environment validation failed:\n",
  );
  for (const error of result.errors) stream.write(`- ${error}\n`);
  if (!soft) process.exit(1);
  process.exit(0);
}

process.stdout.write(
  `[startup] Production environment validated (${Object.keys(result.configured).length} critical settings).\n`,
);

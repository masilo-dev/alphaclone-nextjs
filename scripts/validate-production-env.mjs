#!/usr/bin/env node

import nextEnv from "@next/env";
import { validateProductionEnv } from "./production-env.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false, console);

const result = validateProductionEnv(process.env);
if (!result.ok) {
  process.stderr.write("[startup] Production environment validation failed:\n");
  for (const error of result.errors) process.stderr.write(`- ${error}\n`);
  process.exit(1);
}

process.stdout.write(
  `[startup] Production environment validated (${Object.keys(result.configured).length} critical settings).\n`,
);

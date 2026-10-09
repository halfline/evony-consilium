import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyAssets } from "./verify-assets.js";

export async function prepareAssets(output = "web/assets") {
  await mkdir(".asset-cache", { recursive: true });
  const temporary = await mkdtemp(resolve(".asset-cache", "generated-"));
  try {
    const python = process.env.ASSET_PYTHON || ".venv/bin/python";
    await new Promise((accept, reject) => {
      const child = spawn(
        python,
        [
          "scripts/acquire-assets.py",
          "--output",
          temporary,
          "--avatars",
          "--terrain",
          "--icons",
        ],
        { stdio: "inherit" },
      );
      child.on("error", (error) =>
        reject(
          new Error(
            `Cannot run ${python}. Install the Python asset dependencies described in README.md.`,
            { cause: error },
          ),
        ),
      );
      child.on("exit", (code, signal) =>
        code === 0
          ? accept()
          : reject(new Error(`Asset acquisition failed (${signal || code}).`)),
      );
    });
    await verifyAssets(temporary);
    await mkdir(output, { recursive: true });
    for (const entry of await readdir(output)) {
      if (entry !== "branding")
        await rm(resolve(output, entry), { recursive: true, force: true });
    }
    await cp(temporary, output, { recursive: true });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await prepareAssets();
}

import * as esbuild from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp("src/manifest.json", `${outdir}/manifest.json`);

const ctx = await esbuild.context({
  entryPoints: ["src/content.ts"],
  outdir,
  bundle: true,
  format: "iife",
  target: "es2022",
  sourcemap: "inline",
  logLevel: "info",
  define: {
    __EXT_NAME__: JSON.stringify(manifest.name),
    __EXT_VERSION__: JSON.stringify(manifest.version),
  },
});

if (watch) {
  await ctx.watch();
  console.log(`esbuild watching; output in ${outdir}/`);
} else {
  await ctx.rebuild();
  await ctx.dispose();
}

import { access, readFile } from "node:fs/promises";

for (const file of ["index.html", "styles.css", "app.js"]) {
  await access(new URL(`../${file}`, import.meta.url));
}
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
if (!html.includes('type="module"') || !html.includes("app.js")) {
  throw new Error("index.html must load app.js as an ES module");
}
console.log("static frontend check passed");

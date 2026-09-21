import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");

test("phone layout prevents horizontal overflow in flexible rows", () => {
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.site-header\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /nav\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.admin-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.filters\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.article-body\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.post-card-featured \.post-card-image[\s\S]*?margin:\s*-24px -24px 24px/s);
});

test("tablet layout has a two-column post grid", () => {
  assert.match(css, /@media\s*\(min-width:\s*761px\)\s*and\s*\(max-width:\s*1099px\)[\s\S]*?\.post-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/s);
});

test("about heading scales and wraps on narrow screens", () => {
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.about-page h1\s*\{[^}]*font-size:\s*clamp\(42px,\s*12vw,\s*55px\)/s);
  assert.match(css, /\.about-page h1\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

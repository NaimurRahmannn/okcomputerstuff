import test from "node:test";
import assert from "node:assert/strict";
import * as app from "./app.js";

const { filterPosts, formatDate, renderMarkdown } = app;

test("filters posts by category and search phrase", () => {
  const posts = [
    { title: "AWS notes", excerpt: "Cloud basics", category: "Cloud" },
    { title: "A quiet morning", excerpt: "Writing", category: "Life" },
  ];
  assert.deepEqual(filterPosts(posts, { category: "Cloud", query: "aws" }), [posts[0]]);
});

test("formats published dates for readers", () => {
  assert.equal(formatDate("2026-09-20T00:00:00Z"), "September 20, 2026");
});

test("renders markdown without allowing raw HTML", () => {
  const html = renderMarkdown("# Hello\n\n<script>alert('x')</script>");
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("renders display math fractions safely", () => {
  const html = renderMarkdown("$$\\text{Arithmetic Intensity} = \\frac{\\text{FLOPs}}{\\text{Bytes Moved}}$$");
  assert.match(html, /class="math-display"/);
  assert.match(html, /class="math-fraction"/);
  assert.match(html, /Arithmetic Intensity/);
  assert.match(html, /Bytes Moved/);
});

test("rerenders when navigation targets the current admin route", () => {
  const originalWindow = globalThis.window;
  let renderCount = 0;
  globalThis.window = { location: { hash: "#/admin" } };

  try {
    assert.equal(typeof app.navigateTo, "function");
    app.navigateTo("#/admin", () => { renderCount += 1; });
    assert.equal(renderCount, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("uses the Flask development server for the local frontend", () => {
  assert.equal(typeof app.resolveApiPrefix, "function");
  assert.equal(
    app.resolveApiPrefix({ port: "4173" }),
    "http://127.0.0.1:5000/api/v1",
  );
  assert.equal(
    app.resolveApiPrefix({ hostname: "localhost", port: "5500" }),
    "http://127.0.0.1:5000/api/v1",
  );
  assert.equal(
    app.resolveApiPrefix({ hostname: "127.0.0.1", port: "3000" }),
    "http://127.0.0.1:5000/api/v1",
  );
});

test("requires authentication before rendering the new-story editor", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({ error: { message: "Authentication required" } }),
  });
  const root = {
    innerHTML: "",
    querySelector: () => ({ addEventListener() {} }),
  };

  try {
    assert.equal(typeof app.renderEditor, "function");
    await app.renderEditor(root);
    assert.match(root.innerHTML, /Welcome back\./);
    assert.doesNotMatch(root.innerHTML, /Begin anywhere\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

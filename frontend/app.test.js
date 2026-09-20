import test from "node:test";
import assert from "node:assert/strict";
import { filterPosts, formatDate, renderMarkdown } from "./app.js";

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

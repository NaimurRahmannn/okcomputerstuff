export function resolveApiPrefix(location) {
  const isLocalHost = location?.hostname === "127.0.0.1" || location?.hostname === "localhost";
  const isKnownLocalFrontend = location?.port === "4173" || (isLocalHost && location?.port !== "5000");
  return isKnownLocalFrontend ? "http://127.0.0.1:5000/api/v1" : "/api/v1";
}

const API_PREFIX = resolveApiPrefix(typeof window !== "undefined" ? window.location : null);

export function formatDate(value) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
}

export function filterPosts(posts, { category = "All stories", query = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return posts.filter((post) => {
    const matchesCategory = category === "All stories" || post.category === category;
    const matchesQuery = !needle || `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function renderMathExpression(value) {
  let math = escapeHtml(value).trim();
  math = math.replace(/\\text\{([^{}]*)\}/g, '<span class="math-text">$1</span>');
  math = math.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '<span class="math-fraction"><span>$1</span><span>$2</span></span>');
  math = math.replace(/\\times/g, "&times;").replace(/\\approx/g, "&asymp;").replace(/\\min/g, "min");
  return math;
}

export function renderMarkdown(markdown = "") {
  const safe = escapeHtml(markdown);
  return safe.split(/\n{2,}/).map((block) => {
    if (block.startsWith("$$") && block.endsWith("$$")) return `<div class="math-display" role="math">${renderMathExpression(block.slice(2, -2))}</div>`;
    if (block.startsWith("### ")) return `<h3>${block.slice(4)}</h3>`;
    if (block.startsWith("## ")) return `<h2>${block.slice(3)}</h2>`;
    if (block.startsWith("# ")) return `<h1>${block.slice(2)}</h1>`;
    const inline = block.replace(/\$([^$]+)\$/g, (_, expression) => `<span class="math-inline" role="math">${renderMathExpression(expression)}</span>`).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");
    return `<p>${inline.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_PREFIX}${path}`, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Something went wrong");
  return payload.data;
}

export function navigateTo(hash, rerender = route) {
  if (window.location.hash === hash) {
    rerender();
    return;
  }
  window.location.hash = hash;
}

function shell(content, { eyebrow = "okcomputerstuff", title = "Stories for a slower internet" } = {}) {
  return `<header class="site-header"><a class="wordmark" href="#/" aria-label="okcomputerstuff home"><span class="wordmark-mark">O</span><span>okcomputerstuff</span></a><nav><a href="#/">Journal</a><a href="#/about">About</a><a class="nav-admin" href="#/admin">Write</a></nav></header><main>${content}</main><footer class="site-footer"><span>© 2026 okcomputerstuff Journal</span><span>Notes on craft, cloud, and a life well observed.</span></footer>`;
}

function loading(message = "Gathering the latest notes…") { return `<div class="state"><span class="spinner"></span>${message}</div>`; }
function errorState(message) { return `<div class="state state-error"><strong>We hit a quiet snag.</strong><span>${escapeHtml(message)}</span><a class="text-link" href="#/">Try again</a></div>`; }

function postCard(post, featured = false) {
  return `<article class="post-card ${featured ? "post-card-featured" : ""}"><div class="post-card-meta"><span class="tag">${escapeHtml(post.category)}</span><time>${formatDate(post.publishedAt)}</time></div><h2><a href="#/post/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt || "A new note from the journal.")}</p><a class="text-link" href="#/post/${encodeURIComponent(post.slug)}">Read story <span>↗</span></a></article>`;
}

async function renderHome(root) {
  root.innerHTML = shell(`<section class="hero"><div class="hero-copy"><p class="eyebrow">A personal journal · Dhaka / Everywhere</p><h1>Make room for<br><em>better questions.</em></h1><p class="hero-lede">An evolving collection of field notes on building things, learning in public, and the small details that make a life feel like yours.</p><a class="button button-dark" href="#/about">Meet the writer <span>↗</span></a></div><div class="hero-art" aria-hidden="true"><div class="sun"></div><div class="hill hill-back"></div><div class="hill hill-front"></div><span class="hero-stamp">Est.<br>2026</span></div></section><section class="section" id="journal"><div class="section-heading"><div><p class="eyebrow">The journal</p><h2>Recent notes</h2></div><div class="filters"><label class="search-label"><span>⌕</span><input id="search" type="search" placeholder="Search stories" aria-label="Search stories"></label><select id="category" aria-label="Filter by category"><option>All stories</option></select></div></div><div id="posts" class="post-grid">${loading()}</div></section>`);
  const postsElement = root.querySelector("#posts");
  try {
    const data = await apiRequest("/posts");
    const posts = data.items || [];
    const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
    const category = root.querySelector("#category");
    category.insertAdjacentHTML("beforeend", categories.map((item) => `<option>${escapeHtml(item)}</option>`).join(""));
    const paint = () => {
      const visible = filterPosts(posts, { category: category.value, query: root.querySelector("#search").value });
      postsElement.innerHTML = visible.length ? visible.map((post, index) => postCard(post, index === 0)).join("") : `<div class="state"><strong>No published stories yet.</strong><span>Try a different search, or come back soon.</span></div>`;
    };
    category.addEventListener("change", paint);
    root.querySelector("#search").addEventListener("input", paint);
    paint();
  } catch (error) { postsElement.innerHTML = errorState(error.message); }
}

async function renderPost(root, slug) {
  root.innerHTML = shell(`<div class="article-loading">${loading()}</div>`);
  try {
    const post = await apiRequest(`/posts/${encodeURIComponent(slug)}`);
    root.innerHTML = shell(`<article class="article"><a class="back-link" href="#/">← Back to journal</a><div class="article-header"><span class="tag">${escapeHtml(post.category)}</span><h1>${escapeHtml(post.title)}</h1><p class="article-excerpt">${escapeHtml(post.excerpt || "")}</p><time>${formatDate(post.publishedAt)}</time></div><div class="article-rule"></div><div class="article-body">${renderMarkdown(post.contentMarkdown || "")}</div><div class="article-endmark">✦</div></article>`);
  } catch (error) { root.innerHTML = shell(errorState(error.message)); }
}

function renderAbout(root) {
  root.innerHTML = shell(`<section class="about-page"><p class="eyebrow">A little context</p><h1>Hello, this is Lam—I’m the<br><em>person behind</em> okcomputerstuff.</h1><div class="about-columns"><p class="about-lede">I write about the intersection of thoughtful technology and ordinary life — the tools we make, the systems we learn, and the quiet practices that keep us human.</p><div><p>okcomputerstuff is a small corner of the internet for work-in-progress thinking. No hot takes required. Just useful notes, honest experiments, and the occasional long walk.</p><a class="button button-outline" href="mailto:hello@example.com">Say hello <span>↗</span></a></div></div></section>`);
}

function loginView(root) {
  root.innerHTML = shell(`<section class="auth-page"><p class="eyebrow">Private studio</p><h1>Welcome back.</h1><p class="auth-copy">Sign in to shape the next story.</p><form id="login-form" class="form-card"><label>Email<input required type="email" name="email" autocomplete="username"></label><label>Password<input required type="password" name="password" autocomplete="current-password"></label><div id="login-error" class="form-error" role="alert"></div><button class="button button-dark" type="submit">Open the studio <span>↗</span></button></form></section>`);
  root.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); navigateTo("#/admin"); }
    catch (error) { root.querySelector("#login-error").textContent = error.message; }
  });
}

async function renderAdmin(root) {
  try {
    await apiRequest("/auth/me");
  } catch { loginView(root); return; }
  root.innerHTML = shell(`<section class="admin-page"><div class="admin-heading"><div><p class="eyebrow">Private studio</p><h1>Your stories.</h1></div><div class="admin-actions"><button id="logout" class="button button-outline">Sign out</button><a class="button button-dark" href="#/admin/new">New story <span>＋</span></a></div></div><div id="admin-posts" class="admin-list">${loading()}</div></section>`);
  root.querySelector("#logout").addEventListener("click", async () => { await apiRequest("/auth/logout", { method: "POST" }); window.location.hash = "#/"; });
  try {
    const data = await apiRequest("/posts?status=all");
    const posts = data.items || [];
    root.querySelector("#admin-posts").innerHTML = posts.length ? posts.map((post) => `<a class="admin-row" href="#/admin/edit/${encodeURIComponent(post.slug)}"><span><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.category)} · ${post.status}</small></span><span class="row-arrow">→</span></a>`).join("") : `<div class="state"><strong>Your notebook is empty.</strong><span>Write the first story when you’re ready.</span></div>`;
  } catch (error) { root.querySelector("#admin-posts").innerHTML = errorState(error.message); }
}

export async function renderEditor(root, slug = null) {
  try {
    await apiRequest("/auth/me");
  } catch {
    loginView(root);
    return;
  }
  let post = { title: "", excerpt: "", category: "Notes", contentMarkdown: "", status: "draft", coverImageUrl: "" };
  if (slug) {
    try { post = await apiRequest(`/posts/${encodeURIComponent(slug)}`); } catch (error) { root.innerHTML = shell(errorState(error.message)); return; }
  }
  root.innerHTML = shell(`<section class="editor-page"><a class="back-link" href="#/admin">← Back to studio</a><div class="editor-heading"><div><p class="eyebrow">${slug ? "Edit story" : "New story"}</p><h1>${slug ? "Shape the draft." : "Begin anywhere."}</h1></div><span id="save-state" class="save-state">${post.status}</span></div><form id="editor-form" class="editor-form"><div class="editor-main"><label>Title<input name="title" required value="${escapeHtml(post.title)}" placeholder="A title worth opening"></label><label>Excerpt<textarea name="excerpt" rows="3" placeholder="A sentence or two to invite the reader">${escapeHtml(post.excerpt || "")}</textarea></label><label>Story <span class="label-hint">Markdown supported</span><textarea id="body" name="contentMarkdown" rows="18" required placeholder="# Start with a question">${escapeHtml(post.contentMarkdown || "")}</textarea></label></div><aside class="editor-side"><label>Category<input name="category" value="${escapeHtml(post.category || "Notes")}"></label><label>Cover image URL<input name="coverImageUrl" value="${escapeHtml(post.coverImageUrl || "")}" placeholder="https://…"></label><label>Status<select name="status"><option value="draft" ${post.status === "draft" ? "selected" : ""}>Draft</option><option value="published" ${post.status === "published" ? "selected" : ""}>Published</option></select></label><div class="preview-label">Live preview</div><div id="preview" class="markdown-preview"></div><button class="button button-dark" type="submit">Save story <span>↗</span></button>${slug ? `<button id="delete-post" class="button button-danger" type="button">Delete story</button>` : ""}</aside></form></section>`);
  const form = root.querySelector("#editor-form");
  const body = root.querySelector("#body");
  const preview = root.querySelector("#preview");
  const paintPreview = () => { preview.innerHTML = renderMarkdown(body.value); };
  body.addEventListener("input", paintPreview); paintPreview();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try { await apiRequest(slug ? `/posts/${encodeURIComponent(slug)}` : "/posts", { method: slug ? "PUT" : "POST", body: JSON.stringify(values) }); window.location.hash = "#/admin"; }
    catch (error) { root.querySelector("#save-state").textContent = error.message; root.querySelector("#save-state").classList.add("is-error"); }
  });
  root.querySelector("#delete-post")?.addEventListener("click", async () => { if (window.confirm("Delete this story permanently?")) { await apiRequest(`/posts/${encodeURIComponent(slug)}`, { method: "DELETE" }); window.location.hash = "#/admin"; } });
}

async function route() {
  const root = document.querySelector("#app");
  const path = window.location.hash.replace(/^#\/?/, "");
  if (path === "about") return renderAbout(root);
  if (path === "admin") return renderAdmin(root);
  if (path === "admin/new") return renderEditor(root);
  if (path.startsWith("admin/edit/")) return renderEditor(root, decodeURIComponent(path.slice("admin/edit/".length)));
  if (path.startsWith("post/")) return renderPost(root, decodeURIComponent(path.slice("post/".length)));
  return renderHome(root);
}

if (typeof document !== "undefined") {
  window.addEventListener("hashchange", route);
  route();
}

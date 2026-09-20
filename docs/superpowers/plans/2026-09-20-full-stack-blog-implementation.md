# Inkwell Blog Full-Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-author publishing site with a React/Vite frontend, Flask REST API, MySQL persistence, authenticated admin editor, and Jenkins/EC2 deployment assets.

**Architecture:** The browser receives static HTML/CSS/JavaScript assets from Apache. Apache proxies `/api` to a Gunicorn-hosted Flask application, which uses SQLAlchemy to persist users and posts in MySQL/RDS. A same-origin HTTP-only session cookie protects admin operations.

**Tech Stack:** Python 3.11, Flask 3, SQLAlchemy 2, pytest, HTML, CSS, browser JavaScript, Node's built-in test runner, MySQL 8-compatible RDS, Gunicorn, Apache, Jenkins.

**Spec:** `docs/superpowers/specs/2026-09-20-full-stack-blog-design.md`

## Global Constraints

- Version one is a single-author blog; public registration and multi-user administration are out of scope.
- Draft posts must never appear in unauthenticated list or detail responses.
- Passwords are stored only as one-way hashes; secrets stay in environment variables or Jenkins credentials.
- The API base prefix is `/api/v1` and must return consistent JSON error envelopes.
- Markdown rendered in the browser must be sanitized before insertion into the DOM.
- The implementation follows test-driven development: each behavior starts with a focused failing test.
- The production topology is static HTML/CSS/JavaScript frontend + Apache reverse proxy + Gunicorn Flask API + private MySQL/RDS.

## Review Focus

- Unauthenticated requests must not read drafts or call write endpoints; pin this in API authorization tests (Tasks 3–4).
- Duplicate or unsafe slugs must produce deterministic validation errors rather than overwrite another post; pin this in model/service tests (Task 3).
- Malicious Markdown/HTML must be sanitized before rendering; pin this in frontend rendering tests (Task 5).
- Expired/invalid session cookies must return `401` and leave the admin UI signed out; pin this in auth/API tests (Tasks 3 and 6).
- Database outages must make `/health` fail clearly and make the Jenkins smoke test fail; pin this in health and deployment tests (Tasks 2 and 8).

---

### Task 1: Scaffold the monorepo and test harnesses

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/tests/conftest.py`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/test/setup.ts`

**Interfaces:**
- Produces `create_app(config_overrides: dict | None = None) -> Flask` for every backend test and runtime entry point.
- Produces frontend scripts `npm run test`, `npm run build`, and `npm run lint`.

- [ ] **Step 1: Write the failing backend factory test**

```python
# backend/tests/test_app_factory.py
from app import create_app

def test_factory_uses_testing_configuration():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    assert app.testing is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite://"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest backend/tests/test_app_factory.py -q`
Expected: FAIL because `app.create_app` does not exist.

- [ ] **Step 3: Implement the minimal project scaffold**

Create `backend/app/config.py` with `Config`, `TestingConfig`, and `ProductionConfig`; create `backend/app/__init__.py` with `create_app`; add `pytest` and Flask dependencies to `backend/pyproject.toml`. Add the Vite/React TypeScript package manifest and Vitest setup file.

- [ ] **Step 4: Run backend and frontend harness checks**

Run: `python -m pytest backend/tests/test_app_factory.py -q`
Expected: PASS.

Run: `npm install --prefix frontend` followed by `npm run test --prefix frontend -- --run`
Expected: PASS with the empty harness and no missing setup module.

- [ ] **Step 5: Commit**

```bash
git add README.md .gitignore backend frontend
git commit -m "chore: scaffold blog application"
```

### Task 2: Add database models, migrations, seed command, and health endpoint

**Files:**
- Create: `backend/app/extensions.py`
- Create: `backend/app/models.py`
- Create: `backend/app/health.py`
- Create: `backend/app/cli.py`
- Create: `backend/migrations/` (generated Alembic files)
- Create: `backend/tests/test_health.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/__init__.py`
- Modify: `backend/pyproject.toml`

**Interfaces:**
- `User` fields: `id`, `email`, `password_hash`, `display_name`, `created_at`, `updated_at`.
- `Post` fields: `id`, `title`, `slug`, `excerpt`, `content_markdown`, `category`, `cover_image_url`, `status`, `published_at`, `created_at`, `updated_at`, `author_id`.
- `GET /api/v1/health` returns `{ "data": { "status": "ok", "database": "ok" } }` or a `503` error envelope.
- CLI command `flask seed-admin --email ... --display-name ...` hashes the supplied password and creates the first admin.

- [ ] **Step 1: Write failing health tests**

```python
def test_health_reports_database_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.get_json()["data"] == {"status": "ok", "database": "ok"}
```

```python
def test_post_belongs_to_user(db_session, user):
    post = Post(title="Hello", slug="hello", content_markdown="# Hello", author_id=user.id)
    db_session.add(post)
    db_session.commit()
    assert post.author.email == user.email
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_health.py -q`
Expected: FAIL because the database extension, models, and route are missing.

- [ ] **Step 3: Implement extensions, models, migrations, and route**

Configure `SQLAlchemy()` and `Migrate()`, register them in `create_app`, create the two models with indexes/constraints, and register a health blueprint that executes `SELECT 1`. Add a test database fixture using SQLite and a CLI seed command using Werkzeug password hashing.

- [ ] **Step 4: Run the focused tests**

Run: `python -m pytest backend/tests/test_health.py -q`
Expected: PASS, including a test that a deliberately failing database connection returns `503`.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add database models and health check"
```

### Task 3: Implement authentication and post domain services

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/posts.py`
- Create: `backend/app/serializers.py`
- Create: `backend/app/errors.py`
- Create: `backend/tests/test_auth.py`
- Create: `backend/tests/test_posts_service.py`
- Modify: `backend/app/__init__.py`

**Interfaces:**
- `require_admin()` rejects missing/invalid sessions with `401`.
- `POST /api/v1/auth/login` accepts `{ "email": string, "password": string }` and sets an HTTP-only session cookie.
- `POST /api/v1/auth/logout` clears the session; `GET /api/v1/auth/me` returns the authenticated user.
- `slugify_title(title: str) -> str` returns lowercase hyphenated slugs.
- `validate_post_payload(payload: dict, existing_post: Post | None = None) -> dict` returns normalized fields or raises a typed `ValidationError`.
- `create_post(db_session, author_id: int, payload: dict) -> Post` validates the payload and rejects an already-used slug.
- `serialize_post(post: Post, include_draft: bool = False) -> dict` returns the stable API representation.

- [ ] **Step 1: Write failing auth and domain tests**

```python
def test_login_sets_http_only_session(client, user):
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "correct-password"})
    assert response.status_code == 200
    assert "session=" in response.headers["Set-Cookie"]

def test_wrong_password_is_unauthorized(client, user):
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "wrong"})
    assert response.status_code == 401
```

```python
def test_slugify_title_is_stable():
    assert slugify_title("  AWS & My First Post! ") == "aws-my-first-post"

def test_duplicate_slug_is_rejected(db_session, existing_post):
    with pytest.raises(ValidationError, match="slug"):
        create_post(db_session, existing_post.author_id, {"title": existing_post.title, "content_markdown": "new"})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_auth.py backend/tests/test_posts_service.py -q`
Expected: FAIL because auth, slug, validation, and serializer functions are missing.

- [ ] **Step 3: Implement the smallest auth/domain layer**

Use Flask’s signed server-side session mechanism with `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE="Lax"`, and production `SESSION_COOKIE_SECURE=True`. Hash and verify passwords with Werkzeug. Implement deterministic slug collision errors, required title/content validation, status validation, and JSON error handlers.

- [ ] **Step 4: Run focused tests**

Run: `python -m pytest backend/tests/test_auth.py backend/tests/test_posts_service.py -q`
Expected: PASS, including invalid credentials, malformed JSON, and duplicate slug cases.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat: add authentication and post domain rules"
```

### Task 4: Expose the complete REST API

**Files:**
- Create: `backend/app/api.py`
- Create: `backend/tests/test_posts_api.py`
- Modify: `backend/app/__init__.py`

**Interfaces:**
- `GET /api/v1/posts` supports `category`, `status` (admin only), `page`, and `per_page`.
- `GET /api/v1/posts/<slug>` hides drafts unless the session is authenticated.
- `POST /api/v1/posts`, `PUT /api/v1/posts/<slug>`, and `DELETE /api/v1/posts/<slug>` require `require_admin()`.
- Every error body is `{ "error": { "code": string, "message": string, "request_id": string } }`.

- [ ] **Step 1: Write failing endpoint tests**

```python
def test_public_list_excludes_drafts(client, published_post, draft_post):
    response = client.get("/api/v1/posts")
    assert response.status_code == 200
    assert [item["slug"] for item in response.get_json()["data"]["items"]] == [published_post.slug]

def test_anonymous_cannot_create_post(client):
    response = client.post("/api/v1/posts", json={"title": "Nope", "content_markdown": "x"})
    assert response.status_code == 401
```

```python
def test_admin_can_create_and_update_post(authenticated_client):
    create = authenticated_client.post("/api/v1/posts", json={"title": "First", "content_markdown": "# First", "status": "draft"})
    assert create.status_code == 201
    slug = create.get_json()["data"]["slug"]
    update = authenticated_client.put(f"/api/v1/posts/{slug}", json={"status": "published"})
    assert update.status_code == 200
    assert update.get_json()["data"]["status"] == "published"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest backend/tests/test_posts_api.py -q`
Expected: FAIL because the API blueprint is missing.

- [ ] **Step 3: Implement the API blueprint**

Add pagination with a maximum `per_page` of 50, public-only filtering, admin draft access, create/update/delete transactions, and consistent error handlers. Return `201` for creation, `200` for reads/updates, `204` for deletion, and `404` for missing slugs.

- [ ] **Step 4: Run backend suite**

Run: `python -m pytest backend/tests -q`
Expected: PASS with no warnings or unhandled exceptions.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api.py backend/tests/test_posts_api.py backend/app/__init__.py
git commit -m "feat: expose versioned blog posts API"
```

### Task 5: Build the public React experience

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/posts.ts`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/PostCard.tsx`
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/PostPage.tsx`
- Create: `frontend/src/pages/AboutPage.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/__tests__/public-pages.test.tsx`
- Modify: `frontend/package.json`

**Interfaces:**
- `apiRequest<T>(path: string, options?: RequestInit): Promise<T>` sends same-origin requests with `credentials: "include"` and throws `ApiError` on non-2xx responses.
- `listPosts(params?: { category?: string; page?: number }): Promise<PostListResponse>`.
- `getPost(slug: string): Promise<Post>`.
- `Post` includes `slug`, `title`, `excerpt`, `contentHtml`, `category`, `coverImageUrl`, `status`, and `publishedAt`.

- [ ] **Step 1: Write failing component tests**

```tsx
it("shows the published title and category", async () => {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText("A Quiet Guide to AWS")).toBeVisible();
  expect(screen.getByText("Cloud Notes")).toBeVisible();
});
```

```tsx
it("shows an empty state when no posts are returned", async () => {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  expect(await screen.findByText("No published stories yet.")).toBeVisible();
});
```

- [ ] **Step 2: Run frontend tests to verify they fail**

Run: `npm run test --prefix frontend -- --run`
Expected: FAIL because the app/pages are not implemented.

- [ ] **Step 3: Implement API client, routes, and editorial layout**

Add React Router routes for `/`, `/posts/:slug`, and `/about`. Build responsive layout/components with ivory/ink/copper tokens, accessible navigation, loading/error/empty states, and post cards. Render sanitized Markdown HTML supplied by the API or a shared sanitizer helper; do not use unsanitized `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run tests and production build**

Run: `npm run test --prefix frontend -- --run && npm run build --prefix frontend`
Expected: PASS and a generated `frontend/dist` directory.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: add public editorial frontend"
```

### Task 6: Build authentication and admin editor UI

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/AdminDashboardPage.tsx`
- Create: `frontend/src/pages/PostEditorPage.tsx`
- Create: `frontend/src/components/MarkdownPreview.tsx`
- Create: `frontend/src/__tests__/admin-pages.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- `login(email: string, password: string): Promise<CurrentUser>`.
- `logout(): Promise<void>`.
- `AuthContext` exposes `{ user: CurrentUser | null; loading: boolean; refresh(): Promise<void>; logout(): Promise<void> }`.
- `savePost(input: PostDraft, slug?: string): Promise<Post>` and `deletePost(slug: string): Promise<void>`.

- [ ] **Step 1: Write failing admin tests**

```tsx
it("redirects anonymous users to login", async () => {
  render(<MemoryRouter initialEntries={["/admin"]}><App /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Sign in to Inkwell" })).toBeVisible();
});
```

```tsx
it("previews Markdown and submits a draft", async () => {
  render(<MemoryRouter><PostEditorPage /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText("Title"), "My story");
  await userEvent.type(screen.getByLabelText("Body"), "# Hello");
  expect(screen.getByRole("heading", { name: "Hello" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --prefix frontend -- --run`
Expected: FAIL because auth context, protected routes, and editor components are missing.

- [ ] **Step 3: Implement auth state, protected routes, dashboard, and editor**

Use same-origin cookie requests. Provide clear field validation, save/publish controls, draft list, delete confirmation, and sanitized live preview. Make the editor usable on narrow screens and preserve unsaved form state while previewing.

- [ ] **Step 4: Run frontend suite and build**

Run: `npm run test --prefix frontend -- --run && npm run build --prefix frontend`
Expected: PASS and a successful production build.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: add authenticated authoring experience"
```

### Task 7: Add local development, seed data, and application documentation

**Files:**
- Create: `backend/.env.example`
- Create: `frontend/.env.example`
- Create: `docker-compose.yml`
- Create: `scripts/verify-local.ps1`
- Create: `deploy/README.md`
- Modify: `README.md`
- Modify: `backend/app/cli.py`

**Interfaces:**
- `docker compose up db` starts a local MySQL service with the documented credentials.
- `flask db upgrade` applies migrations.
- `flask seed-admin --email owner@example.com --password-from-stdin` creates the author account.
- README documents exact local commands for backend tests, frontend tests/build, and concurrent development.

- [ ] **Step 1: Write the local setup verification script/test**

```powershell
# scripts/verify-local.ps1
python -m pytest backend/tests -q
npm run test --prefix frontend -- --run
npm run build --prefix frontend
```

- [ ] **Step 2: Run it before documentation changes**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-local.ps1`
Expected: PASS using the SQLite test configuration and frontend test harness.

- [ ] **Step 3: Add local MySQL compose and docs**

Document environment variables (`DATABASE_URL`, `SECRET_KEY`, `SESSION_COOKIE_SECURE`, `VITE_API_BASE_URL`), migration/seed commands, API examples, and the distinction between local SQLite tests and production MySQL. Add `.env` patterns to `.gitignore`.

- [ ] **Step 4: Verify docs commands**

Run the commands exactly as shown in `README.md` from a clean shell. Expected: each command either succeeds or clearly explains the required prerequisite.

- [ ] **Step 5: Commit**

```bash
git add README.md .gitignore backend/.env.example frontend/.env.example docker-compose.yml deploy scripts
git commit -m "docs: document local development and data seeding"
```

### Task 8: Add EC2 deployment assets and Jenkins pipeline

**Files:**
- Create: `deploy/inkwell-api.service`
- Create: `deploy/apache-inkwell.conf`
- Create: `deploy/deploy.sh`
- Create: `deploy/smoke-test.sh`
- Create: `deploy/tests.sh`
- Create: `Jenkinsfile`
- Modify: `README.md`

**Interfaces:**
- `deploy.sh <release.tar.gz>` extracts the release to `/opt/inkwell/releases/<timestamp>`, updates `/opt/inkwell/current`, installs backend dependencies, and restarts `inkwell-api.service`.
- `smoke-test.sh <base-url>` exits non-zero unless `/api/v1/health` returns HTTP `200` and `database` is `ok`.
- Jenkins parameters: `DEPLOY_PRODUCTION` (boolean) and `RUN_DB_MIGRATIONS` (boolean).

- [ ] **Step 1: Write shell-level deployment tests**

```bash
#!/usr/bin/env bash
set -euo pipefail

grep -q "ProxyPass /api http://127.0.0.1:8000/api" deploy/apache-inkwell.conf
! ./deploy/smoke-test.sh "http://127.0.0.1:9"
echo "deployment asset tests passed"
```

```bash
test_apache_config_proxies_api() {
  grep -q "ProxyPass /api http://127.0.0.1:8000/api" deploy/apache-inkwell.conf
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bash deploy/tests.sh`
Expected: FAIL because the service/config/scripts do not exist.

- [ ] **Step 3: Implement service, Apache config, deployment script, and Jenkins stages**

Gunicorn binds only to `127.0.0.1:8000`. Apache serves the versioned `frontend/dist`, proxies `/api`, and sets the production document root. Jenkins runs backend tests, frontend tests/build, creates a release archive, uploads it with the configured SSH credential, optionally runs migrations, restarts the service, and calls the smoke test. Do not put secrets in the Jenkinsfile; reference Jenkins credential IDs supplied by the operator.

- [ ] **Step 4: Run deployment checks**

Run: `bash deploy/tests.sh` and `shellcheck deploy/*.sh` where available.
Expected: PASS; the smoke script must fail for an unreachable host and pass against a healthy local/staging endpoint.

- [ ] **Step 5: Commit**

```bash
git add Jenkinsfile deploy README.md
git commit -m "ci: add EC2 and Jenkins deployment pipeline"
```

### Task 9: Run the full verification and prepare handoff

**Files:**
- Modify: `README.md` only if verification exposes inaccurate commands.
- Create: `docs/verification/2026-09-20-initial-verification.md`

- [ ] **Step 1: Run the complete backend suite**

Run: `python -m pytest backend/tests -q`
Expected: all tests pass with no unhandled warnings.

- [ ] **Step 2: Run the complete frontend suite and build**

Run: `npm run test --prefix frontend -- --run && npm run build --prefix frontend`
Expected: all tests pass and `frontend/dist` is generated.

- [ ] **Step 3: Run deployment/static checks**

Run: `bash deploy/tests.sh` and inspect `git diff --check`.
Expected: deployment checks pass and no whitespace errors are reported.

- [ ] **Step 4: Record evidence and known operator steps**

Record commands and outputs in `docs/verification/2026-09-20-initial-verification.md`, including the steps still requiring AWS-side values: RDS endpoint, Jenkins credential IDs, EC2 host, DNS/HTTPS, and Apache installation.

- [ ] **Step 5: Commit the verification record**

```bash
git add docs/verification README.md
git commit -m "test: record initial full-stack verification"
```

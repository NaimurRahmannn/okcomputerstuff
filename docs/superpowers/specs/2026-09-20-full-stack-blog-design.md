# Inkwell Blog — Full-Stack Blog Design

## Goal

Build a lightweight personal publishing site for a single author. Visitors can browse published articles, while the author can sign in and create, edit, preview, publish, unpublish, and delete posts. The project is intended as a learning deployment for the existing AWS Terraform/Jenkins setup.

The existing `devops-project-1-main` repository is a separate repository and is out of scope. This project owns its application code and deployment documentation.

## Success criteria

- A visitor can open the site, browse published posts, filter by category, and read an individual article.
- The author can authenticate and manage drafts and published posts from an admin area.
- The frontend and backend are independently testable and can run locally with documented commands.
- The API persists data in MySQL-compatible RDS.
- Jenkins can run tests, build the frontend, package the backend, and deploy the application to EC2.
- Secrets are supplied through environment variables or Jenkins credentials; none are committed to source control.

## Recommended approach

Use a small monorepo with a framework-free HTML/CSS/JavaScript frontend, a Flask REST API, and SQLAlchemy-backed MySQL persistence. Build the frontend as static assets served by Apache. Run the Flask API with Gunicorn behind the same web server, proxying `/api` requests to the backend. This keeps the deployment topology close to the user's existing EC2, Apache, RDS, and Jenkins setup while retaining a polished browser experience.

Alternatives considered:

1. Server-rendered Flask templates: simplest deployment, but less useful for learning a modern full-stack split and less flexible for a rich editor.
2. React + Node/Express: a valid SPA stack, but adds a second JavaScript runtime to the EC2 deployment when Flask/Python already aligns with the existing project context.
3. Vanilla HTML/CSS/JavaScript + Flask + RDS (selected): a clear frontend/API/database boundary, no frontend framework runtime, and a natural path for future mobile or alternate clients.

## User-facing experience

### Public pages

- Home: featured article, latest posts, category links, and author introduction.
- Article: title, category, publication date, reading content rendered from Markdown, and navigation to other posts.
- Category/listing: filtered published posts with empty and loading states.
- About: short author profile and site context.

The visual language is editorial and restrained: warm ivory surface, deep ink typography, muted copper accent, serif display headings, sans-serif interface text, generous whitespace, subtle borders, and responsive layouts. The UI should favor readable content over decorative widgets.

### Admin pages

- Login: email/username and password with clear error feedback.
- Dashboard: published/draft counts and a table or cards of the author's posts.
- Editor: title, excerpt, category, cover image URL, Markdown body, draft/published status, live preview, save, and delete controls.

Version one is single-author. There is no public registration, multi-user role model, comments, image upload service, or social integration.

## API contract

Base prefix: `/api/v1`.

### Authentication

- `POST /auth/login` — validate credentials and issue an HTTP-only authenticated session cookie.
- `POST /auth/logout` — clear the session.
- `GET /auth/me` — return the current author or `401`.

Cookie-based auth is appropriate because the frontend and API share one site origin in production. Passwords are stored as one-way hashes. Session and cookie settings are configurable for local development versus HTTPS production.

### Posts

- `GET /posts` — list published posts for visitors; authenticated requests may request drafts.
- `GET /posts/{slug}` — return one published post, or an author's draft when authenticated.
- `POST /posts` — create a draft or published post; admin only.
- `PUT /posts/{slug}` — update post fields or publication state; admin only.
- `DELETE /posts/{slug}` — delete a post; admin only.

List responses support a small set of query parameters: `category`, `status` (admin only), `page`, and `per_page`. Responses use consistent JSON envelopes for data and errors. Invalid input returns `400`, missing authentication returns `401`, insufficient permission returns `403`, missing resources return `404`, and unexpected failures return `500` with a request identifier in logs.

### Health

- `GET /health` — return application status and a database connectivity check suitable for deployment smoke tests.

## Data model

### `users`

- `id` (integer primary key)
- `email` (unique, indexed)
- `password_hash`
- `display_name`
- `created_at`, `updated_at`

### `posts`

- `id` (integer primary key)
- `title`
- `slug` (unique, indexed)
- `excerpt`
- `content_markdown`
- `category`
- `cover_image_url` (nullable)
- `status` (`draft` or `published`)
- `published_at` (nullable)
- `created_at`, `updated_at`
- `author_id` (foreign key to `users.id`)

The first migration creates these tables and a seed command creates the initial admin account from environment variables. Slugs are generated from titles but remain editable only through controlled update logic so URLs remain predictable.

## Repository structure

```text
inkwell-blog/
  frontend/       # React/Vite app, public pages, admin UI
  backend/        # Flask app, API routes, models, migrations
  deploy/         # systemd and web-server templates, deployment notes
  docs/           # architecture and operating documentation
  Jenkinsfile
  README.md
```

The frontend owns API client helpers and presentation in small browser modules. The backend owns validation, authentication, persistence, and serialization. Neither layer reaches into the other's internal files.

## Data flow

1. A browser requests the site from Apache.
2. Apache serves built frontend assets and forwards `/api/*` to Gunicorn.
3. Flask authenticates the request when required, validates payloads, and calls SQLAlchemy repositories/models.
4. SQLAlchemy connects to RDS using environment-provided credentials.
5. The API returns a stable JSON response; the frontend updates the page or displays a concise error state.

Draft content is never included in unauthenticated list or detail responses. Markdown is rendered in the frontend with HTML sanitization enabled before insertion into the DOM.

## Deployment design

Jenkins stages:

1. Checkout the blog repository.
2. Install backend dependencies and run Python tests.
3. Install frontend dependencies and run frontend tests/build.
4. Package the backend and frontend build output.
5. Copy the release to EC2 and restart the Gunicorn systemd service.
6. Run `GET /health` as a smoke test and fail the build if it is unhealthy.

Apache serves `frontend/dist` and reverse-proxies `/api` to a localhost Gunicorn port. The EC2 host receives only the release artifact and environment configuration. RDS remains private inside the VPC. Jenkins credentials provide SSH access and application secrets; `.env` files are ignored locally and never packaged.

## Error handling and security baseline

- Validate all write payloads on the server; never trust frontend validation alone.
- Hash passwords with a modern password-hashing library.
- Use HTTP-only, SameSite cookies; enable `Secure` when HTTPS is active.
- Enforce a maximum post-body size and reasonable pagination limits.
- Sanitize Markdown output to prevent stored XSS.
- Keep database credentials, session secrets, and admin seed values outside source control.
- Log structured errors server-side without logging passwords, cookies, or full post bodies.

## Testing strategy

- Backend unit tests for slug generation, validation, authentication, authorization, and serialization.
- Backend integration tests against a temporary test database or isolated MySQL schema for CRUD and health behavior.
- Frontend tests for public post rendering, login state, editor validation, and API error states.
- A deployment smoke test for `/health` and a published-post read after deployment.

The implementation will follow test-driven development for new behavior: write a focused failing test, implement the smallest change, then refactor while keeping the suite green.

## Explicit non-goals for version one

- Multi-author accounts and role administration.
- Comments, likes, newsletters, and social sharing integrations.
- Image uploads or a media processing pipeline.
- Full-text search infrastructure; initial search/filtering can remain client-side or use simple category/query filtering.
- Kubernetes, containers, or autoscaling. These can be introduced after the single-EC2 deployment is understood.

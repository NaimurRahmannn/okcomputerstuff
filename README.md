# okcomputerstuff

okcomputerstuff is a lightweight full-stack personal blog. It gives visitors a polished editorial reading experience and gives the author a private studio for writing Markdown posts, saving drafts, publishing stories, and managing the journal.

## Stack

- `frontend/` — framework-free HTML, CSS, and browser JavaScript.
- `backend/` — Flask REST API with SQLAlchemy and MySQL-compatible persistence.
- `docs/` — design and implementation documents.

The frontend uses same-origin `/api/v1` requests. It has no framework or frontend runtime dependency.

## Local setup

The project uses the local `.venv` for Python commands. On a normal Python installation, create it with `python -m venv .venv` and install the requirements with `.venv\\Scripts\\python.exe -m pip install -r backend/requirements.txt` (Windows) or `.venv/bin/python -m pip install -r backend/requirements.txt` (macOS/Linux).

This workspace's managed Python image does not ship a writable `ensurepip`; its `.venv` is created with `--without-pip --system-site-packages` and uses the preinstalled Flask, SQLAlchemy, and pytest packages.

### Start a local MySQL database (optional)

```bash
docker compose up -d db
```

Set `DATABASE_URL=mysql+pymysql://blog_user:change-me@127.0.0.1:3307/okcomputerstuff` and the admin variables from `backend/.env.example` in your shell.

### Initialize and run the API

```powershell
$env:PYTHONPATH = "backend"
$env:DATABASE_URL = "sqlite:///okcomputerstuff.db"  # use the MySQL URL when Docker/RDS is ready
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "change-me-now"
.\.venv\Scripts\python.exe -m flask --app backend.run init-db
.\.venv\Scripts\python.exe -m flask --app backend.run seed-admin
.\.venv\Scripts\python.exe -m flask --app backend.run run --debug
```

The API is available at `http://127.0.0.1:5000/api/v1/health`.

### Open the frontend

Serve the static frontend from the project root so browser requests and history navigation work consistently:

```powershell
python -m http.server 4173 --directory frontend
```

Open `http://127.0.0.1:4173`. The frontend automatically targets the local API on port 5050 and Flask allows only the two documented localhost origins for this development flow. Production uses same-origin `/api` requests behind Apache.

## API examples

```bash
curl http://127.0.0.1:5000/api/v1/posts
curl http://127.0.0.1:5000/api/v1/health
```

Admin writes use the session cookie returned by `/api/v1/auth/login`.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm test --prefix frontend
npm run build --prefix frontend
```

Deployment files for Jenkins/EC2 are intentionally deferred until the local project is accepted and the AWS-specific values are ready.

from app.models import Post, User


def make_user(db_session):
    user = User(email="owner@example.com", display_name="Owner")
    user.set_password("secret")
    db_session.add(user)
    db_session.commit()
    return user


def login(client):
    return client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "secret"})


def test_public_list_excludes_drafts(client, db_session):
    user = make_user(db_session)
    db_session.add_all([
        Post(title="Published", slug="published", content_markdown="# Published", status="published", author_id=user.id),
        Post(title="Draft", slug="draft", content_markdown="# Draft", status="draft", author_id=user.id),
    ])
    db_session.commit()
    response = client.get("/api/v1/posts")
    assert response.status_code == 200
    assert [item["slug"] for item in response.get_json()["data"]["items"]] == ["published"]


def test_anonymous_cannot_create_post(client):
    response = client.post("/api/v1/posts", json={"title": "Nope", "content_markdown": "x"})
    assert response.status_code == 401


def test_admin_can_create_and_update_post(client, db_session):
    make_user(db_session)
    login(client)
    create = client.post("/api/v1/posts", json={"title": "First", "content_markdown": "# First", "status": "draft"})
    assert create.status_code == 201
    slug = create.get_json()["data"]["slug"]
    update = client.put(f"/api/v1/posts/{slug}", json={"status": "published"})
    assert update.status_code == 200
    assert update.get_json()["data"]["status"] == "published"


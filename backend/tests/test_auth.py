from app.models import User


def test_login_sets_http_only_session(client, db_session):
    user = User(email="owner@example.com", display_name="Owner")
    user.set_password("correct-password")
    db_session.add(user)
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "correct-password"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["Set-Cookie"]


def test_wrong_password_is_unauthorized(client, db_session):
    user = User(email="owner@example.com", display_name="Owner")
    user.set_password("correct-password")
    db_session.add(user)
    db_session.commit()
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "wrong"})
    assert response.status_code == 401


from app.models import User


def test_health_reports_database_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.get_json()["data"] == {"status": "ok", "database": "ok"}


def test_user_model_persists(db_session):
    user = User(email="owner@example.com", display_name="Owner")
    user.set_password("secret")
    db_session.add(user)
    db_session.commit()
    assert user.check_password("secret") is True


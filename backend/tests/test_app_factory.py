from app import create_app


def test_factory_uses_testing_configuration():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    assert app.testing is True
    assert app.config["SQLALCHEMY_DATABASE_URI"] == "sqlite://"


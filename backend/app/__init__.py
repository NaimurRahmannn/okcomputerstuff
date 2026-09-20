from flask import Flask
from flask_sqlalchemy import SQLAlchemy

from .config import Config

db = SQLAlchemy()


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)
    db.init_app(app)
    from . import models  # noqa: F401 - register tables with SQLAlchemy
    from .api import api_bp
    from .auth import auth_bp
    from .health import health_bp
    app.register_blueprint(api_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(health_bp, url_prefix="/api/v1")

    @app.cli.command("init-db")
    def init_db():
        with app.app_context():
            db.create_all()
        print("Database tables ready.")

    @app.cli.command("seed-admin")
    def seed_admin():
        import os
        from .models import User
        email = os.getenv("ADMIN_EMAIL")
        password = os.getenv("ADMIN_PASSWORD")
        display_name = os.getenv("ADMIN_DISPLAY_NAME", "Inkwell author")
        if not email or not password:
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be set")
        with app.app_context():
            if db.session.scalar(db.select(User).where(User.email == email.lower())):
                print("Admin already exists.")
                return
            user = User(email=email.lower(), display_name=display_name)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
        print(f"Admin created for {email.lower()}.")

    return app

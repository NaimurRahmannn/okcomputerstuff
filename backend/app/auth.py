from functools import wraps

from flask import Blueprint, jsonify, request, session

from . import db
from .errors import error_response
from .models import User
from .serializers import serialize_user

auth_bp = Blueprint("auth", __name__)


def current_user():
    user_id = session.get("user_id")
    return db.session.get(User, user_id) if user_id else None


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            return error_response("Authentication required", 401, "unauthorized")
        return view(*args, **kwargs)

    return wrapped


@auth_bp.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")
    user = db.session.scalar(db.select(User).where(User.email == email))
    if not user or not user.check_password(password):
        return error_response("Invalid email or password", 401, "invalid_credentials")
    session.clear()
    session["user_id"] = user.id
    return jsonify({"data": serialize_user(user)})


@auth_bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"data": None})


@auth_bp.get("/auth/me")
def me():
    user = current_user()
    if user is None:
        return error_response("Authentication required", 401, "unauthorized")
    return jsonify({"data": serialize_user(user)})


from flask import Blueprint, jsonify
from sqlalchemy import text

from . import db
from .errors import error_response

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"data": {"status": "ok", "database": "ok"}})
    except Exception:
        db.session.rollback()
        return error_response("Database is unavailable", 503, "database_unavailable")


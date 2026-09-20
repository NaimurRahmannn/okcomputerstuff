from uuid import uuid4

from flask import jsonify


class ValidationError(Exception):
    pass


def error_response(message, status, code="error"):
    return jsonify({"error": {"code": code, "message": message, "request_id": uuid4().hex}}), status


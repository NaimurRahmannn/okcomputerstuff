import re
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from . import db
from .auth import current_user, require_admin
from .errors import ValidationError, error_response
from .models import Post
from .serializers import serialize_post

api_bp = Blueprint("api", __name__)


def slugify_title(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:240] or "untitled"


def validate_post_payload(payload, existing_post=None):
    title = str(payload.get("title", existing_post.title if existing_post else "")).strip()
    content = str(payload.get("contentMarkdown", payload.get("content_markdown", existing_post.content_markdown if existing_post else ""))).strip()
    if not title:
        raise ValidationError("Title is required")
    if not content:
        raise ValidationError("Content is required")
    status = payload.get("status", existing_post.status if existing_post else "draft")
    if status not in {"draft", "published"}:
        raise ValidationError("Status must be draft or published")
    return {
        "title": title,
        "slug": slugify_title(str(payload.get("slug", existing_post.slug if existing_post else title))),
        "excerpt": str(payload.get("excerpt", existing_post.excerpt if existing_post else "")).strip(),
        "content_markdown": content,
        "category": str(payload.get("category", existing_post.category if existing_post else "Notes")).strip() or "Notes",
        "cover_image_url": payload.get("coverImageUrl", payload.get("cover_image_url", existing_post.cover_image_url if existing_post else None)),
        "status": status,
    }


def create_post(payload, author_id):
    values = validate_post_payload(payload)
    if db.session.scalar(db.select(Post).where(Post.slug == values["slug"])):
        raise ValidationError("Slug is already in use")
    if values["status"] == "published":
        values["published_at"] = datetime.now(timezone.utc)
    post = Post(author_id=author_id, **values)
    db.session.add(post)
    return post


def post_query(include_drafts=False):
    query = db.select(Post).order_by(Post.published_at.desc().nullslast(), Post.created_at.desc())
    if not include_drafts:
        query = query.where(Post.status == "published")
    category = request.args.get("category")
    if category:
        query = query.where(Post.category == category)
    return query


@api_bp.get("/posts")
def list_posts():
    include_drafts = current_user() is not None and request.args.get("status") == "all"
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 12, type=int), 1), 50)
    posts = db.paginate(post_query(include_drafts), page=page, per_page=per_page, error_out=False)
    return jsonify({"data": {"items": [serialize_post(p, include_drafts) for p in posts.items], "page": page, "perPage": per_page, "total": posts.total}})


@api_bp.get("/posts/<slug>")
def get_post(slug):
    post = db.session.scalar(db.select(Post).where(Post.slug == slug))
    if post is None or (post.status == "draft" and current_user() is None):
        return error_response("Post not found", 404, "not_found")
    return jsonify({"data": serialize_post(post, include_draft=current_user() is not None)})


@api_bp.post("/posts")
@require_admin
def add_post():
    try:
        post = create_post(request.get_json(silent=True) or {}, current_user().id)
        db.session.commit()
        return jsonify({"data": serialize_post(post, True)}), 201
    except ValidationError as exc:
        db.session.rollback()
        return error_response(str(exc), 400, "validation_error")
    except IntegrityError:
        db.session.rollback()
        return error_response("Slug is already in use", 400, "duplicate_slug")


@api_bp.put("/posts/<slug>")
@require_admin
def update_post(slug):
    post = db.session.scalar(db.select(Post).where(Post.slug == slug))
    if post is None:
        return error_response("Post not found", 404, "not_found")
    try:
        values = validate_post_payload(request.get_json(silent=True) or {}, post)
        for key, value in values.items():
            setattr(post, key, value)
        if post.status == "published" and post.published_at is None:
            post.published_at = datetime.now(timezone.utc)
        if post.status == "draft":
            post.published_at = None
        db.session.commit()
        return jsonify({"data": serialize_post(post, True)})
    except ValidationError as exc:
        db.session.rollback()
        return error_response(str(exc), 400, "validation_error")


@api_bp.delete("/posts/<slug>")
@require_admin
def delete_post(slug):
    post = db.session.scalar(db.select(Post).where(Post.slug == slug))
    if post is None:
        return error_response("Post not found", 404, "not_found")
    db.session.delete(post)
    db.session.commit()
    return ("", 204)


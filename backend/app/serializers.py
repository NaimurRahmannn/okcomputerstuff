def serialize_user(user):
    return {"id": user.id, "email": user.email, "displayName": user.display_name}


def serialize_post(post, include_draft=False):
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "excerpt": post.excerpt,
        "contentMarkdown": post.content_markdown if include_draft or post.status == "published" else None,
        "category": post.category,
        "coverImageUrl": post.cover_image_url,
        "status": post.status,
        "publishedAt": post.published_at.isoformat() if post.published_at else None,
        "createdAt": post.created_at.isoformat() if post.created_at else None,
        "updatedAt": post.updated_at.isoformat() if post.updated_at else None,
    }


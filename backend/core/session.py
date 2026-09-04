import uuid
from fastapi import Request, Response

def get_or_create_user_uuid(request: Request, response: Response) -> str:
    """
    Reads the user_uuid cookie. If not present, generates a new UUID4
    and sets a persistent 1-year cookie on the response.
    """
    user_uuid = request.cookies.get("user_uuid")
    if not user_uuid:
        user_uuid = str(uuid.uuid4())
        response.set_cookie(
            key="user_uuid",
            value=user_uuid,
            max_age=60 * 60 * 24 * 365,  # 1 Year
            httponly=True,
            samesite="lax",
            secure=False  # Set to True when using HTTPS in production
        )
    return user_uuid
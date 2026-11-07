import os
import secrets
from ragcore.logging_utils import request_state

from fastapi import Header, HTTPException




def verify_service_key(
    x_internal_service_key: str = Header(default=""),
) -> None:
    """Verify requests from trusted internal services.

    Args:
        x_internal_service_key (str): Supplied internal service credential.

    Returns:
        None: When the credential is valid.

    Raises:
        HTTPException: When the credential is missing or invalid.
    """
    expected = os.environ["RAG_SECRET_KEY"]

    if not x_internal_service_key or not secrets.compare_digest(
        x_internal_service_key, expected
    ):
        state = request_state.get()
        if state is not None:
            state.error_code = "service_auth_failed"
        raise HTTPException(status_code=401, detail="Unauthorized service")

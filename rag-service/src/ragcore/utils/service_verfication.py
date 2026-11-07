import os
import secrets
import logging

from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


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
        logger.warning("RAG SERVICE AUTH FAILED")
        raise HTTPException(status_code=401, detail="Unauthorized service")

    logger.info("RAG SERVICE AUTH SUCCESS")
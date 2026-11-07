import secrets
from fastapi import Header, HTTPException
import os 
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



def verify_service_key(x_internal_service_key: str = Header(default="")):
    """Verify the internal service credential.
    Args:
        x_internal_service_key (str): Credential provided by the caller.
    Returns:
        None: If the credential is valid.
    """

    expected = os.environ["AGENT_SECRET_KEY"]

    if not x_internal_service_key:
        logger.warning("SERVICE AUTH FAILED: Missing internal key")
        raise HTTPException(status_code=401, detail="Unauthorized service")

    if not secrets.compare_digest(x_internal_service_key, expected):
        logger.warning("SERVICE AUTH FAILED: Invalid internal key")
        raise HTTPException(status_code=401, detail="Unauthorized service")

    logger.info("SERVICE AUTH SUCCESS: Internal request authorized")
    
import os

from dotenv import load_dotenv
from ibm_cloud_sdk_core import IAMTokenManager

load_dotenv()

IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY")
if not IBM_CLOUD_API_KEY:
    raise ValueError("IBM_CLOUD_API_KEY environment variable is not set")

IBM_CLOUD_API_URL = os.getenv("IBM_CLOUD_API_URL")
if not IBM_CLOUD_API_URL:
    raise ValueError("IBM_CLOUD_API_URL environment variable is not set")

# Created once and shared. It caches the IAM token and fetches a new one when it
# expires, but only when get_token() is called, so never store the token itself.
token_manager = IAMTokenManager(apikey=IBM_CLOUD_API_KEY)


def ibm_headers() -> dict[str, str]:
    """Headers for an IBM Cloud request. Call this for every request so the token is always current."""
    return {
        "Authorization": f"Bearer {token_manager.get_token()}",
        "Content-Type": "application/json",
    }

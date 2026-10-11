
from agentcore.config import Configs
from urllib.parse import urlparse
from ollama import AsyncClient, ResponseError
from agentcore.tools.tools import (
    available_tools,
    tools_registery,
)

client = AsyncClient(
    headers={
        "Authorization": f"Bearer {Configs.OLLAMA_API_KEY}"
    }
)


async def webFetch(url: str) -> str:
    """Read the content of a public web page.

    Use this tool when you need detailed information
    from a URL returned by webSearch.

    Args:
        url: The full HTTPS URL of the web page.

    Returns:
        Page title, source URL, and page content.
    """

    parsed = urlparse(url)

    if parsed.scheme != "https" or not parsed.hostname:
        return "Invalid URL. Provide a public HTTPS URL."

    try:
        response = await client.web_fetch(url=url)

        content = response.content or ""

        return (
            f"Title: {response.title or 'Unknown'}\n"
            f"Source: {url}\n\n"
            f"Content:\n{content[:6000]}"
        )

    except ResponseError as e:
        return (
            f"Web fetch failed. HTTP status: {e.status_code}"
        )

    except Exception as e:
        print(f"Web fetch error: {e}")
        return "Web fetch failed."


available_tools.append(webFetch)

tools_registery[webFetch.__name__] = webFetch

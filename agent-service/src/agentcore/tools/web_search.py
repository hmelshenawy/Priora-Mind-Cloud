
import os
from ollama import AsyncClient
from agentcore.config import Configs

from agentcore.tools.tools import (
    available_tools,
    tools_registery,
)


client = AsyncClient(
    headers={
        "Authorization": f"Bearer {Configs.OLLAMA_API_KEY}"
    }
)


async def webSearch(query: str, max_results: int = 5) -> str:
    """Search the internet for up-to-date information.

    Use this tool to research current facts, travel
    destinations, attractions, weather conditions,
    technology, news, and other external information.

    Args:
        query: Specific web search query.
        max_results: Maximum number of results, default 5.

    Returns:
        Search results containing titles, URLs,
        and content snippets.
    """

    try:
        response = await client.web_search(
            query=query,
            max_results=max(1, min(max_results, 10))
        )

        if not response.results:
            return "No search results found."

        results = []

        for result in response.results:
            results.append(
                f"Title: {result.title}\n"
                f"URL: {result.url}\n"
                f"Content: {result.content[:1200]}"
            )

        return "\n\n".join(results)

    except Exception as e:
        return f"Web search failed: {type(e).__name__}"
        

available_tools.append(webSearch)

tools_registery[webSearch.__name__] = webSearch

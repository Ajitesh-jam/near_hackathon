from langchain_core.tools import tool
import requests

@tool
def web_search(query: str) -> str:
    """
    Search the web for recent information and return concise result snippets.
    
    Args:
        query (str): The search query or question.
    
    Returns:
        str: Summary of top relevant results.
    """
    # For demonstration, use DuckDuckGo instant answer API (public, no key needed, but limited)
    url = "https://api.duckduckgo.com"
    params = {
        "q": query,
        "format": "json",
        "no_redirect": 1,
        "no_html": 1,
        "skip_disambig": 1
    }
    try:
        resp = requests.get(url, params=params, timeout=6)
        if resp.status_code != 200:
            return f"Web search failed with status code {resp.status_code}."
        data = resp.json()
        abstract = data.get("AbstractText") or data.get("Answer") or ""
        related = data.get("RelatedTopics", [])
        snippet = ""
        if abstract:
            snippet = abstract
        elif related and isinstance(related, list):
            # Take top related topic text
            first_topic = related[0]
            if isinstance(first_topic, dict) and first_topic.get("Text"):
                snippet = first_topic["Text"]
            else:
                snippet = str(first_topic)
        else:
            snippet = "No relevant answer found."
        return snippet[:500]
    except Exception as e:
        return f"Error during web search: {str(e)}"

@tool 
def write_in_file(file_path: str, content: str) -> str:
    """
    Write the given content to a file at the specified path.
    
    Args:
        file_path (str): The path to the file to write.
        content (str): The content to write to the file.
    """
    with open(file_path, 'w') as f:
        f.write(content)
    return f"File {file_path} written successfully."

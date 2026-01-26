from langchain_google_genai import ChatGoogleGenerativeAI
from utils.tools import web_search, write_in_file
from dotenv import load_dotenv 
from utils.prompts import gemini_prompt


load_dotenv()

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)


# Using a simpler structure to avoid 'create_tool_calling_agent' import issues
tools = [ web_search, write_in_file]
llm_with_tools = llm.bind_tools(tools)

def run_agent(user_input, max_iterations=3):
    """
    Runs the agent LLM for payment workflow, allowing for multiple sequential tool (pay) calls.
    If at any step the agent chooses to end the conversation (not call a tool), returns the final answer.
    """
    try:
        pass
        messages = [
            gemini_prompt
           
        ]
    
    except Exception as e:
        print(f"Error: {e}")
        return {
            "text": f"Agent Error: {str(e)}",
            "auto_fill": None
        }
import streamlit as st
import requests
import json
from typing import Dict, Any

# Page config
st.set_page_config(page_title="Agent Forge", layout="wide")

# API base URL
API_BASE = "http://localhost:8080"

# Session state management
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "selected_tools" not in st.session_state:
    st.session_state.selected_tools = []
if "agent_config" not in st.session_state:
    st.session_state.agent_config = {"user_id": "default_user"}
if "current_step" not in st.session_state:
    st.session_state.current_step = "start"
if "generated_tools" not in st.session_state:
    st.session_state.generated_tools = []
if "agents" not in st.session_state:
    st.session_state.agents = []

def call_api(endpoint: str, method: str = "GET", data: Dict = None) -> Dict:
    """Helper function to call API"""
    try:
        url = f"{API_BASE}{endpoint}"
        if method == "GET":
            response = requests.get(url, params=data)
        elif method == "POST":
            response = requests.post(url, json=data)
        elif method == "DELETE":
            response = requests.delete(url, params=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"API Error: {response.status_code} - {response.text}")
            return {}
    except Exception as e:
        st.error(f"Connection error: {str(e)}")
        return {}

def main():
    st.title("🤖 Agent Forge - NEAR Agent Builder")
    st.markdown("Build, deploy, and manage NEAR agents with AI-powered tool generation")
    
    # Sidebar for agent management
    with st.sidebar:
        st.header("Agent Management")
        user_id = st.text_input("User ID", value=st.session_state.agent_config.get("user_id", "default_user"))
        st.session_state.agent_config["user_id"] = user_id
        
        if st.button("Refresh Agents"):
            agents_data = call_api("/agents/list", "GET", {"user_id": user_id})
            st.session_state.agents = agents_data.get("agents", [])
        
        st.subheader("Your Agents")
        for agent in st.session_state.agents:
            with st.expander(f"Agent: {agent.get('agent_id', 'Unknown')}"):
                st.write(f"Tools: {len(agent.get('tools', []))}")
                st.write(f"Path: {agent.get('path', 'N/A')}")
                if st.button(f"Delete {agent.get('agent_id')}", key=f"delete_{agent.get('agent_id')}"):
                    call_api(f"/agents/{agent.get('agent_id')}", "DELETE", {"user_id": user_id})
                    st.rerun()
    
    # Main content area
    tab1, tab2, tab3 = st.tabs(["Chat & Create", "Tool Selection", "Agent Preview"])
    
    with tab1:
        st.header("Chat Interface - Describe Your Agent")
        
        # Chat history
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.write(message["content"])
        
        # User input
        user_message = st.chat_input("Describe what you want your agent to do...")
        
        if user_message:
            # Add user message to history
            st.session_state.chat_history.append({"role": "user", "content": user_message})
            
            # Call LangGraph forge workflow
            with st.spinner("Processing with LangGraph..."):
                result = call_api("/forge/process", "POST", {
                    "user_message": user_message,
                    "user_id": st.session_state.agent_config["user_id"]
                })
            
            if result:
                st.session_state.selected_tools = result.get("selected_tools", [])
                st.session_state.generated_tools = result.get("generated_tools", [])
                st.session_state.current_step = result.get("current_step", "completed")
                agent_id = result.get("agent_id", "")
                
                # Add assistant response
                response_text = f"Agent created! ID: {agent_id}\n\n"
                response_text += f"Selected {len(st.session_state.selected_tools)} platform tools\n"
                if st.session_state.generated_tools:
                    response_text += f"Generated {len(st.session_state.generated_tools)} custom tools\n"
                
                st.session_state.chat_history.append({"role": "assistant", "content": response_text})
                st.rerun()
    
    with tab2:
        st.header("Tool Selection & Configuration")
        
        # Get available tools
        tools_data = call_api("/tools/list", "GET", {"user_id": st.session_state.agent_config["user_id"]})
        
        tools_list = tools_data.get("tools", [])
        
        # Separate tools by type based on description
        active_tools = [t for t in tools_list if "ACTIVE" in t.get("description", "").upper()]
        reactive_tools = [t for t in tools_list if "REACTIVE" in t.get("description", "").upper()]
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("ACTIVE Tools (Monitoring)")
            for tool in active_tools:
                tool_name = tool.get("name", "")
                tool_desc = tool.get("description", "")
                selected = tool_name in [t.get("name") for t in st.session_state.selected_tools]
                
                if st.checkbox(f"{tool_name}", value=selected, key=f"active_{tool_name}"):
                    if not selected:
                        st.session_state.selected_tools.append(tool)
                else:
                    st.session_state.selected_tools = [t for t in st.session_state.selected_tools if t.get("name") != tool_name]
                
                if tool_desc:
                    st.caption(tool_desc)
        
        with col2:
            st.subheader("REACTIVE Tools (On-Demand)")
            for tool in reactive_tools:
                tool_name = tool.get("name", "")
                tool_desc = tool.get("description", "")
                selected = tool_name in [t.get("name") for t in st.session_state.selected_tools]
                
                if st.checkbox(f"{tool_name}", value=selected, key=f"reactive_{tool_name}"):
                    if not selected:
                        st.session_state.selected_tools.append(tool)
                else:
                    st.session_state.selected_tools = [t for t in st.session_state.selected_tools if t.get("name") != tool_name]
                
                if tool_desc:
                    st.caption(tool_desc)
        
        # Custom tool generation
        st.subheader("Generate Custom Tool")
        custom_requirements = st.text_area("Describe the custom tool you need:")
        if st.button("Generate Tool"):
            if custom_requirements:
                with st.spinner("Generating custom tool..."):
                    result = call_api("/tools/generate", "POST", {
                        "requirements": custom_requirements,
                        "existing_tools": st.session_state.selected_tools
                    })
                    if result and result.get("tools"):
                        st.session_state.generated_tools.extend(result["tools"])
                        st.success(f"Generated {len(result['tools'])} custom tool(s)")
                        st.code(result["tools"][0].get("code", ""), language="python")
        
        # Show generated tools
        if st.session_state.generated_tools:
            st.subheader("AI-Generated Tools")
            for tool in st.session_state.generated_tools:
                with st.expander(f"Generated: {tool.get('name', 'Unknown')}"):
                    st.code(tool.get("code", ""), language="python")
    
    with tab3:
        st.header("Agent Preview & Generation")
        
        if st.session_state.selected_tools or st.session_state.generated_tools:
            st.subheader("Selected Tools")
            st.write(f"Platform Tools: {len(st.session_state.selected_tools)}")
            st.write(f"Generated Tools: {len(st.session_state.generated_tools)}")
            
            # Generate logic
            if st.button("Generate Logic"):
                user_intent = st.session_state.chat_history[-1]["content"] if st.session_state.chat_history else ""
                all_tools = st.session_state.selected_tools + st.session_state.generated_tools
                
                with st.spinner("Generating logic.py..."):
                    result = call_api("/logic/generate", "POST", {
                        "selected_tools": all_tools,
                        "user_intent": user_intent,
                        "agent_config": st.session_state.agent_config
                    })
                    
                    if result and result.get("logic_code"):
                        st.code(result["logic_code"], language="python")
                        st.session_state.agent_config["logic_code"] = result["logic_code"]
            
            # Create agent
            agent_name = st.text_input("Agent Name", value=f"agent_{len(st.session_state.agents) + 1}")
            
            if st.button("Create Agent"):
                all_tools = st.session_state.selected_tools + st.session_state.generated_tools
                logic_code = st.session_state.agent_config.get("logic_code", "")
                
                with st.spinner("Creating agent..."):
                    result = call_api("/agents", "POST", {
                        "user_id": st.session_state.agent_config["user_id"],
                        "agent_id": agent_name,
                        "selected_tools": all_tools,
                        "config": st.session_state.agent_config
                    })
                    
                    if result and result.get("agent_id"):
                        st.success(f"Agent created: {result['agent_id']}")
                        st.info(f"Path: {result.get('path', 'N/A')}")
                        st.rerun()
        else:
            st.info("Select tools first to create an agent")

if __name__ == "__main__":
    main()

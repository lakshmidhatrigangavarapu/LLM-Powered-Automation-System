from google.genai import types


# ANSI color codes for terminal output
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"

    # Foreground colors
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    # Background colors
    BG_BLACK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_CYAN = "\033[46m"
    BG_WHITE = "\033[47m"


async def display_state(session_service, app_name, user_id, session_id, label="Current State"):
    """Display the current session state in a formatted way for GitHub Agent."""
    try:
        session = await session_service.get_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )

        print(f"\n{'-' * 10} {label} {'-' * 10}")

        user_name = session.state.get("user_name", "Unknown")
        print(f"👤 GitHub User: {user_name}")

        print("-" * (22 + len(label)))
    except Exception as e:
        print(f"Error displaying state: {e}")


async def process_agent_response(event):
    """Process and display agent response events for GitHub Agent."""
    print(f"Event ID: {event.id}, Author: {event.author}")

    has_specific_part = False
    if event.content and event.content.parts:
        for part in event.content.parts:
            if hasattr(part, "executable_code") and part.executable_code:
                print(f"  Debug: GitHub Agent generated code:\n```python\n{part.executable_code.code}\n```")
                has_specific_part = True

            elif hasattr(part, "code_execution_result") and part.code_execution_result:
                print(f"  Debug: Code Execution Result: {part.code_execution_result.outcome} - Output:\n{part.code_execution_result.output}")
                has_specific_part = True

            elif hasattr(part, "function_call") and part.function_call:
                print(
                    f"\n{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╔══ GITHUB TOOL REQUEST {part.function_call.name} ════════════════════════════════════════{Colors.RESET}"
                )
                print(f"{Colors.GREEN}{Colors.BOLD}{part.function_call}{Colors.RESET}")
                print(
                    f"{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╚═════════════════════════════════════════════════════════════{Colors.RESET}\n"
                )
                has_specific_part = True

            elif hasattr(part, "function_response") and part.function_response:
                print(
                    f"\n{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╔══ GITHUB TOOL RESPONSE {part.function_response.name} ════════════════════════════════════════{Colors.RESET}"
                )
                print(f"{Colors.MAGENTA}{Colors.BOLD}{part.function_response}{Colors.RESET}")
                print(
                    f"{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╚═════════════════════════════════════════════════════════════{Colors.RESET}\n"
                )
                has_specific_part = True

            elif hasattr(part, "tool_response") and part.tool_response:
                print(f"  Tool Response: {part.tool_response.output}")
                has_specific_part = True

            elif hasattr(part, "text") and part.text and not part.text.isspace():
                print(f"  Text: '{part.text.strip()}'")

    final_response = None
    if event.is_final_response():
        if (
            event.content
            and event.content.parts
            and hasattr(event.content.parts[0], "text")
            and event.content.parts[0].text
        ):
            final_response = event.content.parts[0].text.strip()
            print(
                f"\n{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╔══ GITHUB AGENT RESPONSE ═════════════════════════════════════════{Colors.RESET}"
            )
            print(f"{Colors.CYAN}{Colors.BOLD}{final_response}{Colors.RESET}")
            print(
                f"{Colors.BG_BLUE}{Colors.WHITE}{Colors.BOLD}╚═════════════════════════════════════════════════════════════{Colors.RESET}\n"
            )
        else:
            print(
                f"\n{Colors.BG_RED}{Colors.WHITE}{Colors.BOLD}==> Final GitHub Agent Response: [No text content in final event]{Colors.RESET}\n"
            )

    return final_response


async def call_agent_async(runner, user_id, session_id, query):
    """Call the GitHub agent asynchronously with the user's query."""
    content = types.Content(role="user", parts=[types.Part(text=query)])
    print(f"\n{Colors.BG_GREEN}{Colors.BLACK}{Colors.BOLD}--- Running GitHub Query: {query} ---{Colors.RESET}")
    final_response_text = None

    await display_state(runner.session_service, runner.app_name, user_id, session_id, "State BEFORE processing")

    try:
        async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
            response = await process_agent_response(event)
            if response:
                final_response_text = response
    except Exception as e:
        print(f"Error during GitHub agent call: {e}")

    await display_state(runner.session_service, runner.app_name, user_id, session_id, "State AFTER processing")

    return final_response_text

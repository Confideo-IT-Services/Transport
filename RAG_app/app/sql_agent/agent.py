"""
Text-to-SQL agent using AWS Bedrock. Uses schema + execute_sql tools with role-based filtering.
"""

import re

from langchain_aws import ChatBedrockConverse
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import tool
from langchain_classic.agents import AgentExecutor, create_react_agent
from langchain_classic.agents.output_parsers.react_single_input import (
    FINAL_ANSWER_ACTION,
    ReActSingleInputOutputParser,
)

from app.config import AWS_REGION, BEDROCK_MODEL_ID
from app.sql_agent.database import execute_sql, get_schema


class ReActSQLOutputParser(ReActSingleInputOutputParser):
    """Parses ReAct output and also accepts function-call style: execute_sql_tool(query="...")."""

    def parse(self, text: str) -> AgentAction | AgentFinish:
        # Handle "Action: execute_sql_tool(query="...")" (double-quoted; content may contain ')
        m = re.search(
            r"Action\s*\d*\s*:\s*execute_sql_tool\s*\(\s*query\s*=\s*\"((?:[^\"\\]|\\.)*)\"\s*\)",
            text,
            re.DOTALL,
        )
        if m:
            query = m.group(1).replace('\\"', '"').strip()
            return AgentAction(tool="execute_sql_tool", tool_input=query, log=text)

        # Handle "Action: execute_sql_tool(query='...')" (single-quoted)
        m = re.search(
            r"Action\s*\d*\s*:\s*execute_sql_tool\s*\(\s*query\s*=\s*'((?:[^'\\]|\\.)*)'\s*\)",
            text,
            re.DOTALL,
        )
        if m:
            query = m.group(1).replace("\\'", "'").strip()
            return AgentAction(tool="execute_sql_tool", tool_input=query, log=text)

        # Handle "Action: get_schema_tool()"
        if re.search(r"Action\s*\d*\s*:\s*get_schema_tool\s*\(\s*\)", text):
            return AgentAction(tool="get_schema_tool", tool_input="", log=text)

        return super().parse(text)


REACT_PROMPT_TEMPLATE = """You are a helpful assistant that answers questions about a school database by writing and running MySQL SELECT queries.

Current user: role={role}, school_id={school_id}. For school_admin you MUST restrict results to their school by using AND school_id = %(school_id)s (or via JOIN) on tables that have school_id. Schema marks such tables with [SCOPE BY school_id].

Conversation summary so far (may be empty): {conversation_summary}

RULES:
1. You MUST follow the ReAct format exactly: each tool step must be `Thought:` then `Action:` then `Action Input:` then `Observation:`.
2. Call `get_schema_tool` first to see table and column names.
3. Use `execute_sql_tool` only with valid MySQL `SELECT` queries.
4. For school_admin, you MUST restrict results to their school by using `%(school_id)s` (in WHERE, or via JOIN + filter). Never hardcode school_id as a literal.
5. Attendance table does NOT have school_id: scope by JOINing `classes` and filtering `classes.school_id = %(school_id)s`.
6. test_results does NOT have school_id: scope by JOINing `tests` and filtering `tests.school_id = %(school_id)s` (and when joining `subjects` also filter `subjects.school_id = %(school_id)s`).
7. If user mentions a class like "1B", that is NOT a class_id. Resolve it via `classes`:
   - Most common mapping: name='1' AND section='B' for "1B".
   - If section is missing, match by name only.
   Then use that UUID in the main query.
8. For "last exam" / "recent test", use the most recent by date (ORDER BY date DESC LIMIT 1 or MAX).
9. If you need multiple rows, format as a compact Markdown table (<= 20 rows). If more, summarize the rest.
10. Return a short, clear user-facing answer. Do not return raw SQL unless asked.
11. Do NOT output `ANSWER:` or `NEW_CONVERSATION_SUMMARY:` until you are at the final step (`Final Answer:`).
12. In the final step, `Final Answer:` MUST be followed by exactly two blocks (no JSON, no fences, no extra keys/fields):
    ANSWER:
    (assistant answer text; may include Markdown tables)
    NEW_CONVERSATION_SUMMARY:
    (updated rolling summary text; keep <= 300 characters)

You have access to the following tools:
{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action (for execute_sql_tool pass a valid MySQL SELECT query as a single line or escaped string)
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer:
ANSWER:
<assistant answer text; may include Markdown tables>
NEW_CONVERSATION_SUMMARY:
<updated rolling summary text; keep <= 300 characters>

Begin!

Question: {input}
Thought:{agent_scratchpad}"""


def _make_tools(role: str, school_id: str | int | None):
    """Build tools with role and school_id bound for execute_sql. school_id can be UUID string or int."""

    @tool
    def get_schema_tool() -> str:
        """Get the database schema (tables and columns). Call this first to understand the database structure."""

        return get_schema()

    @tool
    def execute_sql_tool(query: str) -> str:
        """Execute a MySQL SELECT query and return the result. Use only SELECT. For school_admin, use %(school_id)s in your WHERE clause."""

        return execute_sql(query, params=None, role=role, school_id=school_id)

    return [get_schema_tool, execute_sql_tool]


def get_bedrock_llm():
    """Create Bedrock chat model (uses AWS credentials from env or IAM)."""

    return ChatBedrockConverse(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
        max_tokens=2000,
        temperature=0,
    )


def create_school_agent(
    role: str = "super_admin",
    school_id: str | int | None = None,
    conversation_summary: str | None = None,
):
    """
    Create the Text-to-SQL agent with role and school_id bound.
    role: "school_admin" | "super_admin"
    school_id: required when role is school_admin; can be UUID string or int.
    """

    llm = get_bedrock_llm()
    tools = _make_tools(role=role, school_id=school_id)
    prompt = PromptTemplate.from_template(REACT_PROMPT_TEMPLATE).partial(
        role=role,
        school_id=school_id if school_id is not None else "NULL (super_admin)",
        conversation_summary=conversation_summary if conversation_summary else "EMPTY",
    )
    agent = create_react_agent(llm, tools, prompt, output_parser=ReActSQLOutputParser())
    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=10,
    )
    return executor


def _parse_answer_and_summary(final_output: str) -> tuple[str, str]:
    """
    Extract:
      - ANSWER: ...
      - NEW_CONVERSATION_SUMMARY: ...
    from the agent's final output.
    """

    text = (final_output or "").strip()

    # Be tolerant to marker order and tool-parser artifacts.
    answer_match = re.search(
        r"ANSWER:\s*(.*?)(?:\n\s*NEW_CONVERSATION_SUMMARY:|\Z)",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    new_summary_match = re.search(
        r"NEW_CONVERSATION_SUMMARY:\s*(.*?)(?:\n\s*ANSWER:|\Z)",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    answer = (answer_match.group(1).strip() if answer_match else "").strip()
    new_summary = (new_summary_match.group(1).strip() if new_summary_match else "").strip()

    # If the agent produced parsing-error text, prefer dropping the corrupted summary.
    if not new_summary or "Invalid Format" in new_summary:
        new_summary = ""

    # Enforce <= 300 chars for safety (truncate after cleanup).
    if new_summary:
        new_summary = re.sub(r"\s+\\n\s+", "\n", new_summary).strip().replace('"', "").strip()
        new_summary = new_summary[:300]

    # Remove literal placeholder artifacts if the model copied them verbatim.
    def strip_placeholder_artifacts(s: str) -> str:
        if not s:
            return s
        return (
            s.replace("<your user-facing answer; may include Markdown tables>", "")
            .replace("<updated summary <= 300 characters>", "")
            .replace("<your user-facing answer; may include Markdown tables>", "")
            .replace("<updated rolling summary text; keep <= 300 characters>", "")
            .replace("<updated summary>", "")
            .replace("<your user-facing answer>", "")
            .replace("(assistant answer text; may include Markdown tables)", "")
            .replace("(updated rolling summary text; keep <= 300 characters)", "")
            .strip()
        )

    answer = strip_placeholder_artifacts(answer)
    new_summary = strip_placeholder_artifacts(new_summary)

    if answer:
        return answer, new_summary

    return text, new_summary


def run_agent(
    question: str,
    role: str = "super_admin",
    school_id: str | int | None = None,
    conversation_summary: str | None = None,
) -> dict:
    """Run the Text-to-SQL agent and return answer + updated conversation summary."""

    executor = create_school_agent(
        role=role,
        school_id=school_id,
        conversation_summary=conversation_summary,
    )
    result = executor.invoke({"input": question})
    output = result.get("output", "I couldn't produce an answer.")
    answer, new_summary = _parse_answer_and_summary(output)
    return {
        "answer": answer if answer else output,
        "new_conversation_summary": new_summary if new_summary else (conversation_summary or ""),
    }


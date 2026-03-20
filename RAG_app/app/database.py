import re
import pymysql
from app.config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

# Tables that are scoped by school_id (used for school_admin filtering).
# Tables without school_id are either global (e.g. academic_years, subjects) or linked via FKs.
SCHOOL_SCOPED_TABLES = frozenset({
    "schools", "students", "teachers", "classes", "attendance", "student_enrollments",
    "student_fees", "fee_payments", "fee_structure", "homework", "homework_submissions",
    "tests", "test_results", "test_subjects", "timetable_entries", "time_slots",
    "notifications", "notification_classes", "notification_recipients", "teacher_attendance",
    "teacher_leaves", "visitor_requests", "whatsapp_messages", "users", "registration_links",
    "id_card_templates",
})


def get_connection():
    try:
        return pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )
    except pymysql.err.OperationalError as e:
        raise Exception(f"Failed to connect to MySQL database: {e}")


def get_schema() -> str:
    """Build a schema description from INFORMATION_SCHEMA for the LLM."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s
            ORDER BY TABLE_NAME, ORDINAL_POSITION
            """,
            (DB_NAME,),
        )
        rows = cursor.fetchall()
        by_table = {}
        for table_name, column_name, data_type, is_nullable, column_key in rows:
            by_table.setdefault(table_name, []).append({
                "name": column_name,
                "type": data_type,
                "nullable": is_nullable,
                "key": column_key or "",
            })
        lines = []
        for table in sorted(by_table.keys()):
            cols = by_table[table]
            col_desc = ", ".join(
                f"{c['name']} ({c['type']})" + (" PK" if c["key"] == "PRI" else "")
                for c in cols
            )
            has_school = any(c["name"] == "school_id" for c in cols)
            scope = " [SCOPE BY school_id]" if has_school else ""
            lines.append(f"- {table}{scope}: {col_desc}")
        return "Database schema (tables and columns):\n" + "\n".join(lines)
    finally:
        conn.close()


def _sanitize_sql_input(raw: str) -> str:
    """Strip outer double-quote wrapper and parser artifacts. Never strip single quotes (SQL literals)."""
    if not raw or not isinstance(raw, str):
        return ""
    s = raw.strip()
    # Strip Markdown code fences (the model sometimes returns ```sql ... ```)
    # Be robust: remove fence markers even if they appear mid-string.
    s = re.sub(r"(?im)^\s*```[a-z0-9_-]*\s*$", "", s).strip()
    s = s.replace("```sql", "").replace("```SQL", "").replace("```", "").strip()
    # Remove trailing parser text (ReAct captures "Action Input: "..."Observation" so we can get '"Observation' at end)
    for marker in (
        "\nObservation", "\nobservation", "\nIt seems", "\nObservation:",
        '"Observation', '"observation', "'Observation", "'observation",
    ):
        idx = s.find(marker)
        if idx != -1:
            s = s[:idx]
    s = s.strip()
    # Strip outer wrapper: \"...\" or "..." (escaped or plain double quotes only at edges)
    while s:
        changed = False
        if s.startswith('\\"') and (s.endswith('"') or s.endswith('\\"')):
            if s.endswith('\\"'):
                s = s[2:-2].strip()
            else:
                s = s[2:-1].strip()
            changed = True
        elif len(s) >= 2 and s[0] == '"' and s[-1] == '"':
            s = s[1:-1].strip()
            changed = True
        if not changed:
            break
    # One more pass: stray double-quote at end (e.g. ...'CittaAI'" from parser)
    if s.endswith('"'):
        s = s[:-1].strip()
    if s.startswith('"'):
        s = s[1:].strip()
    return s.strip()


def execute_sql(
    query: str,
    params: dict | None = None,
    role: str = "super_admin",
    school_id: str | int | None = None,
) -> str:
    """
    Run a read-only SELECT query. For school_admin, params should include school_id
    (UUID string or int) so the query can filter by it (use %(school_id)s in the query).
    """
    query = _sanitize_sql_input(query)
    query = query.rstrip(";").strip()
    if not query.upper().startswith("SELECT"):
        return "Error: Only SELECT queries are allowed."
    if re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b", query, re.I):
        return "Error: Only SELECT queries are allowed."
    if role == "school_admin":
        if school_id is None:
            return "Error: school_id is required for role=school_admin."
        # Enforce scoping at the API layer: school_admin queries must be parameterized.
        # This prevents asking for another school's data by hardcoding a different school_id literal.
        if "%(school_id)s" not in query:
            return "Error: school_admin queries must include the %(school_id)s parameter for scoping."
        # Disallow any school_id comparison to a literal value. Allow only %(school_id)s.
        if re.search(r"\bschool_id\s*=\s*['\"]", query, re.I):
            return "Error: Do not hardcode school_id. Use %(school_id)s."
        if re.search(r"\bschool_id\s+IN\s*\(", query, re.I) and "%(school_id)s" not in query:
            return "Error: Do not use school_id IN (...) for school_admin. Use school_id = %(school_id)s."
    params = dict(params or {})
    if role == "school_admin" and school_id is not None:
        params["school_id"] = school_id
    conn = get_connection()
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute(query, params or None)
        rows = cursor.fetchall()
        if not rows:
            return "Query returned no rows."
        if len(rows) == 1 and len(rows[0]) == 1:
            val = list(rows[0].values())[0]
            return str(val)
        return "\n".join(str(r) for r in rows[:50])  # cap at 50 rows
    except Exception as e:
        return f"SQL Error: {e}"
    finally:
        conn.close()


def fetch_table_data():
    """Fetch all table rows as text chunks (for FAISS vector store)."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        documents = []
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            for row in rows:
                documents.append(f"Table: {table_name} Data: {row}")
        return documents
    finally:
        connection.close()
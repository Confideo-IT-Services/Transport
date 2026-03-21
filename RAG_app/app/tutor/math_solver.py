from __future__ import annotations

import re
from typing import Optional


def looks_like_math(question: str) -> bool:
    q = (question or "").strip()
    if not q:
        return False
    q_lower = q.lower()
    if any(k in q_lower for k in ["solve", "find", "calculate", "evaluate"]):
        return True
    if "=" in q:
        return True
    # Common math patterns
    return bool(re.search(r"\b\d+\s*[a-zA-Z]\b", q) or re.search(r"[a-zA-Z]\s*[\+\-\*\/]\s*\d+", q))


def try_solve_with_sympy(question: str) -> Optional[str]:
    """
    Best-effort equation solver for simple 'expr = expr' cases.
    Returns a human-readable result string, or None if we can't reliably solve.
    """
    try:
        import sympy as sp  # type: ignore
    except Exception:
        return None

    q = (question or "").strip()
    if "=" not in q:
        return None

    # Normalize a few common notations.
    normalized = q.replace("^", "**")

    # Extract first equation-like segment.
    # Example: "Solve 2x + 5 = 15" -> left="2x + 5", right="15"
    m = re.search(r"(.+?)=(.+)", normalized)
    if not m:
        return None

    left_raw = m.group(1).strip()
    right_raw = m.group(2).strip()

    # Identify variables as single letters in the equation.
    vars_found = sorted(set(re.findall(r"\b([a-zA-Z])\b", left_raw + " " + right_raw)))
    if not vars_found:
        # Sometimes sympy can still parse 'x' not surrounded by word boundaries; fallback:
        vars_found = sorted(set(re.findall(r"([a-zA-Z])", left_raw + " " + right_raw)))

    if not vars_found:
        return None

    symbols = sp.symbols(" ".join(vars_found))
    if not isinstance(symbols, (list, tuple)):
        symbols = [symbols]

    try:
        left_expr = sp.sympify(left_raw)
        right_expr = sp.sympify(right_raw)
    except Exception:
        return None

    # Solve for all variables found (may return multiple solutions).
    eq = sp.Eq(left_expr, right_expr)
    try:
        sol = sp.solve(eq, list(symbols), dict=True)
    except Exception:
        try:
            sol = sp.solve(eq, list(symbols))
        except Exception:
            return None

    if not sol:
        return "I tried solving the equation, but I couldn’t find a solution."

    # Convert solutions to a readable string.
    return f"SymPy result: {sol}"


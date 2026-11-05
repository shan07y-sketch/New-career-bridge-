#!/usr/bin/env python3
"""Command-line entry point used by the Node.js API.

Reads one JSON request from stdin and writes one JSON response to stdout.

  {"mode": "health"}
  {"mode": "extract", "path": "/abs/path/resume.pdf"}
  {"mode": "match", "current_year": 2026,
   "items": [{"id": 1, "resume_text": "...", "resume_path": null, "job": {...}}]}
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from matcher import match  # noqa: E402


def extract_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception:  # a damaged page should not lose the whole file
                pages.append("")
        return "\n".join(pages)
    if ext == ".docx":
        import docx
        document = docx.Document(path)
        parts = [p.text for p in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        return "\n".join(parts)
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        return fh.read()


def health():
    info = {"ok": True, "python": sys.version.split()[0], "pypdf": False, "docx": False}
    try:
        import pypdf  # noqa: F401
        info["pypdf"] = True
    except Exception:
        pass
    try:
        import docx  # noqa: F401
        info["docx"] = True
    except Exception:
        pass
    return info


def main():
    raw = sys.stdin.buffer.read().decode("utf-8", errors="ignore")
    req = json.loads(raw or "{}")
    mode = req.get("mode")
    if mode == "health":
        out = health()
    elif mode == "extract":
        out = {"text": extract_text(req["path"])}
    elif mode == "match":
        year = int(req.get("current_year") or 2026)
        results = []
        for item in req.get("items", []):
            try:
                text = item.get("resume_text") or ""
                if item.get("resume_path"):
                    text = extract_text(item["resume_path"])
                result = match(text, item.get("job") or {}, year)
                result["id"] = item.get("id")
                if item.get("resume_path"):
                    result["text"] = text
                results.append(result)
            except Exception as exc:  # report per-item failures, keep going
                results.append({"id": item.get("id"), "error": str(exc)})
        out = {"results": results}
    else:
        out = {"error": "unknown mode"}
    sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()

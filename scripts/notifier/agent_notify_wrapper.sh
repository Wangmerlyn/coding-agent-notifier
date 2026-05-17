#!/usr/bin/env bash
set -euo pipefail

cleanup_tmp() { [[ "${TMP_PAYLOAD_CREATED:-0}" == "1" && -n "${TMP_PAYLOAD:-}" && -f "$TMP_PAYLOAD" ]] && rm -f "$TMP_PAYLOAD"; }
trap cleanup_tmp EXIT

# Accept payload via file path, inline JSON argument, or stdin.
if [[ -n "${1:-}" && "${1}" != "/dev/stdin" && "${1}" != "-" ]]; then
  candidate="${1}"
  # If the argument looks like inline JSON, materialize it to a temp file.
  if [[ "$candidate" =~ ^[\{\[] ]]; then
    TMP_PAYLOAD="$(mktemp)"
    TMP_PAYLOAD_CREATED="1"
    printf "%s\n" "$candidate" > "$TMP_PAYLOAD"
    src="$TMP_PAYLOAD"
  else
    if [[ ! -r "${candidate}" ]]; then
      # brief retry in case the file is being written
      sleep 0.2
    fi
    if [[ -f "${candidate}" && -r "${candidate}" ]]; then
      src="${candidate}"
    else
      echo "Payload file '${candidate}' not found or not readable, falling back to stdin" >&2
      src="/dev/stdin"
    fi
  fi
else
  src="/dev/stdin"
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-"$REPO_ROOT/.env"}"

# If DEBUG_AGENT_PAYLOAD is set to a filepath, the selected payload will be written there.
# DEBUG_CODEX_PAYLOAD remains supported for older hook setups.
filter_and_forward() {
  python - "$src" <<'PY'
import json
import sys
import pathlib
import os

source = sys.argv[1]
debug_path = os.environ.get("DEBUG_AGENT_PAYLOAD") or os.environ.get("DEBUG_CODEX_PAYLOAD")
pwd_env = os.environ.get("PWD")

def read_text():
    if source != "/dev/stdin" and pathlib.Path(source).exists():
        return pathlib.Path(source).read_text(encoding="utf-8", errors="ignore")
    if sys.stdin.isatty():
        return ""
    return sys.stdin.read()

def iter_json_objects(text: str):
    cleaned = text.replace("\x00", "").strip()
    if cleaned:
        try:
            yield json.loads(cleaned)
            return
        except json.JSONDecodeError:
            pass

    for line in text.splitlines():
        clean = line.replace("\x00", "").strip()
        if not clean:
            continue
        try:
            yield json.loads(clean)
        except json.JSONDecodeError:
            continue

def is_relevant(obj: dict) -> bool:
    keys = {"status", "state", "title", "event", "task", "summary", "message", "details"}
    return any(k in obj for k in keys)

last_valid = None
last_relevant = None

for obj in iter_json_objects(read_text()):
    last_valid = obj
    if isinstance(obj, dict) and is_relevant(obj):
        last_relevant = obj

chosen = last_relevant or last_valid or {}
if isinstance(chosen, dict):
    if not any(chosen.get(k) for k in ("repo", "cwd", "workspace")):
        fallback_repo = pwd_env
        if fallback_repo:
            chosen["repo"] = fallback_repo
out = json.dumps(chosen)
if debug_path:
    try:
        pathlib.Path(debug_path).write_text(out + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"DEBUG_AGENT_PAYLOAD write failed: {exc}", file=sys.stderr)
sys.stdout.write(out)
PY
}

if ! filter_and_forward | python "$SCRIPT_DIR/slack_notify.py" --env-file "$ENV_FILE"; then
  echo "Notifier failed to send message" >&2
  exit 1
fi

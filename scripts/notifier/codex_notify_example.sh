#!/usr/bin/env bash
# Example: configure a coding-agent hook to call the Slack notifier after tasks complete.
#
# Optional: load env vars if present
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
if [ -f "$SCRIPT_DIR/../../.env" ]; then
  set -a
  . "$SCRIPT_DIR/../../.env"
  set +a
fi

# Replace U12345678 with your Slack User ID and adjust the path to this repository.
# For real hooks, prefer the wrapper so stdin, inline JSON, and payload-file inputs all work:
#   codex config set notify "/home/you/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"
# This script keeps the direct CLI call as a minimal smoke-test example.

python /home/you/vibe-coding-slack-notifier/scripts/notifier/slack_notify.py --user-id "${SLACK_USER_ID:-U12345678}" <<'JSON'
{
  "status": "success",
  "title": "Sample agent run",
  "summary": "Replace this payload with the one your agent supplies."
}
JSON

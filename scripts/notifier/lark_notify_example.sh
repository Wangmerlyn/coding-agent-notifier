#!/usr/bin/env bash
# Example: send a manual Feishu/Lark custom bot notification.
#
# Optional: load env vars if present
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
if [ -f "$SCRIPT_DIR/../../.env" ]; then
  set -a
  . "$SCRIPT_DIR/../../.env"
  set +a
fi

# Replace the repo path below and set LARK_WEBHOOK_URL or FEISHU_WEBHOOK_URL.
python /home/you/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py <<'JSON'
{
  "status": "success",
  "title": "Sample agent run",
  "summary": "Replace this payload with the one your agent supplies."
}
JSON

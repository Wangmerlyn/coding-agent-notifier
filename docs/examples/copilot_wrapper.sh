#!/usr/bin/env bash
set -euo pipefail

copilot "$@"
copilot_exit=$?
/path/to/coding-agent-notifier/scripts/notifier/agent_notify_wrapper.sh
exit "$copilot_exit"

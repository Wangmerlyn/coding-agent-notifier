#!/usr/bin/env python
"""CLI entrypoint for sending coding-agent notifications as Slack DMs."""

from codex_slack_notifier.notifier import main


if __name__ == "__main__":
    raise SystemExit(main())

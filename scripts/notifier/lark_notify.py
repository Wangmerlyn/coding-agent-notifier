#!/usr/bin/env python
"""CLI entrypoint for sending coding-agent notifications to Feishu/Lark webhooks."""

from codex_slack_notifier.notifier import lark_main


if __name__ == "__main__":
    raise SystemExit(lark_main())

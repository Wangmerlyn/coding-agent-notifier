#!/usr/bin/env python
"""CLI entrypoint for codex_slack_notifier Feishu/Lark webhook notifications."""

from codex_slack_notifier.notifier import lark_main


if __name__ == "__main__":
    raise SystemExit(lark_main())

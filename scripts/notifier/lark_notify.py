#!/usr/bin/env python
"""CLI entrypoint for Coding Agent Notifier Feishu/Lark webhook notifications."""

from coding_agent_notifier.notifier import lark_main


if __name__ == "__main__":
    raise SystemExit(lark_main())

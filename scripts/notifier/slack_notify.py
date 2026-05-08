#!/usr/bin/env python
"""CLI entrypoint for codex_slack_notifier Slack DM notifications."""

from codex_slack_notifier.notifier import main


if __name__ == "__main__":
    raise SystemExit(main())

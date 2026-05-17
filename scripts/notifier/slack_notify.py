#!/usr/bin/env python
"""CLI entrypoint for Coding Agent Notifier Slack DM notifications."""

from coding_agent_notifier.notifier import slack_main


if __name__ == "__main__":
    raise SystemExit(slack_main())

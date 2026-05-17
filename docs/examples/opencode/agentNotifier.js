import { exec } from "node:child_process";

export const AgentNotifierPlugin = () => ({
  event: ({ event }) => {
    if (event?.type === "session.idle") {
      exec("/path/to/coding-agent-notifier/scripts/notifier/agent_notify_wrapper.sh", (error) => {
        if (error) {
          console.error(`Agent notifier script failed: ${error.message}`);
        }
      });
    }
  },
});

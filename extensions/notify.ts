/**
 * Modified from https://github.com/badlogic/pi-mono/blob/419c07fb1992af2a8ec6297da060c21e5e04f52a/packages/coding-agent/examples/extensions/notify.ts
 *
 * Desktop Notification Extension
 *
 * Sends a native desktop notification when the agent finishes and is waiting for input.
 * Uses OSC 777 or OSC 99 escape sequence - no external dependencies.
 *
 * Supported terminals: Ghostty, iTerm2, WezTerm, rxvt-unicode, Kitty
 * Not supported: Terminal.app, Windows Terminal, Alacritty
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Detect if running in Kitty terminal.
 */
function isKitty(): boolean {
  return "KITTY_WINDOW_ID" in process.env;
}

/**
 * Send a desktop notification via appropriate OSC escape sequence.
 */
function notify(title: string, body: string): void {
  if (isKitty()) {
    // OSC 99 format (Kitty): uses ST terminator (\x1b\\) and separate sequences for title/body
    process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
  } else {
    // OSC 777 format (Ghostty, iTerm2, WezTerm, rxvt-unicode): ESC ] 777 ; notify ; title ; body BEL
    process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async () => {
    notify("Pi", "Ready for input");
  });
}

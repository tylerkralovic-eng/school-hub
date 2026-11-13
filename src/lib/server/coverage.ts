import "server-only";

/**
 * Computes how a school platform's information reaches School Hub. No platform
 * has a direct integration in V1; coverage is always indirect or manual, and
 * we say so plainly.
 */
export type Coverage = { level: "auto" | "manual" | "none"; label: string; detail: string };

export function platformCoverage(opts: { channels: string[]; gmailConnected: boolean; hasSenderRule: boolean; smsReady: boolean; phoneLinked: boolean }): Coverage {
  const { channels } = opts;
  if (channels.includes("email") && opts.gmailConnected && opts.hasSenderRule)
    return { level: "auto", label: "Indirect · via Gmail", detail: "Email notifications are read automatically. Anything only shown in the app is not." };
  const ways: string[] = [];
  if (channels.includes("email")) ways.push(opts.gmailConnected ? "add its sender address to read its emails automatically" : "connect Gmail to read its emails automatically");
  if (channels.includes("sms")) ways.push(opts.smsReady && opts.phoneLinked ? "forward its texts to School Hub" : "forward its texts once SMS is set up");
  if (channels.includes("push") || channels.includes("app")) ways.push("share screenshots of important posts");
  if (!ways.length) return { level: "none", label: "Not covered", detail: "Tell us how this platform notifies you to see coverage options." };
  return { level: "manual", label: channels.includes("sms") && opts.smsReady && opts.phoneLinked ? "Manual · forward texts" : "Manual · screenshots/sharing", detail: `To cover it: ${ways.join("; ")}.` };
}

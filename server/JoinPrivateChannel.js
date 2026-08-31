/**
 * Run this ONCE locally (after generateSession.js) to join a private
 * channel via its invite link and print the numeric ID to use as
 * TG_CHANNEL.
 *
 * Usage:
 *   TG_API_ID=xxx TG_API_HASH=xxx TG_SESSION=xxx \
 *     node server/joinPrivateChannel.js "https://t.me/+AbCdEfGhIjKlMnOp"
 *
 * The invite link is whatever Roy shared with you — either the
 * "https://t.me/+..." form or the older "https://t.me/joinchat/..." form.
 * Both work.
 *
 * If your account is ALREADY a member (Roy added you directly, no invite
 * link needed), skip the link argument and it'll just list your dialogs
 * so you can find the channel and its ID:
 *   node server/joinPrivateChannel.js
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");

const apiId = parseInt(process.env.TG_API_ID, 10);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_SESSION || "");
const inviteLink = process.argv[2];

function extractInviteHash(link) {
  // Handles both t.me/+HASH and t.me/joinchat/HASH forms
  const plusMatch = link.match(/t\.me\/\+([\w-]+)/);
  if (plusMatch) return plusMatch[1];
  const joinchatMatch = link.match(/t\.me\/joinchat\/([\w-]+)/);
  if (joinchatMatch) return joinchatMatch[1];
  throw new Error("Could not parse an invite hash from that link.");
}

async function main() {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  if (inviteLink) {
    const hash = extractInviteHash(inviteLink);
    console.log(`Joining via invite hash: ${hash}...`);
    try {
      await client.invoke(new Api.messages.ImportChatInvite({ hash }));
      console.log("Joined successfully.\n");
    } catch (err) {
      // Already a member throws an error too — safe to ignore and continue.
      console.log(`(Join attempt: ${err.message} — continuing to list dialogs)\n`);
    }
  }

  console.log("Your channels/groups:\n");
  const dialogs = await client.getDialogs({});
  for (const dialog of dialogs) {
    if (dialog.isChannel || dialog.isGroup) {
      console.log(
        `${dialog.title}  ->  TG_CHANNEL=${dialog.entity.id.toString()}`
      );
    }
  }

  console.log("\nCopy the numeric ID next to Roy's channel name into TG_CHANNEL.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
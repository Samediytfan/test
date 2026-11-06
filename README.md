<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8651ecf25dc794f3d6c53fac8e6a891895b0ebb90adbc1108fa235305c84b1c8 -->

# Relay

A website for managing your Discord server with a bot account. Use it in your browser; no app installation is required.

## Get your website address

[![Publish website on Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FSamediytfan%2Ftest%2Ftree%2Fcoderabbit%2Fdiscord-bot-management-dashboard%2F1dec7651)

1. Click the button above and sign in to Render.
2. Review the preconfigured free web service and approve deployment.
3. Open the website address Render provides and bookmark it.

GitHub stores the code; your Render address opens the actual dashboard. The free service pauses after inactivity and can take about a minute to reopen.

## Use the website

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:badd9bbab5b7642c4aaca426365a6543093af7b061d0350abe8cf9a26b0aee5a -->

Select **Connect your bot**, enter your bot token, and choose a server and channel. Connecting keeps your token in browser memory for the current page session and forwards it through the server to Discord. Saving it in the private vault requires a separate action.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:39c071701d0b07ee820a304cabad194ac48e939c9f7463621da3efeb2ebb8981 -->

## Chat and live status

Use the emoji button to search standard Unicode emoji and choose skin tones. Type `@` for member/role suggestions; selected mentions appear as readable names and send Discord mention IDs. Existing role edits save automatically after a short pause; new roles use Create role. Failed saves show an error and a retry action.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:264c93ace0d2b28ead49cf592ae443949b73605bda5a069666214308251cbec1 -->

Enable **Presence Intent** for your bot in the Discord Developer Portal. Live status starts automatically when you connect, and requests presence for the loaded server members. Missing or disconnected status is shown as unknown with a dashed indicator; invisible users cannot be distinguished from offline users. Disconnect or reconnect live status from the server menu. Large bots that require sharding are not supported by this browser connection.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4b5855fc114419f87526bb610b94cc9bc1261f52eeb9b59fdfb662def64a90f1 -->

Click a member, then **Profile / DM / Timeout** to send a direct message as your bot, choose a timeout duration from 1 second to 28 days, or remove a timeout. Discord enforces role hierarchy and moderation permissions; privacy settings can block DMs. Mention chips can be removed with Backspace or Delete.

Click the Discord icon at the top left to open **Direct Messages**. Conversations appear after you open a DM from a member profile or receive a new DM while connected. Their IDs and names are saved separately for each bot in this browser; message contents and bot tokens are not saved there. Discord does not provide this bot dashboard with a complete list of older DM conversations, so open an older DM from that member's profile to add it.

Red badges show new DMs and messages mentioning the connected bot, its roles, or everyone. They count events received while this page is connected, and clear when the relevant conversation or channel is viewed. They don't include messages missed while the page was closed, and aren't synced with Discord's read state. Enable the bot's Gateway connection to receive them; message content may require Discord's Message Content Intent. When Presence Intent is unavailable, message notifications reconnect without presence. Discord permissions, Gateway availability, and DM privacy settings still apply.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

Native slash commands still require execution in Discord, or a separately implemented integration with the bot's own source/API. Prefix shortcuts send plain messages; the receiving bot must accept bot-authored messages.

## Private saved bots

<!-- /coderabbit-ai-generated:v1 -->

Only save tokens you own. Open the **lock icon** in the website to unlock, save, reveal, use, or remove your bots.

1. On Render, sync the updated Blueprint. It generates a private `VAULT_PASSWORD` environment variable if one does not already exist.
2. Open the web service’s **Environment** settings to retrieve that password. Keep it private: anyone who knows it can reveal saved tokens.
3. Open **Private saved bots** in the website and unlock it with that password. Select **Save bot to encrypted file** to opt in to saving a token. Discord verifies the token and supplies the name.

The vault is stored in `secret/bots.enc.json` on the server running the website. The whole file, including bot names, is encrypted with AES-256-GCM and a key derived from the vault password. It is excluded from Git and is not available at a public URL. The password is held only in memory while the vault dialog is open. A missing password, or one shorter than 16 characters, disables the vault.

**Render Free does not preserve this file across restarts, inactivity, or deployments.** Download an **Encrypted backup** after changes and use **Restore backup** with the same password after data loss. Keep the same vault password; changing it prevents reading existing files and backups. For durable server storage, configure a persistent disk separately and point `VAULT_FILE` at a private path on it. This project does not provision paid storage.

A file saved on Render lives on Render, not in the Coding Agent workspace. No visitor’s token is saved automatically. Removing a saved bot does not revoke its token in Discord.

<!-- /coderabbit-ai-generated:v1 -->

The bot must already be in the server with the permissions needed for your actions. The Server Members intent is needed to list members, and the Message Content intent may be needed to view message content. Messages refresh every ten seconds.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d6c805905166a2e62bf4d648e066e0211706a0aa7e65bf3f95c5628c968ebc4b -->

## Server management

- **Channel permissions:** Open a channel’s settings, then **Channel permissions**. Select a role or member and set each permission to Allow, Deny, or Inherit. Existing unrelated permission bits are preserved. You can remove an entire overwrite to inherit permissions again.
- **Roles:** Open **Manage roles** to create or delete roles, change names, primary colors, role emoji, permissions, display and mention settings, adjust order, and assign or remove roles for members. Discord enforces the bot’s own permissions and role hierarchy. Integration-managed roles are read-only; the @everyone role’s permissions can be edited but it cannot be renamed, deleted, moved, or assigned manually.
- **Onboarding:** Open the server dropdown and select **Server onboarding** to manage default channels, questions, answers, emoji, and role/channel choices. This requires a Community server and the Manage Server and Manage Roles permissions. Discord validates its channel requirements when enabling onboarding.

## Command and mention suggestions

Type **@** in the message box to filter members and roles. Suggestions can be selected with a click, the arrow keys and Enter, or Tab. Member search queries Discord when connected, so it can find people outside the initially loaded list (up to 1,000 members). Discord permissions and intents still apply.

Type **/** to see your bot’s registered global and server slash commands, including subcommands, alongside your configured prefix shortcuts. Open **Commands & shortcuts** in the server dropdown to add a shortcut such as `/help` that inserts `!help`. These non-secret shortcut definitions are saved only in this browser, separately for each bot. Prefix shortcuts send ordinary messages as your connected bot. They do not execute your bot’s code; the receiving bot must support bot-authored messages for them to trigger anything.

Discord slash commands must be run by a user in Discord. Selecting a registered slash command prepares its text and offers **Copy command** and **Open Discord**. The dashboard never submits it as a fake slash interaction or silently posts it as a message. Running arbitrary custom bot logic here would require a separate integration with that bot’s source code or API, which is not configured. Voice channels are displayed but voice participation is not supported.

<!-- /coderabbit-ai-generated:v1 -->

## Optional: local development

This section is only for editing the code locally. Everyday use of the hosted website does not require it. Requires Node.js 20.19 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Use HTTPS when hosting the application.


<!-- /coderabbit-ai-generated:v1 -->
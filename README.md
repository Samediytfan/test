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

## Private saved bots

Only save tokens you own. Open the **lock icon** in the website to unlock, save, reveal, use, or remove your bots.

1. On Render, sync the updated Blueprint. It generates a private `VAULT_PASSWORD` environment variable if one does not already exist.
2. Open the web service’s **Environment** settings to retrieve that password. Keep it private: anyone who knows it can reveal saved tokens.
3. Open **Private saved bots** in the website and unlock it with that password. Select **Save bot to encrypted file** to opt in to saving a token. Discord verifies the token and supplies the name.

The vault is stored in `secret/bots.enc.json` on the server running the website. The whole file, including bot names, is encrypted with AES-256-GCM and a key derived from the vault password. It is excluded from Git and is not available at a public URL. The password is held only in memory while the vault dialog is open. A missing password, or one shorter than 16 characters, disables the vault.

**Render Free does not preserve this file across restarts, inactivity, or deployments.** Download an **Encrypted backup** after changes and use **Restore backup** with the same password after data loss. Keep the same vault password; changing it prevents reading existing files and backups. For durable server storage, configure a persistent disk separately and point `VAULT_FILE` at a private path on it. This project does not provision paid storage.

A file saved on Render lives on Render, not in the Coding Agent workspace. No visitor’s token is saved automatically. Removing a saved bot does not revoke its token in Discord.

<!-- /coderabbit-ai-generated:v1 -->

The bot must already be in the server with the permissions needed for your actions. The Server Members intent is needed to list members, and the Message Content intent may be needed to view message content. Messages refresh every ten seconds.

Discord slash commands must be run by a user in Discord. Relay lists registered commands. Voice channels are displayed but voice participation is not supported.

## Optional: local development

This section is only for editing the code locally. Everyday use of the hosted website does not require it. Requires Node.js 20.19 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Use HTTPS when hosting the application.


<!-- /coderabbit-ai-generated:v1 -->
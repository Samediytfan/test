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

Select **Connect your bot**, enter your bot token, and choose a server and channel. The token is kept in browser memory for the current page session and forwarded through the server to Discord.

The bot must already be in the server with the permissions needed for your actions. The Server Members intent is needed to list members, and the Message Content intent may be needed to view message content. Messages refresh every ten seconds.

Discord slash commands must be run by a user in Discord. Relay lists registered commands. Voice channels are displayed but voice participation is not supported.

## Optional: local development

This section is only for editing the code locally. Everyday use of the hosted website does not require it. Requires Node.js 20.19 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Use HTTPS when hosting the application.


<!-- /coderabbit-ai-generated:v1 -->
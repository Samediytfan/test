<!-- coderabbit-ai-generated:v1 -->

# Relay

A Discord-inspired dashboard for managing a server with a bot account.

## Run locally

Requires Node.js 20.19 or newer. Run `npm install`, then `npm run dev` and open `http://localhost:3000`. Use the sample server or select **Connect your bot** and provide a bot token. The token is kept in browser memory for the current page session and forwarded through the server to Discord; use HTTPS when hosting the application.

The bot must already be in the server and have the permissions needed for the requested actions. The Server Members intent is needed to list members, and the Message Content intent may be needed to view message content. Messages refresh every ten seconds.

Discord does not allow a bot token to invoke slash commands as a user. Relay lists the bot's registered commands; run them in Discord. Voice channels are displayed but voice participation is not supported.

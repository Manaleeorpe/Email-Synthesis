# Email Synthesis

Email Synthesis is a Node.js automation service that listens to Gmail inbox events, summarizes new email threads with an LLM, and sends the summary back as an email.

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Language:** JavaScript
- **Google APIs:** Gmail API (`googleapis`) for watch, history, read, and send operations
- **Messaging/Eventing:** Google Cloud Pub/Sub (`@google-cloud/pubsub`) for Gmail push notifications
- **Authentication:** OAuth 2.0 via Google credentials (`credentials.json` + `token.json`), with local token persistence
- **LLM Integration:** OpenRouter SDK (`@openrouter/sdk`) using `openai/gpt-5.2`
- **Config/Secrets:** Environment variables via `dotenv`

## Features

- **Gmail watch bootstrap:** Creates a Gmail watch when no local history cursor is present.
- **Pub/Sub subscriber loop:** Listens continuously for mailbox update events.
- **History cursor safety:** Stores and advances `historyId` to process only new changes.
- **Stale event protection:** Skips out-of-order or duplicate/stale notifications.
- **404 cursor recovery:** Resets the local cursor if Gmail history is invalid/expired.
- **Thread idempotency:** Tracks processed thread IDs to avoid duplicate summaries.
- **Email parsing:** Extracts sender, subject, and plain-text body from Gmail payloads.
- **Self-email skip logic:** Prevents generating summaries for messages from the configured sender address.
- **LLM summarization:** Sends email content to an LLM and returns a concise summary.
- **Automated response email:** Sends the generated summary back through Gmail.

## Project Structure

- `index.js` — startup flow, Gmail watch initialization, subscriber launch
- `auth.js` — OAuth authentication and token bootstrap/reuse
- `pubsubSubscriber.js` — Pub/Sub event handling, Gmail history processing, summary emailing
- `callLLM.js` — LLM request wrapper for summarization

## Setup (Quick Start)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Add required credential/config files:
   - `credentials.json` (Google OAuth client)
   - `pubsub-key.json` (service account key for Pub/Sub access)
3. Set environment variables (for example in `.env`):
   - `OPENAI_API_KEY=<your_openrouter_api_key>`
4. Run the service:
   ```bash
   node index.js
   ```

On first run, you will be prompted to authorize Gmail access and generate `token.json`.

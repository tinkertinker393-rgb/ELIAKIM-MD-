```markdown
# ELIAKIM-MD

WhatsApp Multi-Device (MD) bot scaffold inspired by KEITH‑MD.

This repo includes:
- Baileys-based MD WhatsApp bot with multi-file auth state (session/)
- Web pairing UI at /public/pair.html to fetch pairing payload and copy it to clipboard
- Short Session ID flow: when pairing completes the bot sends a short Session ID to the paired WhatsApp account. Paste that into config.js (PAIRED_SESSION_CODE) and set LINKED_JID to the JID you received it at.
- Self-hosted GitHub Actions workflow example to run the bot on a self-hosted runner.
- Core plugins (menu, ping, sticker, download, group, antidelete, welcome, antilink, owner).
- Utilities for yt-dlp downloads and media sending.

Quickstart (local/self-hosted runner)
1. Provision a self-hosted runner (VM/container) with:
   - Node.js >= 18
   - ffmpeg installed and available in PATH
   - yt-dlp binary available in PATH (recommended install: pipx install yt-dlp or download from https://github.com/yt-dlp/yt-dlp/releases)
2. Copy this repository to your runner or create it on GitHub and register a self-hosted runner for the repo.
3. Install dependencies:
   - npm ci
4. Start the bot locally for initial pairing:
   - npm start
5. Open the pairing UI:
   - http://<runner-ip>:3000/public/pair.html
   - Click "Generate pairing" and pair your WhatsApp device.
6. When pairing succeeds the bot will write session/pairing.json and send a short Session ID to the paired WhatsApp account.
7. Copy the Session ID and paste it into config.js as `PAIRED_SESSION_CODE` and set `LINKED_JID` to your JID (e.g., `1234567890@s.whatsapp.net`).
8. Ensure the full session/ folder (auth state) is present on the runner where the workflow runs.
9. Run the GitHub Actions workflow (workflow_dispatch) which targets a self-hosted runner; or run `npm start` to run the bot directly.
10. If pairing config matches, the bot will auto-send the greeting and be ready to accept commands.

Security notes
- Do NOT commit session/* to a public repo. session/ contains your authentication state.
- eval (owner command) is dangerous. Only keep trusted owner numbers in config.js.
- If you need to persist session files to a repo, use encrypted backups. This scaffold does not commit session files automatically.

Commands & plugins (examples)
- .ping — respond "ELIAKIM-MD is Active!"
- .menu — list installed plugins and usage
- .sticker — convert sent image to sticker (send image with caption .sticker)
- .yt <url> — download video (yt-dlp required)
- .yta <url> — download audio
- Group admin: .kick/.add/.promote/.demote/.subject (owner-only by scaffold)
- Anti-delete: restores deleted messages (basic)
- Welcome: .welcome on/off per group (owner-only by scaffold)
- Anti-link: detect WhatsApp invite links
- Owner: .eval, .restart, .broadcast, .reload-plugins

If you'd like, I can:
- Harden admin checks (verify group admin status)
- Add size limits, progress messages, and queueing for downloads
- Implement persistent DB (SQLite/lowdb) for settings and leveling
- Harden security around the pairing UI (add auth tokens or one-time secrets)
```
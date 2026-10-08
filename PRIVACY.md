# Privacy Policy for Delta Bot (bot-klb)

*Last updated: October 8, 2026*

This Privacy Policy explains how **Delta Bot** ("the bot", "we", "our") collects, uses, stores, and protects user data when operating within Discord servers.

---

## 1. Information We Collect

Delta Bot collects only the minimum necessary data to provide its community and gaming features:

* **Discord IDs**: User IDs, Guild (Server) IDs, Channel IDs, and Role IDs required to route messages, execute slash commands, and manage server configurations.
* **Game Integration Tokens (Optional)**: If a user voluntarily links their Delta Force gaming profile, their temporary authentication tokens (OpenID and access token) are transmitted securely.
* **Voluntary Configurations**: Server-specific settings configured by administrators (e.g., welcome channels, booster roles, schedule times).

> [!NOTE]
> Delta Bot **DOES NOT** collect, store, or log general user message contents, chat history, passwords, financial information, or personal identifying information (PII).

---

## 2. How We Use the Information

Collected information is used strictly for the following bot functionalities:

1. **Community Automation**: Sending customized welcome messages to new members (`guildMemberAdd`) and thank-you announcements with assigned roles for server boosters (`guildMemberUpdate`).
2. **Delta Force Game Utilities**: Querying in-game statistics, match history, and daily mission codes via authorized API calls.
3. **Account Binding**: Associating a Discord User ID with their game profile to enable personalized stats lookup (`/df stats`, `/df daily`, `/df history`).
4. **Administration & RBAC**: Verifying user permissions for administrative slash commands (`/config`).

---

## 3. Data Storage and Security

* **Encryption at Rest**: Sensitive authentication credentials (game tokens) are encrypted using industry-standard **AES-256-GCM** encryption before being persisted to our database.
* **Strict Confidentiality**: We never sell, share, trade, or distribute any user or server data to third parties or advertising networks.
* **Transient Webhook Processing**: Temporary payloads received via administrative verification channels are processed atomically and purged immediately.

---

## 4. User Rights and Data Deletion

Users retain complete control over their stored data at all times:

* **Unlink & Data Purge**: Users can permanently remove their linked game profile and encrypted tokens at any time by running the slash command:
  ```text
  /df unlink
  ```
  Upon execution, all associated credentials and bindings are permanently deleted from both local and cloud databases.
* **Server Data Removal**: Server administrators can reset all guild-specific configurations via `/config` or by removing the bot from their guild.

---

## 5. Contact Information

If you have questions regarding this Privacy Policy or wish to request data inspection/removal, please contact the bot developer via GitHub:
* Repository: [https://github.com/Pon1147/bot-klb](https://github.com/Pon1147/bot-klb)

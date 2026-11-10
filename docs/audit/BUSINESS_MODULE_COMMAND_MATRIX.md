# BUSINESS MODULE COMMAND MATRIX

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`

---

## Traceability Matrix

| Command / Interaction            | BM    | Router / Handler             | Service                      | Repository / Target      | Permission                | Test Evidence                                        |
| -------------------------------- | ----- | ---------------------------- | ---------------------------- | ------------------------ | ------------------------- | ---------------------------------------------------- |
| `/config roles set`              | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_RBAC`             | `__tests__/admin/config.command.test.ts`             |
| `/config roles view`             | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_RBAC`             | `__tests__/admin/config.command.test.ts`             |
| `/config bot guilds`             | BM-01 | `config.command.ts`          | Native Discord               | Discord Gateway Cache    | `MANAGE_RBAC`             | `__tests__/admin/config.command.test.ts`             |
| `/config bot announce`           | BM-01 | `config.command.ts`          | Native Discord               | All Guild Channels       | `MANAGE_RBAC` (Bot Owner) | `__tests__/admin/config.command.test.ts`             |
| `/config bot setannouncechannel` | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_RBAC`             | `__tests__/admin/config.command.test.ts`             |
| `/config qr-server toggle`       | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_RBAC` (Bot Owner) | `__tests__/admin/config.command.test.ts`             |
| `/config qr-server status`       | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_RBAC` (Bot Owner) | `__tests__/admin/config.command.test.ts`             |
| `/config vietqr set`             | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/admin/config.command.test.ts`             |
| `/config vietqr workflow`        | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/admin/config.command.test.ts`             |
| `/config vietqr status`          | BM-01 | `config.command.ts`          | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/admin/config.command.test.ts`             |
| `/config vietqr preview`         | BM-01 | `config.command.ts`          | `vietqr.utils.ts`            | External VietQR CDN      | `MANAGE_CONFIG`           | `__tests__/admin/config.command.test.ts`             |
| `/config welcome *` (5 subs)     | BM-02 | `section-config.handlers.ts` | `SettingsService`            | `welcome.database.ts`    | `MANAGE_CONFIG`           | `__tests__/database/welcome.database.test.ts`        |
| `/config leave *` (4 subs)       | BM-02 | `section-config.handlers.ts` | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/admin/config.command.test.ts`             |
| `/config booster *` (5 subs)     | BM-02 | `section-config.handlers.ts` | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/booster/booster.event.test.ts`            |
| `/config container edit`         | BM-02 | `container-edit.handler.ts`  | Container UI Engine          | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/container/container-edit.handler.test.ts` |
| `/config container reset`        | BM-02 | `container-reset.handler.ts` | Container UI Engine          | `guild.settings.db.ts`   | `MANAGE_CONFIG`           | `__tests__/container/container-builders.test.ts`     |
| `/df stats`                      | BM-03 | `stats.handler.ts`           | `deltaforce.api.ts`          | Garena API via Token     | `DF_ACCESS`               | `__tests__/df/df-stats.command.test.ts`              |
| `/df daily`                      | BM-03 | `daily.handler.ts`           | `deltaforce.scraper.ts`      | Garena HQ Scraper        | `DF_ACCESS`               | `__tests__/df/df-daily.command.test.ts`              |
| `/df history`                    | BM-03 | `history.handler.ts`         | `deltaforce.api.ts`          | Garena API via Token     | `DF_ACCESS`               | `__tests__/df/df-history.command.test.ts`            |
| `/df match`                      | BM-03 | `match.handler.ts`           | `deltaforce.api.ts`          | Garena API via Token     | `DF_ACCESS`               | `__tests__/df/df-vault-match.test.ts`                |
| `/df vault`                      | BM-03 | `vault.handler.ts`           | `deltaforce.api.ts`          | Garena API via Token     | `DF_ACCESS`               | `__tests__/df/df-vault-match.test.ts`                |
| `/df workshop`                   | BM-03 | `workshop.handler.ts`        | `workshop-data.service.ts`   | Static JSON Database     | `DF_ACCESS`               | `__tests__/df/workshop.command.test.ts`              |
| `/df market`                     | BM-03 | `market.handler.ts`          | `deltaforce.api.ts`          | Garena Live Market API   | `DF_ACCESS`               | `__tests__/df/df-market.test.ts`                     |
| `/df build`                      | BM-03 | `build.handler.ts`           | `weapon-loadouts.service.ts` | `df-loadouts.db.ts`      | `DF_ACCESS`               | `__tests__/df/df-build.command.test.ts`              |
| `/df map`                        | BM-03 | `map.handler.ts`             | `df-metadata.service.ts`     | CDN Static Maps          | `DF_ACCESS`               | `__tests__/df/df-map.command.test.ts`                |
| `/df link start`                 | BM-03 | `link.handler.ts`            | `df-claim-handler.ts`        | `df-claim.db.ts`         | `DF_ACCESS`               | `__tests__/df/df-link.command.test.ts`               |
| `/df link status`                | BM-03 | `link.handler.ts`            | `df-token.utils.ts`          | `df-binding.db.ts`       | `DF_ACCESS`               | `__tests__/df/df-link.command.test.ts`               |
| `/df unlink`                     | BM-03 | `unlink.handler.ts`          | `df-binding.db.ts`           | `df-binding.db.ts`       | `DF_ACCESS`               | `__tests__/df/df-unlink.command.test.ts`             |
| `/df code show`                  | BM-04 | `code.handler.ts`            | `deltaforce.scraper.ts`      | Scraper Cache / Fallback | `DF_ACCESS`               | `__tests__/df/df-code.command.test.ts`               |
| `/df code setchannel`            | BM-04 | `code.handler.ts`            | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_DF_CODE`          | `__tests__/df/df-code.command.test.ts`               |
| `/df code settime`               | BM-04 | `code.handler.ts`            | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_DF_CODE`          | `__tests__/df/df-code.command.test.ts`               |
| `/df code setadminchannel`       | BM-04 | `code.handler.ts`            | `SettingsService`            | `guild.settings.db.ts`   | `MANAGE_DF_CODE`          | `__tests__/df/df-code.command.test.ts`               |
| `/df autopost set`               | BM-04 | `autopost.handler.ts`        | `df-autopost-scheduler.ts`   | `df-autopost.db.ts`      | `MANAGE_RBAC`             | `__tests__/df/df-autopost.handler.test.ts`           |
| `/df autopost toggle`            | BM-04 | `autopost.handler.ts`        | `df-autopost-scheduler.ts`   | `df-autopost.db.ts`      | `MANAGE_RBAC`             | `__tests__/df/df-autopost.handler.test.ts`           |
| `/df autopost status`            | BM-04 | `autopost.handler.ts`        | `df-autopost-scheduler.ts`   | `df-autopost.db.ts`      | `MANAGE_RBAC`             | `__tests__/df/df-autopost.handler.test.ts`           |
| `/df autopost run`               | BM-04 | `autopost.handler.ts`        | `df-autopost-scheduler.ts`   | Multi-guild broadcaster  | `MANAGE_RBAC`             | `__tests__/df/df-autopost.handler.test.ts`           |
| `/df help`                       | BM-04 | `help.handler.ts`            | Native Embed/Button          | Discord UI               | `DF_ACCESS`               | `__tests__/df/df-help.handler.test.ts`               |
| `/team find`                     | BM-05 | `team-find.handler.ts`       | `team-find-session.ts`       | `TTLStore` in-memory     | `TEAM_ACCESS`             | `__tests__/team-find/team-find.command.test.ts`      |
| `/pay create`                    | BM-06 | `pay.command.ts`             | `payment-flow.ts`            | `payment.db.ts`          | `PAY_ACCESS`              | `__tests__/payment/pay.command.test.ts`              |
| `/pay history`                   | BM-06 | `pay.command.ts`             | `payment.service.ts`         | `payment.db.ts`          | `PAY_ACCESS`              | `__tests__/payment/pay.command.test.ts`              |
| `/pay top`                       | BM-06 | `pay.command.ts`             | `payment.service.ts`         | `payment.db.ts`          | `PAY_ACCESS`              | `__tests__/payment/pay.command.test.ts`              |
| `/donate`                        | BM-06 | `donate.command.ts`          | `payos.service.ts`           | `payment.db.ts`          | `PAY_ACCESS`              | `__tests__/payment/donate.command.test.ts`           |

---

## Interactive Components & Modal Routing

| Custom ID Pattern               | Type              | Target Handler                                                   | Module |
| ------------------------------- | ----------------- | ---------------------------------------------------------------- | ------ |
| `df_link_show_webhook`          | Button            | In-memory token reveal (ephemeral, 5s auto-delete, 60s cooldown) | BM-03  |
| `ce_*` (`ContainerIds.PREFIX`)  | Buttons / Selects | `handleContainerEditorButtonInteraction`                         | BM-02  |
| `cm_*` (`ContainerModalPrefix`) | Modals            | `handleContainerEditorModalSubmit`                               | BM-02  |
| `tf_*` (`TeamFindIds.*`)        | Buttons / Selects | `handleTeamFindButton`, `handleTeamFindSelect`                   | BM-05  |
| `df_help:page:*`                | Buttons           | `handleHelpButton`                                               | BM-04  |
| `df_help:select:*`              | String Select     | `handleHelpSelect`                                               | BM-04  |
| `df_match_select:*`             | String Select     | `handleMatchSelect`                                              | BM-03  |
| `df_stats_select:*`             | String Select     | `handleDfStatsSelect`                                            | BM-03  |
| `pay:confirm:*`, `pay:cancel:*` | Buttons           | `handlePaymentButton`                                            | BM-06  |
| `pay:modal:*`                   | Modals            | `handlePaymentModal`                                             | BM-06  |
| `feedback:rate:*`               | Buttons           | `handleFeedbackRateButton`                                       | BM-06  |
| `feedback:modal:*`              | Modals            | `handleFeedbackModal`                                            | BM-06  |

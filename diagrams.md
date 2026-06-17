# 6. Tổng quan kiến trúc `/team-find`

```mermaid
graph TB
    subgraph Discord
        Poster[Poster - Người post tìm đồng đội]
        Finder[Finder - Người muốn join]
        VC[Voice Channel]
        Bot[Discord Bot]
    end

    subgraph Bot
        GuildGuard[Guild Guard<br/>df-guards.ts]
        AuthGuard[Auth Guard<br/>df-guards.ts]
        VoiceGuard[Voice Guard<br/>df-voice.utils.ts]
        Config[Config<br/>team-find.config.ts]
        Builder[Embed Builder<br/>team-find.embed.ts]
        Cmd[Command Handler<br/>team-find.command.ts]
        BHandler[Button Handler<br/>interactionCreate]
    end

    DB[(SQLite<br/>df_tokens)]

    Poster -- /team-find --> Cmd
    Cmd --> GuildGuard
    GuildGuard -- pass --> AuthGuard
    AuthGuard --> DB
    AuthGuard -- pass --> VoiceGuard
    VoiceGuard -- user trong VC? --> VC
    VoiceGuard -- pass --> Config
    Config --> Builder
    Builder --> Poster
    Finder -- click button --> BHandler
    BHandler --> VC
    VC -- bot join --> Finder
```

## 7. Sequence diagram — Execute `/team-find`

```mermaid
sequenceDiagram
    participant U as User (Poster)
    participant C as Command Handler
    participant DB as SQLite
    participant G as Voice Guard
    participant VC as Voice Channel
    participant B as Embed Builder

    U->>C: /team-find --map:X --mode:easy [--rank:2500]
    C->>C: requireGuild(interaction)
    alt DM
        C-->>U: "Chỉ dùng trong server." (ephemeral)
    else Trong guild
        C->>DB: getDfToken(discordId)
        alt Chưa /df-link
            DB-->>C: null
            C-->>U: "Bạn chưa liên kết tài khoản.<br/>Dùng `/df-link` để bắt đầu." (ephemeral)
        else Đã /df-link
            DB-->>C: token row
            C->>G: checkVoiceForTeamFind(interaction)
            G->>VC: read voice state

            alt Không trong VC
                G-->>C: { success: false, error }
                C-->>U: "Bạn phải đang trong phòng thoại" (ephemeral)
            else VC đầy
                G-->>C: { success: false, error }
                C-->>U: "Phòng thoại đã đầy (99 người)." (ephemeral)
            else Bot không có Connect
                G-->>C: { success: false, error }
                C-->>U: "Bot không có quyền tham gia" (ephemeral)
            else Pass (có thể có warning)
                G-->>C: { success: true, warnings[] }
                C->>B: buildTeamFindEmbed(params)
                B-->>C: embed + button
                C-->>U: Reply embed + button "🎧 Tôi muốn join"
            end
        end
    end
```

## 8. Sequence diagram — Click button "Tôi muốn join"

```mermaid
sequenceDiagram
    participant F as Finder (Người click)
    participant H as Button Handler
    participant VC as Voice Channel
    participant Bot as Bot Voice Connection
    participant D as Discord API

    F->>H: Click "🎧 Tôi muốn join"
    Note over H: Parse customId → channelId
    H->>D: guild.channels.fetch(channelId)
    D-->>H: VoiceChannel or null

    alt Channel không tồn tại
        H-->>F: Reply "Phòng thoại không còn tồn tại."
    else Finder đã trong channel
        H->>H: member.voice.channelId === channelId?
        H-->>F: Reply "Bạn đã đang trong phòng này."
    else Channel đầy
        H->>H: channel.full?
        H-->>F: Reply "Phòng thoại đã đầy."
    else Bot không có quyền
        H->>H: Check Connect + Speak perm
        H-->>F: Reply "Bot không có quyền tham gia."
    else Join thành công
        H->>D: channel.join()
        D-->>Bot: VoiceConnection established
        Bot-->>VC: Bot appears
        H-->>F: Reply "✅ Đã join phòng thành công!"
    end
```

## 9. Flowchart — Guard chain (full execute path)

```mermaid
flowchart TD
    Start([User go /team-find]) --> G1{Trong guild?}
    G1 -- No --> E1[Chỉ dung trong server]
    G1 -- Yes --> G2{Da /df-link?}
    G2 -- No --> E2[Chua lien ket tai khoan]
    G2 -- Yes --> G3{User trong VC?}
    G3 -- No --> E3[Phai dang trong phong thoai]
    G3 -- Yes --> G4{VC day 99/99?}
    G4 -- Yes --> E4[Phong thoai da day]
    G4 -- No --> G5{Bot co Connect?}
    G5 -- No --> E5[Bot khong co quyen tham gia]
    G5 -- Yes --> G6{Bot co Speak?}
    G6 -- No --> W1[Bot khong the noi trong phong]
    G6 -- Yes --> G7{User bi deafened?}
    G7 -- Yes --> W2[Ban dang bi diec]
    G7 -- No --> G8{User bi muted?}
    G8 -- Yes --> W3[Ban dang bi tat micro]
    G8 -- No --> G9{VC bi khoa?}
    G9 -- Yes --> W4[Phong khoa - chi nguoi duoc moi moi join]
    G9 -- No --> OK[Pass - Build embed voi button]
```

## 10. File dependency graph

```mermaid
graph LR
    subgraph Core
        Cmd[team-find.command.ts]
    end

    subgraph Guards
        GG[df-guards.ts]
        VG[df-voice.utils.ts]
        TDB[df-token.db.ts]
    end

    subgraph ConfigAndUtils
        CFG[team-find.config.ts]
        CVARS[container.variables.ts]
        CUTIL[container.utils.ts]
        RANK[df-rank.utils.ts]
    end

    Cmd --> GG
    Cmd --> VG
    Cmd --> Builder[team-find.embed.ts]
    GG --> TDB
    Builder --> CFG
    Builder --> RANK
    Builder --> CUTIL
    Builder --> CVARS
    VG --> CUTIL
```

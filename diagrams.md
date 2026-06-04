# Mermaid Diagrams - Delta Force HQ Discord Bot

## 1. Tổng quan kiến trúc

```mermaid
graph TB
    subgraph Discord
        User[User]
        Bot[Discord Bot]
        Commands[/Commands: /link, /stats, /matches, /daily/]
    end

    subgraph Backend
        WebServer[Express Web Server]
        TokenSvc[Token Service]
        DFService[DeltaForce API Service]
        DB[(Database)]
    end

    subgraph Garena
        OAuthPage[OAuth Login Page]
        TokenAPI[Garena Token API]
    end

    subgraph DeltaForce
        HQAPI[DeltaForce HQ API]
    end

    User -- /link --> Bot
    Bot -- gửi OAuth URL --> User
    User -- click & login --> OAuthPage
    OAuthPage -- redirect + code --> WebServer
    WebServer -- đổi code --> TokenAPI
    TokenAPI -- access_token --> WebServer
    WebServer -- lấy game token + openid --> TokenSvc
    TokenSvc -- lưu --> DB
    WebServer -- confirm --> Bot
    Bot -- DM thành công --> User

    User -- /stats, /matches --> Bot
    Bot -- đọc token từ --> DB
    Bot -- gọi --> DFService
    DFService -- GetMyData, GetMatchList --> HQAPI
    HQAPI -- trả data --> DFService
    DFService -- format --> Bot
    Bot -- embed --> User
```

## 2. Chi tiết luồng `/link` (OAuth)

```mermaid
sequenceDiagram
    participant U as User
    participant B as Discord Bot
    participant E as Express Server
    participant G as Garena OAuth
    participant T as Token Service
    participant D as Database

    U->>B: /link
    B->>U: Gửi DM chứa OAuth URL
    U->>G: Click URL, đăng nhập Garena
    G->>G: User confirm
    G-->>E: Redirect callback?code=ABC
    E->>G: POST token endpoint (code → access_token)
    G-->>E: Returns access_token + openid
    E->>T: Extract game token from access_token
    T-->>E: game token + openid
    E->>D: Save (discordId, openid, token, refresh_token)
    E-->>B: WebSocket/HTTP notify success
    B->>U: DM "Liên kết thành công!"
```

## 3. Chi tiết luồng `/stats`

```mermaid
sequenceDiagram
    participant U as User
    participant B as Discord Bot
    participant D as Database
    participant DF as DeltaForce API Service
    participant HQ as HQ API

    U->>B: /stats
    B->>D: Query by discordId
    D-->>B: Return stored token
    B->>DF: GetMyData(token)
    DF->>HQ: POST GetMyData headers + body
    HQ-->>DF: Player data (rank, combat, economy...)
    DF-->>B: Parsed response
    B->>U: Discord Embed với stats
```

## 4. Chi tiết luồng `/matches`

```mermaid
sequenceDiagram
    participant U as User
    participant B as Discord Bot
    participant D as Database
    participant DF as DeltaForce API Service
    participant HQ as HQ API

    U->>B: /matches
    B->>D: Query by discordId
    D-->>B: Return stored token
    B->>DF: GetMatchList(token, page, count)
    DF->>HQ: POST GetMatchList headers + body
    HQ-->>DF: Match history array
    DF-->>B: Parsed matches
    B->>U: Discord Embed với match list
```

## 5. Token lifecycle

```mermaid
stateDiagram-v2
    [*] --> Unlinked
    Unlinked --> Linking: User chạy /link
    Linking --> Linked: OAuth thành công, token lưu DB
    Linked --> TokenExpired: Token hết hạn
    TokenExpired --> Linked: Auto refresh (nếu có refresh_token)
    TokenExpired --> Unlinked: Refresh fail → user phải /link lại
    Linked --> Unlinked: User chạy /unlink
```

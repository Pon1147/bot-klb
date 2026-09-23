# Deploy KL BOT

## 🚀 Railway (khuyến nghị cho Discord bot)

1. Vào [railway.app](https://railway.app) → Login bằng GitHub
2. **New Project** → **Deploy from GitHub repo** → chọn `bot-klb`
3. Vào **Variables** thêm các biến từ `.env.example` (BOT_TOKEN, CLIENT_ID, GUILD_ID…)
4. Settings → **Build Command**: `npm run build`
5. Settings → **Start Command**: `npm start`
6. Deploy

Railway sẽ tự build & chạy mỗi khi bạn push lên `main`.

> Lưu ý 2026: Railway free tier có credit hạn chế (~$1–5/tháng). Bot nhỏ thường chạy được, nhưng nếu hết credit service sẽ pause.

## Render

1. Vào [render.com](https://render.com) → New → **Background Worker** (quan trọng: dùng Worker, không dùng Web Service)
2. Connect GitHub repo
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Thêm Environment Variables
6. Deploy

> Render free tier **Web Service** sẽ sleep sau 15 phút không có HTTP traffic → **không phù hợp** Discord bot. Phải dùng **Background Worker**.

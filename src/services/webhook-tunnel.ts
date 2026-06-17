/**
 * Cloudflared quick tunnel cho webhook server.
 *
 * Khi không có biến môi trường WEBHOOK_URL, tự động khởi tạo tunnel
 * để expose webhook server ra internet (bypass Mixed Content HTTPS block).
 * Nếu WEBHOOK_URL đã được set → skip tunnel, dùng URL tĩnh.
 */

import { execFile } from 'child_process';
import { chmodSync, createWriteStream, existsSync, mkdirSync } from 'fs';
import { IncomingMessage } from 'http';
import https from 'https';
import { homedir } from 'os';
import { join } from 'path';

let tunnelUrl: string | null = null;
let tunnelProcess: ReturnType<typeof execFile> | null = null;

/** Download cloudflared nếu chưa có */
async function downloadCloudflared(): Promise<string> {
  const binDir = join(homedir(), '.kl-bot');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  const binPath = join(binDir, 'cloudflared.exe');
  if (existsSync(binPath)) return binPath;

  const downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

  console.log(`[Tunnel] Downloading cloudflared...`);

  function fetchWithRedirect(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume(); // consume body to free connection
          const loc = res.headers.location;
          if (!loc) { reject(new Error(`Redirect without location`)); return; }
          fetchWithRedirect(loc).then(resolve, reject);
        } else {
          resolve(res);
        }
      }).on('error', reject);
    });
  }

  const res = await fetchWithRedirect(downloadUrl);
  if (res.statusCode !== 200) {
    throw new Error(`Download failed: HTTP ${res.statusCode}`);
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(binPath);
    res.pipe(stream);
    stream.on('finish', () => { stream.close(); resolve(); });
    stream.on('error', reject);
  });

  chmodSync(binPath, 0o755);
  console.log(`[Tunnel] Downloaded cloudflared to ${binPath}`);
  return binPath;
}

/** Start cloudflared quick tunnel */
async function startTunnel(port: number): Promise<string> {
  const binPath = await downloadCloudflared();
  console.log(`[Tunnel] Starting cloudflared quick tunnel → http://localhost:${port}`);

  return new Promise<string>((resolve, reject) => {
    const cp = execFile(binPath, ['tunnel', '--url', `http://localhost:${port}`], {
      timeout: 30_000,
    });

    tunnelProcess = cp;
    let urlFound = false;

    cp.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[Tunnel] ${text.trim()}`);

      const match = text.match(/https:\/\/[^\s"']+\.trycloudflare\.com/);
      if (match && !urlFound) {
        urlFound = true;
        tunnelUrl = match[0];
        resolve(tunnelUrl);
      }
    });

    cp.on('close', (code) => {
      if (!urlFound) {
        reject(new Error(`cloudflared closed with code ${code}`));
      }
    });

    cp.on('error', reject);
  });
}

/** Stop cloudflared tunnel */
function stopTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill('SIGTERM');
    tunnelProcess = null;
  }
  tunnelUrl = null;
}

/** Get tunnel URL (hoặc WEBHOOK_URL nếu dùng static) */
export function getTunnelUrl(): string | null {
  return tunnelUrl;
}

/** Setup tunnel (chỉ khi chưa có WEBHOOK_URL static) */
export async function setupTunnel(port: number): Promise<string> {
  if (process.env.WEBHOOK_URL) {
    tunnelUrl = process.env.WEBHOOK_URL;
    console.log(`[Tunnel] WEBHOOK_URL đã được set: ${tunnelUrl}`);
    return tunnelUrl;
  }

  const url = await startTunnel(port);
  process.env.WEBHOOK_URL = url;
  console.log(`[Tunnel] URL: ${url}`);
  return url;
}

export { stopTunnel };

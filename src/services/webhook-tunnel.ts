/**
 * Cloudflared quick tunnel cho webhook server.
 *
 * Khi không có biến môi trường WEBHOOK_URL, tự động khởi tạo tunnel
 * để expose webhook server ra internet (bypass Mixed Content HTTPS block).
 * Nếu WEBHOOK_URL đã được set → skip tunnel, dùng URL tĩnh.
 */

import { spawn, ChildProcess } from 'child_process';
import { chmodSync, createWriteStream, existsSync, mkdirSync } from 'fs';
import { IncomingMessage } from 'http';
import https from 'https';
import { homedir } from 'os';
import { join } from 'path';

import { CLOUDFLARED_BIN_NAME, CLOUDFLARED_DOWNLOAD_URL } from '../config/app.constants.js';

let tunnelUrl: string | null = null;
let tunnelProcess: ChildProcess | null = null;
let _tunnelStartTime = 0;
let _isStatic = false; // true when URL is from env, not our tunnel process

const TUNNEL_TTL_MS = 4 * 60 * 60 * 1000; // 4h — cloudflared quick tunnel DNS stale after ~13h

/** Download cloudflared nếu chưa có */
async function downloadCloudflared(): Promise<string> {
  const binDir = join(homedir(), '.kl-bot');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  const binPath = join(binDir, CLOUDFLARED_BIN_NAME);
  if (existsSync(binPath)) return binPath;

  const downloadUrl = CLOUDFLARED_DOWNLOAD_URL;

  console.log(`[Tunnel] Downloading cloudflared...`);

  function fetchWithRedirect(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
            res.resume();
            const loc = res.headers.location;
            if (!loc) {
              reject(new Error(`Redirect without location`));
              return;
            }
            fetchWithRedirect(loc).then(resolve, reject);
          } else {
            resolve(res);
          }
        })
        .on('error', reject);
    });
  }

  const res = await fetchWithRedirect(downloadUrl);
  if (res.statusCode !== 200) {
    throw new Error(`Download failed: HTTP ${res.statusCode}`);
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(binPath);
    res.pipe(stream);
    stream.on('finish', () => {
      stream.close();
      resolve();
    });
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
    const cp = spawn(binPath, ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'inherit', 'pipe'],
      detached: false,
    });

    tunnelProcess = cp;
    _isStatic = false;
    _tunnelStartTime = Date.now();
    let urlFound = false;

    cp.stderr!.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[Tunnel] ${text.trim()}`);

      const match = text.match(/https:\/\/[^\s"']+\.trycloudflare\.com/);
      if (match && !urlFound) {
        urlFound = true;
        tunnelUrl = match[0];
        resolve(tunnelUrl);
      }
    });

    cp.on('exit', (code, signal) => {
      console.log(`[Tunnel] Process exited: code=${code}, signal=${signal}`);
      // Clear state only if we never got a URL (startup failure)
      // or if this process is the one we're tracking
      if (!urlFound) {
        reject(new Error(`cloudflared exited before URL: code=${code}, signal=${signal}`));
      }
    });

    cp.on('error', (err) => {
      if (!urlFound) {
        reject(err);
      }
    });
  });
}

/** Stop cloudflared tunnel */
function stopTunnel(): void {
  if (tunnelProcess) {
    console.log('[Tunnel] Stopping cloudflared...');
    try {
      tunnelProcess.kill('SIGTERM');
    } catch {
      /* already dead */
    }
    tunnelProcess = null;
    _tunnelStartTime = 0;
  }
  tunnelUrl = null;
  _isStatic = false;
}

/** Get tunnel URL (hoặc null nếu không có tunnel) */
export function getTunnelUrl(): string | null {
  return tunnelUrl;
}

/** Tunnel is considered dead if: process died, no URL, or TTL exceeded */
export function isTunnelAlive(): boolean {
  if (_isStatic) return tunnelUrl !== null;
  if (!tunnelUrl || !tunnelProcess || tunnelProcess.exitCode !== null) return false;
  if (Date.now() - _tunnelStartTime > TUNNEL_TTL_MS) return false; // stale
  return true;
}

/** Setup tunnel (chỉ khi chưa có WEBHOOK_URL static) */
export async function setupTunnel(port: number): Promise<string> {
  if (process.env.WEBHOOK_URL) {
    tunnelUrl = process.env.WEBHOOK_URL;
    _isStatic = true;
    console.log(`[Tunnel] WEBHOOK_URL đã được set: ${tunnelUrl}`);
    return tunnelUrl;
  }

  const url = await startTunnel(port);
  process.env.WEBHOOK_URL = url;
  console.log(`[Tunnel] URL: ${url}`);
  return url;
}

export { stopTunnel };

/** Graceful shutdown: cleanup tunnel khi bot dừng */
function registerShutdownHandlers(): void {
  process.on('SIGTERM', () => {
    console.log('[Tunnel] Received SIGTERM — stopping tunnel...');
    stopTunnel();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Tunnel] Received SIGINT — stopping tunnel...');
    stopTunnel();
    process.exit(0);
  });
}

registerShutdownHandlers();

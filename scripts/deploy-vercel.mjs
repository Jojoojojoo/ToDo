#!/usr/bin/env node
/**
 * 從 .env 讀取必要變數，寫入 Vercel 專案並執行正式環境部署。
 * 執行前請先：npx vercel login
 * 使用：node scripts/deploy-vercel.mjs 或 npm run deploy:vercel
 */
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function parseEnv(content) {
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return vars;
}

function runShell(command, stdin) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, { cwd: root, shell: true, stdio: stdin !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit' });
    if (stdin !== undefined) {
      p.stdin.write(stdin);
      p.stdin.end();
    }
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

/** 執行指令並回傳 exit code 與 stderr，用於判斷是否為「變數已存在」可略過 */
function runShellCapture(command, stdin) {
  return new Promise((resolve) => {
    let stderr = '';
    const p = spawn(command, {
      cwd: root,
      shell: true,
      stdio: stdin !== undefined ? ['pipe', 'inherit', 'pipe'] : 'inherit',
    });
    if (stdin !== undefined) {
      p.stdin.write(stdin);
      p.stdin.end();
    }
    p.stderr?.on('data', (d) => { stderr += d.toString(); });
    p.on('close', (code) => resolve({ code, stderr }));
  });
}

async function main() {
  const envContent = readFileSync(envPath, 'utf8');
  const env = parseEnv(envContent);

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('.env 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const envVars = [
    ['VITE_SUPABASE_URL', url],
    ['VITE_SUPABASE_ANON_KEY', key],
    ...(env.VITE_LINE_BOT_ADD_URL ? [['VITE_LINE_BOT_ADD_URL', env.VITE_LINE_BOT_ADD_URL]] : []),
    ...(env.VITE_LINE_BOT_QR_URL ? [['VITE_LINE_BOT_QR_URL', env.VITE_LINE_BOT_QR_URL]] : []),
  ];
  console.log('正在將環境變數寫入 Vercel（Production）...');
  for (const [name, value] of envVars) {
    const { code, stderr } = await runShellCapture(`npx vercel env add ${name} production`, value);
    if (code === 0) {
      console.log(`  已寫入 ${name}`);
    } else if (stderr.includes('already been added') || stderr.includes('already exists')) {
      console.log(`  ${name} 已存在，略過`);
    } else {
      throw new Error(`vercel env add ${name} 失敗: ${stderr || `exit ${code}`}`);
    }
  }

  console.log('正在部署到 Vercel Production...');
  await runShell('npx vercel deploy --prod --yes');
  console.log('部署完成。請到 Vercel 儀表板查看網址。');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

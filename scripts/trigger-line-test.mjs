// Trigger check-deadlines-notify for LINE test. Run line-test-notification.sql first.
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const envPathCwd = join(process.cwd(), ".env");
const envFile = existsSync(envPath) ? envPath : envPathCwd;
const url = "https://aqhmnrwxglfmewsgvtzs.supabase.co/functions/v1/check-deadlines-notify";

let cronSecret = process.env.CRON_SECRET;
if (!cronSecret && existsSync(envFile)) {
  const raw = readFileSync(envFile, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.startsWith("CRON_SECRET=")) {
      cronSecret = t.slice("CRON_SECRET=".length).trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
  if (!cronSecret && process.env.DEBUG_LINE_TEST) {
    console.error("DEBUG: .env lines:", lines.length, "| sample:", lines.slice(0, 6).map((l) => l.replace(/KEY=.+/, "KEY=***").replace(/SECRET=.+/, "SECRET=***")));
  }
}
if (!cronSecret) {
  console.error("CRON_SECRET not found. Add to .env: CRON_SECRET=YourSecret");
  console.error("  Tried:", envPath, existsSync(envPath) ? "(exists)" : "(missing)", "|", envPathCwd, existsSync(envPathCwd) ? "(exists)" : "(missing)");
  process.exit(1);
}

console.log("Calling check-deadlines-notify...");
const body = JSON.stringify({ secret: cronSecret });
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await res.json();
  console.log("Response:", JSON.stringify(data));
  if (data.ok) {
    console.log("sent:", data.sent, "sent_line:", data.sent_line, "sent_email:", data.sent_email);
    console.log("Check LINE app for the reminder.");
  }
} catch (e) {
  console.error("Request failed:", e.message);
  process.exit(1);
}

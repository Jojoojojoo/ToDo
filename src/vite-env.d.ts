/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** LINE 加好友連結（例：https://line.me/R/ti/p/%40你的LINE_ID） */
  readonly VITE_LINE_BOT_ADD_URL?: string;
  /** LINE Bot QR Code 圖片網址（選填） */
  readonly VITE_LINE_BOT_QR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

# 部署到 Vercel 取得外部連結

本專案為 Vite + React SPA，可透過 Vercel 一鍵部署並取得對外網址。

## 前置條件

- 程式碼已推送到 **GitHub** 倉庫
- 在 Vercel 使用 GitHub 帳號登入

## 一、推送到 GitHub

1. 在 GitHub 建立新倉庫（例如 `ToDo` 或 `todo-deadline-manager`），**不要**勾選「Initialize with README」。
2. 在本機專案目錄執行（請將 `YOUR_USERNAME`、`YOUR_REPO` 換成你的 GitHub 使用者名稱與倉庫名稱）：

```powershell
cd "c:\Users\JoJo\Documents\Project\ToDo"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git add .
git commit -m "chore: 準備 Vercel 部署與 .gitignore"
git branch -M main
git push -u origin main
```

若倉庫已存在遠端，改為：

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 二、在 Vercel 建立專案並取得外部連結

1. 前往 [Vercel](https://vercel.com) 並用 **GitHub** 登入。
2. 點 **Add New…** → **Project**。
3. **Import** 你的 GitHub 倉庫（若未列出，先到 **Configure GitHub App** 授權該倉庫）。
4. 專案設定建議：
   - **Framework Preset**: Vite（通常會自動偵測）
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. **Environment Variables**（必填，否則前端無法連 Supabase）：
   - `VITE_SUPABASE_URL`：Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`：Supabase anon / publishable key
   - （選填）`VITE_LINE_BOT_ADD_URL`、`VITE_LINE_BOT_QR_URL`：LINE 綁定用
6. 點 **Deploy**，等待建置完成。
7. 部署成功後會得到外部連結，例如：`https://your-project.vercel.app`。之後每次推送到 `main` 都會自動重新部署。

## 三、SPA 路由說明

`vercel.json` 已設定 `rewrites`，將所有路徑導向 `/index.html`，因此 React Router 的 client-side 路由可正常運作。

## 四、注意事項

- `.env` 不會被推送到 GitHub；在 Vercel 請用 **Environment Variables** 設定上述變數。
- Supabase 的 **URL** 與 **anon key** 可暴露在前端，但請勿在程式碼或倉庫中寫死，一律用環境變數。
- 若使用自訂網域，可在 Vercel 專案 **Settings → Domains** 新增。

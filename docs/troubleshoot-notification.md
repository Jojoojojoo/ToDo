# 截止日通知沒收到：排查清單

## 1. 確認「實際發送了哪個管道」

觸發後回傳若為 `sent: 1`，可能是 **LINE** 或 **Email** 其中一個成功。  
新版 Edge Function 會回傳 `sent_line`、`sent_email`，可判斷是哪個管道被計入。

- **sent_email: 1** → 有呼叫 Resend 且 API 回 200，但信可能進垃圾信或 Resend 限制。
- **sent_line: 1** → 有發 LINE（Messaging API 或 Notify），請到 LINE 查收。
- 若兩者皆 0 但 `deadlines_checked: 1` → 代表沒通過「可發送」條件（見下方 2、3）。

## 2. 查資料庫：notification_logs

在 **Supabase → SQL Editor** 執行：

```sql
SELECT id, deadline_id, recipient, channel, sent_at
FROM public.notification_logs
ORDER BY sent_at DESC
LIMIT 10;
```

- 有 **channel = 'email'**、**recipient = 你的信箱**：代表系統有記一筆「已發 Email」，問題多半在 Resend／信箱（見 4、5）。
- 只有 **channel = 'line'**：代表那次觸發只發了 LINE，沒發 Email（可能是沒設 RESEND_API_KEY 或 profile 沒 email）。
- 完全沒新紀錄：代表當次沒有寫入 log（例如 Resend 回非 200，或 LINE 失敗），可再觸發一次並看回傳的 `email_errors`。

## 3. 確認「會被打到」的條件

Email 要發送，需同時滿足：

- 該 deadline 的 **due_date** 在「今天」～「今天 + DAYS_BEFORE（預設 3）天」。
- 該 deadline 有 **assignee_id**。
- 對應的 **profiles** 有 **email**。
- Edge Function 有設 **RESEND_API_KEY**。
- 當天同一 deadline 尚未發過 Email（同一日不重複發）。

若 `sent: 1` 但沒收到信，且 logs 裡是 **email**，就往下看 Resend 與信箱。

## 4. Resend 與發信者網域

- **NOTIFY_FROM_EMAIL** 預設為 `notify@resend.dev`。  
  Resend 對 **resend.dev** 網域常有限制：**僅能寄給該 Resend 帳號的註冊信箱**做測試。  
  若收件人 `lujo941201@gmail.com` 不是 Resend 帳號登入信箱，可能被拒絕或無法送達。

**建議：**

1. 到 [Resend Dashboard](https://resend.com/emails) → **Logs** 看該封信狀態（accepted / delivered / bounced / 錯誤訊息）。
2. 若要寄到任意信箱：在 Resend 加一個 **自訂網域**並驗證，然後把 Edge Function 的 **NOTIFY_FROM_EMAIL** 改成該網域的地址（例如 `notify@你的網域.com`）。

## 5. 信箱端

- 收件匣與 **垃圾郵件** 都找過。
- 確認 **recipient** 與實際要收的信箱一致（含大小寫、拼字）。
- 若 Resend Logs 顯示 delivered，但信箱沒看到：可能是信箱服務商延遲或歸類到促銷/其他標籤，再等幾分鐘或搜尋「Resend / 截止日提醒」。

## 6. 再次觸發並看錯誤（Email）

新版函數在 Resend 回非 200 時，會把錯誤放進回傳的 **email_errors**。  
再觸發一次後看回應是否包含：

```json
"email_errors": [{ "to": "lujo941201@gmail.com", "status": 4xx, "detail": "..." }]
```

- **status 401**：API Key 錯誤或過期。
- **status 403 / 422**：常與網域未驗證或 from/to 限制有關，對照 Resend 文件與 Dashboard 錯誤說明。

## 7. 快速檢查用 SQL（負責人與截止日）

確認「負責人有 email、且有一筆 3 天內到期」：

```sql
SELECT p.id, p.email, p.line_user_id, p.line_notify_token,
       d.id AS deadline_id, d.title, d.due_date
FROM public.deadlines d
JOIN public.profiles p ON p.id = d.assignee_id
WHERE d.due_date >= CURRENT_DATE
  AND d.due_date <= CURRENT_DATE + 3
  AND d.assignee_id IS NOT NULL
ORDER BY d.due_date;
```

若這裡沒有該負責人或 **email 為空**，就不會發 Email。

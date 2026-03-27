# API Key 逐步限縮手冊（PreorderTracker）

本手冊對應目前專案架構（GitHub Pages + Firebase FCM/Installations + Functions）。

## 階段 A：先限縮（低風險）

1. 到 Google Cloud Console -> `APIs & Services` -> `Credentials`。
2. 建立新 key（建議名稱：`web-pwa-prod`），先不要刪除舊 key。
3. 設定 `Application restrictions`：
   - `HTTP referrers (web sites)`
   - 加入：
     - `https://heheann.github.io/*`
     - `http://localhost:*`
4. 設定 `API restrictions` -> `Restrict key`，只勾：
   - `Firebase Installations API`
   - `FCM Registration API`
5. 把新 key 寫進：
   - `preorder-tracker/firebase-config.js` 的 `FIREBASE_BROWSER_API_KEY`
   - `preorder-tracker/firebase-sw-config.js` 的 `FIREBASE_BROWSER_API_KEY`
6. 推上 GitHub Pages 後，手機端清除站點資料或移除舊 PWA 後重裝。

## 階段 B：輪替收斂（24-48 小時後）

1. 觀察 24-48 小時：
   - 手機可正常啟用提醒
   - `registerDevice` / `syncReminderJobs` 正常
   - 沒有新錯誤告警
2. 確認穩定後：
   - 舊 key 設為停用，或把 referrer 限成不存在網域（封存）
   - 在 GitHub secret scanning alert 標記為已處理

## 階段 C：進一步強化（可選）

1. 啟用 Firebase App Check（Web）。
2. Functions/Firestore 加上 App Check 驗證規則。
3. 仍可保留 `x-api-secret` 做第二層保護。
4. 若不再本機測試，移除 `http://localhost:*` referrer。

## 驗證清單

1. 功能驗證
   - GitHub Pages 點「啟用付款提醒」不出現 `token-subscribe-failed`
   - Firestore `devices.lastSeenAt` 有更新
   - Firestore `reminder_jobs` 可 upsert
2. 安全驗證
   - 非允許來源呼叫 Installations/FCM Registration 被拒絕
   - GitHub 無新增 secret scanning alert
3. 回歸
   - 手機背景通知可收到
   - 通知點擊可回 App 指定商品
   - 離線開啟正常

## 一鍵檢查指令（可選）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-api-key-restrictions.ps1 `
  -ApiKey "<你的新API_KEY>" `
  -ProjectId "heheprodect" `
  -AllowedReferrer "https://heheann.github.io/"
```

判讀原則：
- Allowed referrer 應該不是 403（常見 200 或 400）。
- No referrer 應該是 403。

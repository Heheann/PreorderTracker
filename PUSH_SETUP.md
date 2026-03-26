# Firebase 背景推播設定（付款提醒）

## 1. 建立 Firebase 專案
- 啟用 `Cloud Firestore`
- 啟用 `Cloud Messaging`
- 啟用 `Cloud Functions`

## 2. 部署 Functions
```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

說明：
- 本專案後端從 `REMINDER_API_SECRET` 讀取 API 密鑰。
- 若不想啟用密鑰，可留空（不建議公開環境）。
- 需要密鑰時，請在部署環境設定同名環境變數，並同步填入前端 `apiSecret`。

## 3. 填寫前端設定
請編輯以下兩個檔案，填入同一個 Firebase 專案參數：
- `preorder-tracker/firebase-config.js`
- `preorder-tracker/firebase-sw-config.js`

`preorder-tracker/firebase-config.js` 需填：
- `firebase.apiKey`
- `firebase.authDomain`
- `firebase.projectId`
- `firebase.storageBucket`
- `firebase.messagingSenderId`
- `firebase.appId`
- `vapidKey`（FCM Web Push 憑證）
- `apiBaseUrl`（Functions HTTP base URL，例如 `https://asia-east1-<project-id>.cloudfunctions.net`）
- `apiSecret`（與後端一致）

## 4. PWA 使用方式
1. 安裝 PWA 到手機
2. 打開首頁，按 `啟用付款提醒`
3. 允許通知權限
4. 新增或編輯商品時填 `訂金截止` / `尾款截止`，系統會同步提醒

## 5. 通知規則
- 到期前 3 天上午 09:00（Asia/Taipei）
- 到期前 1 天上午 09:00（Asia/Taipei）
- 到期當天上午 09:00（Asia/Taipei）

## 6. iPhone 注意事項
- 需 iOS 16.4+
- 必須從主畫面啟動已安裝 PWA 才能收 Web Push

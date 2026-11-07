# 旅行說飛就飛

從台北（桃園 TPE、松山 TSA）出發，一次看「未來 1 年最便宜的目的地」與「未來 1 個月航空公司特價」。

頁面只提供查找與連結，不處理訂票或付款，也不收集個人資料。

## 運作方式

```
每日排程
  ├─ scripts/fetch-fares.js   價格 API → data/fares.json（並累積 data/history/）
  └─ scripts/fetch-promos.js  各航空公司促銷 → data/promos.json
          ↓
scripts/build-site.js        web/ + 兩個資料檔 → dist/
          ↓
GitHub Pages                 靜態頁面，前端只讀 data/*.json
```

- 價格來源目前是 Ignav 的 `cheapest-dates`（以官方文件為準，**尚未用真實金鑰實測**）。
- 促銷來源第一批是虎航、樂桃、酷航、捷星、亞洲航空，目前全部是人工整理（`config/promo-sources.json`），因為 2026-11-07 逐家讀過條款，沒有任何一家允許自動抓取（亞洲航空與捷星明寫禁止，樂桃與酷航未授權，虎航找不到網站條款）。
- 資料是每日快取，價格以訂購頁為準。

## 需求

- Node.js 22 以上
- 價格來源金鑰：環境變數 `IGNAV_API_KEY`（不要寫進程式碼或提交到 Git）

## 常用指令

```bash
npm test
```

```bash
node scripts/fetch-fares.js
```

```bash
node scripts/fetch-promos.js
```

```bash
node scripts/serve.js
```

最後一個會在 `http://localhost:5173/` 預覽頁面。加上 `?data=fixtures&now=2026-11-07T04:00:00Z` 可看內建的假資料。

## 新增目的地

1. 開啟 `config/destinations.json`。
2. 在 `destinations` 陣列加上三個大寫字母的機場代碼，例如 `"LHR"`。
3. 若想有中文顯示名稱，在 `web/airports.js` 的 `AIRPORT_NAMES` 加一行。
4. 執行 `npm test`，確認設定仍然有效（格式錯誤會在查詢前失敗並指出哪一項）。

下一次每日更新就會同時查 TPE 與 TSA 到該目的地的價格。

## 新增人工促銷

```bash
node scripts/add-promo.js --source peach --origin TPE --destination KIX --price 1780 --currency TWD --trip oneWay --tax false --url https://www.flypeach.com/ --travel-from 2026-12-01 --travel-to 2027-03-31 --sale-end 2026-11-10
```

- `--source` 是 `config/promo-sources.json` 裡的 id（tigerair-tw、peach、scoot、jetstar、airasia）。
- `--trip` 是 `oneWay` 或 `roundTrip`，`--tax` 是 `true` 或 `false`，兩者都必填，避免單程與來回、含稅與未稅混在一起。
- 不知道截止時間就不要填 `--sale-end`，頁面會顯示「截止時間未公告」。
- 看過某家航空公司網站、確認沒有新促銷時，記錄一次檢查，避免該來源被標示為過期：

```bash
node scripts/add-promo.js --source peach --checked
```

超過 3 天（`staleAfterDays`）沒有更新的來源，頁面會顯示過期提醒。

## 自動抓取航空公司頁面的規則

`config/promo-sources.json` 的來源若設為 `page`，必須同時滿足 `termsReviewed` 與 `termsAllowFetch` 都是 `true`：前者代表條款已讀過，後者代表條款允許自動抓取。任一不是 `true`，系統會拒絕執行並說明原因。目前五家的 `termsAllowFetch` 都是 `false`（結論與條款網址記在各來源的 `termsVerdict`、`termsUrl`、`notes`），也沒有啟用任何頁面解析器。航空公司之後若改變條款，或你取得書面同意，再改這兩個欄位並新增對應的解析器。

## 部署到 GitHub Pages（每日自動更新）

排程設定在 `.github/workflows/daily-update.yml`，每天台北時間 04:00 執行，也可以手動觸發。

1. 把這個專案推到 GitHub 的遠端倉庫。
2. 在倉庫的 Settings → Secrets and variables → Actions 新增 Repository secret，名稱 `IGNAV_API_KEY`，值為你的金鑰。
3. 在 Settings → Pages，把 Source 設為 GitHub Actions。
4. 到 Actions 分頁，手動執行 `Daily update and deploy` 一次，確認成功。

注意：免費方案的 GitHub Pages 通常需要公開倉庫。金鑰存在 Secrets，不會出現在程式碼裡；但 `data/` 內的票價與歷史會是公開的。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `config/` | 目的地與促銷來源設定 |
| `data/` | 產生的資料：`fares.json`、`promos.json`、`history/`、人工促銷 `promos.manual.json` |
| `lib/` | 共用邏輯與價格轉接器（`lib/adapters/`） |
| `scripts/` | 每日工作、人工新增、建置與預覽指令 |
| `web/` | 靜態前端與測試用假資料 |
| `test/` | 單元測試（`npm test`） |
| `docs/spectra/` | 需求規格與設計文件 |

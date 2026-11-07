## 1. 來源實測與專案骨架

- [x] 1.1 實測價格來源（Duffel、Ignav）：以 TPE 查詢 3 個目的地，記錄欄位、額度、價格與條款，結論寫回 design.md 的 Open Questions；驗證：結論段落列出每個候選的可用欄位與是否支援不指定目的地。
- [x] 1.2 逐一檢查第一批 5 家航空公司（虎航、樂桃、酷航、捷星、亞洲航空）的促銷頁：網址、官方 feed、抓取條款；驗證：`config/promo-sources.json` 每家都有取得方式與 termsReviewed 欄位值。 [after: 1.1]
- [x] 1.3 建立「後端使用 Node.js」的專案骨架（package.json、測試框架、`config/`、`data/`、`web/` 目錄）；驗證：`npm test` 可執行並通過空測試。

## 2. 價格管線

- [x] 2.1 實作「價格來源以轉接器介面隔離」：定義轉接器介面並接上 1.1 選定的來源；驗證：以假回應測試，轉接器輸出符合 Fare record shape（含 tripType、taxIncluded、bookingUrl）。 [after: 1.1, 1.3]
- [x] 2.2 實作 Configurable destination list 的讀取與驗證；驗證：測試新增代碼後下次輸出含 TPE 與 TSA 兩邊，非三字母代碼會在查詢前失敗並指出該項目。 [after: 1.3]
- [x] 2.3 實作 Daily fare snapshot（`node scripts/fetch-fares.js`）：每月最低價、產生時間、來源名稱；「失敗時保留舊資料並標示過期」，部分路線失敗時保留舊紀錄並標 stale；驗證：部分失敗的單元測試。 [after: 2.1, 2.2]
- [x] 2.4 實作 Price history retention：每日追加歷史、判定 history-insufficient（少於 90 天）與 history-sufficient；驗證：連續兩日執行各有一筆，0 到 89 天與 90 天以上的邊界測試。 [after: 2.3]
- [x] 2.5 確認 Secrets stay out of published output：缺少金鑰環境變數時非零結束並指出變數名稱，且輸出檔不含金鑰；驗證：缺金鑰測試，以及對 `data/` 搜尋金鑰字串為零筆。 [after: 2.3]

## 3. 促銷管線

- [x] 3.1 實作 Normalized promo record 轉換與 Expired promo removal；saleEnd 缺少時存 null 且不補造；驗證：轉換測試與過期剔除測試。 [after: 1.3]
- [x] 3.2 實作「促銷來源分三種取得方式」與 Terms check before automated fetching：未記錄條款已審閱的頁面抓取來源拒絕執行並說明原因；驗證：拒絕執行的測試。 [after: 3.1, 1.2]
- [x] 3.3 實作 First-batch airline coverage 的 5 個來源與 `node scripts/fetch-promos.js`；逐家讀完條款後（2026-11-07）五家都沒有允許自動抓取，因此全部維持人工整理（method 為 manual），不寫頁面解析器；條款檢查結果（termsReviewed、termsAllowFetch、termsCheckedAt、termsUrl、termsVerdict）記在 `config/promo-sources.json`。驗證：`node scripts/fetch-promos.js --list` 顯示 5 家與各自取得方式；`test/promo-pipeline.test.js` 確認每家都有條款檢查紀錄且 termsAllowFetch 為 false，並確認條款不允許時抓取被拒絕。 [after: 3.2]
- [x] 3.4 實作 Manual promo entry（`node scripts/add-promo.js`）；驗證：新增 saleEnd 在未來的人工促銷後，`data/promos.json` 含該筆且 manual 為 true。 [after: 3.1]
- [x] 3.5 實作 Stale source warning（3 天門檻範例）；驗證：2 天前為 fresh、4 天前為 stale 的測試，且 `data/promos.json` 含各來源 lastSuccessAt。 [after: 3.3]

## 4. 前端頁面

- [x] 4.1 建立「前端與後端分離，以靜態 JSON 交接」的頁面骨架，附固定假資料 JSON，並實作 Empty and failure states；驗證：資料請求失敗時顯示載入失敗訊息且無票價列。 [after: 1.3]
- [x] 4.2 實作 Year view of cheapest destinations 與 Month detail for a destination；驗證：假資料下排序為 Bangkok、Seoul、Tokyo，點目的地顯示 12 個月且無資料月份顯示 no data。 [after: 4.1]
- [x] 4.3 實作 Origin airport selection 與 Trip types are not mixed in ranking；驗證：只選 TSA 時不出現 TPE 紀錄，單程與來回分組且不混排。 [after: 4.2]
- [x] 4.4 實作 Next-month promotions view，含「特價判定以促銷頁為準，歷史中位數僅作輔助」的顯示規則與 Booking handoff only（連結新分頁開啟、不存個資）；驗證：同價 3000 的兩筆，明天截止者排前，連結帶 target 為新分頁。 [after: 4.3]
- [x] 4.5 實作 Freshness and staleness display 與 Usable on mobile；驗證：stale 來源顯示過期提示與最後更新時間，並以 375 像素寬度手動確認兩個視圖無水平捲動。 [after: 4.4]

## 5. 排程與收尾

- [x] 5.1 設定「排程由 CI 定時工作執行」：每日執行兩個命令並提交更新後的 JSON（遠端倉庫不存在時改記錄替代排程做法）；驗證：手動觸發一次成功，或文件記錄替代方案。 [after: 2.5, 3.5, 4.5]
- [x] 5.2 撰寫 README：資料來源、免責（以訂購頁價格為準）、新增目的地與人工促銷的步驟；驗證：依 README 步驟可完成新增一個目的地。 [after: 5.1]

## 6. 實測回饋修正（2026-11-07，已實作）

- [x] 6.1 實作 Prefilled price-check links 與 Airline front-page links are labeled：每筆票價與促銷有帶路線與日期的 Google Flights、Skyscanner 連結（「查價連結導流，不嵌入或爬取第三方結果」），首頁連結標示為官網並附說明；驗證：`test/web-logic.test.js` 的 search links 與 front-page link 測試，以及瀏覽器中確認連結與說明文字。
- [x] 6.2 實作 Airline filter for promotions（「促銷頁依航空公司篩選」）：複選、空選為全部、年度視圖不顯示；驗證：`test/web-logic.test.js` 的 airline filter 測試，以及瀏覽器中選酷航只剩一筆。
- [x] 6.3 實作 Google Flights explore link：依所選機場各一個探索連結；驗證：`test/web-logic.test.js` 的探索連結測試，且瀏覽器開啟顯示「從臺北市出發 | 探索」。
- [x] 6.4 實作 View state kept in the URL（「檢視狀態存於網址 hash」）：hash 還原與預設回退；驗證：`test/web-logic.test.js` 的 hash round trip 與 damaged hash 測試，以及瀏覽器中選酷航、前往外部網站、按返回後仍為酷航篩選。
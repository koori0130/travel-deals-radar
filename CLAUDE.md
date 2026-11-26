# Travel_Radar：旅行說飛就飛

台北（TPE、TSA）出發的機票優惠查找頁面與每日資料管線：看「未來 1 年最便宜的目的地」與「未來 1 個月航空公司特價」。頁面只提供查找與連結，不處理訂票或付款。

## 倉庫與版控
- 這是獨立 git 倉庫 koori0130/travel-deals-radar：程式的 commit／push 在 `Travel_Radar/` 內進行，不進中樞版控（已列在中樞 `.gitignore`）。
- 規格與變更在中樞 `docs/spectra/`，規格名稱前綴 `travel-`（`travel-fare-price-pipeline`、`travel-airline-promo-feed`、`travel-deals-explorer-page`；變更 `travel-deals-radar`）。

## 排程與發布
- 每天台北 04:00 由 GitHub Actions（`.github/workflows/daily-update.yml`）抓價、建站並發布 GitHub Pages：https://koori0130.github.io/travel-deals-radar/
- 機器人 radar-bot 每天會 commit `data/`，所以本機改動前先 `git -C Travel_Radar pull`。
- 抓價需要 repo secret `IGNAV_API_KEY`，由使用者自己在 GitHub 設定；不要讀出或填入任何金鑰。

## 主要檔案
- `scripts/`：每日工作（`fetch-fares.js`、`fetch-promos.js`）、人工新增促銷、建站（`build-site.js`）與預覽（`serve.js`）。
- `lib/`：共用邏輯與價格轉接器（`lib/adapters/`）。
- `web/`：靜態前端與測試用假資料。
- `data/`：產生的資料（`fares.json`、`promos.json`、`history/`、`promos.manual.json`）。
- `config/`：目的地與促銷來源設定。
- `test/`：單元測試，`npm test`（Node 22）。

細節見 `README.md`。

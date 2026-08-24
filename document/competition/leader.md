<!--
AI 閱讀說明 — 區域負責人競賽頁
對應畫面：pages/competition/leader/index.html
對應程式：pages/competition/leader/main.js
共用計分：pages/competition/score.js（見 score.md）
身分：區域負責人。管一區的車，不是選手。預設 accountBindings.lead_region，頂列可切北／中／南。

這頁已經是「團隊目前怎樣、該先處理誰」。不要把司機頁的個人競賽 Dashboard 套過來。
沒有 AI 聊天、沒有心情。AI 是摘要「AI 重點」（先找哪台、跟他說什麼、怎麼派車）。

畫面上已有：
  · 本區平均、較上月、表現一般人數（小字：差 n · 好 n）
  · 上期／本期曲線、及格線 70
  · AI 重點最多 3 台（關注強度 + 失敗事實 + 派車建議；車號可開 drawer）
  · 本區司機卡：車號、表現好／一般／差、關注 tag、狀況、分數
  · Drawer：該車分數、本區排名、月趨勢、statusHtml（與司機同一套 keep／fix）、派車建議
  · 底部分頁：安全／效率／保養（平均 + 差／一般／好）

想看全隊／最弱區 → boss.md。想看單司機自己 → driver.md。
刻意不做：班表按鈕、寄信、AI 聊天、單車月曲線、日指標。
-->

# Leader 競賽儀表板現有資料

來源：`excel-derived-data.js` → `window.HINO_EXCEL_DATA`  
頁面：`pages/competition/leader/index.html`  
共用計分：`pages/competition/score.js`（與司機頁同一套 `CATS`）  
示範範圍：預設 `accountBindings.lead_region`；頂列可切北／中／南。不管車數，不扁平全隊。

## 計分／燈號（與司機頁相同）

- 安全 = `100 − overspeed_pct × 2`
- 效率 = `100 − idle_pct × 1.2 − high_load_pct × 1.5`
- 保養 = `100 − dtc_count × 4`
- 分數夾 0–100；不用編譯器 `drivers[].s`
- 燈號：< 55 紅、< 70 黃、其餘綠
- 事實門檻：超速 < 8%、怠速 < 8%、高負載 < 6%、DTC = 0

表現分級（分數）

- ≥ 70 表現好
- 55–69 表現一般
- < 55 表現差

## 期間／標題

- `meta.period`
- 截至：本區 `last_time` 最晚一筆（沒有則 `meta.lastRecord`），取日期前 10 碼
- 標題區名；台數 = 該區 `drivers.length`

## 頂列

- 本區平均：當前 tab 的 `CATS.score` 對本區各車四捨五入平均
- 較上月：本區 `regions[].series` 最後兩點相減（與司機頁同一套 `history`）
- 表現一般人數；小字差 n · 好 n
- 曲線：只畫上期、本期、及格線 70；無圓點、無月份格線
  - 安全 ← `series.safety`
  - 效率 ← `series.idle` 再 `100 − idle × 1.2`
  - 保養 ← `series.dtc` 再 `100 − dtc × 4`
  - 空月：`series.speed` 或 `idle` 為 0 則丟掉

## 底部分類 tab

安全／效率／保養：本類本區平均、差 n · 一般 n · 好 n

## AI 重點（摘要，無聊天）

最多 3 台，依關注強度再依分數低→高：

- 車號 `c`（可點開 drawer）
- 關注：第一次出現異常 · 留意／偶發異常 · 跟進／常態性異常 · 優先
- 失敗事實：`facts.detail`（超速率／怠速／高負載／DTC）
- 第一名另附司機頁 `facts.fix`（跟他說）
- 派車建議（現算，無班表）
  - DTC → 先排進廠，這幾天別塞滿班
  - 怠速 → 少派要等、要塞的市區件
  - 高負載 → 核對載重與坡段
  - 超速 → 少派測速密的路段

關注強度現算（無單車月序列；用期間佔比／筆數）

- 分數 < 55 → 常態
- 保養：DTC 1 第一次、2–5 偶發、其餘常態
- 安全：超速 ≥ 15% 或 筆數／趟次 ≥ 30 → 常態；超速 < 10% 且 筆數／趟次 < 10 → 第一次
- 效率：怠速 ≥ 15% 或 高負載 ≥ 12% → 常態；怠速 < 10% 且 高負載 < 8% → 第一次

## 司機卡片（本區各車，差→一般→好，同分低分在前）

- `c`
- 表現好／一般／差
- 有失敗事實才加關注 tag（第一次／偶發／常態）
- 狀況：`facts.detail`；非良好另加 `overspeed_count`／`idle_count`／`high_load_count`／`dtc_count`
- 該類分數（右下，燈號色）
- 左邊框色 = `tint(分數)`

## Drawer（點卡片或 AI 車號）

對應該車、可切安全／效率／保養：

- `c`、`meta.period`、該車 `last_time`
- 關注強度（若有）
- 該類分數、表現分級
- 本區排名 `rankOf`、本區平均
- 本區 `regions[].series` 月趨勢（與司機頁相同）
- `statusHtml`：繼續保持／需要注意／可以怎麼改進（司機同一套 keep／fix）
- 派車建議
- `i`、`journeys`

## 頁面沒有用到

單車：`n`、`s`、`last_status`、`last_speed`、`last_limit`、`position`、`journey`  
區：`idlePct`、`fuel`、`overload`、`seatbelt`、`onTime`、`lead`、`phone`  
全隊：`todos`、`advice`、`shippers`

## 刻意不做

班表、訂單、車齡、市區路網、寄信、派班按鈕、AI 聊天、心情、準時率、安全帶、單車月曲線

<!--
AI 閱讀說明 — 總負責人競賽頁
對應畫面：pages/competition/boss/index.html
對應程式：pages/competition/boss/main.js
共用計分：pages/competition/score.js（見 score.md）
身分：總負責人／老闆。不是選手，只看計分板，不下場。不列車號。

實作與下方「畫面要有」草稿有一處不同：沒做 3 張可點區卡。
現況是異常次數圓餅（依 tab：超速／怠速＋高負載／DTC）＋各區月趨勢折線＋圖例（區名、台數、分數、差／一般／好）。
以程式為準。想看某區的車 → 切區域負責人頁（leader.md），不要在這頁加 drawer 或 AI。

畫面上已有：
  · 全隊平均、較上月
  · 最弱區（區名＋分數）
  · 異常次數圓餅、每台最高區
  · 三區月趨勢、及格線 70、圖例 mix
  · 底部分頁：安全／效率／保養（全隊平均、最弱區名）

刻意沒有：AI、聊天、心情、派車建議、關注 tag、司機卡、drawer、車號。
不要把司機個人競賽或 leader 的 AI 重點搬進來。
-->

# Boss 競賽儀表板需要的資料

角色：老闆不是選手。只看計分板，不下場。  
來源：同一份 `excel-derived-data.js` → `window.HINO_EXCEL_DATA`  
頁面：`pages/competition/boss/index.html`  
共用計分：`pages/competition/score.js` 的 `CATS`  
骨架：抄 leader 頂列＋tab；20 張司機卡改成全隊／各區對照。不要 AI、不要 drawer。

## 畫面要有

- 期間／截至
- 全隊平均、較上月
- 最弱區（填 leader「表現一般」那個卡位）
- 各區月趨勢（三條線）＋異常次數圓餅
- 底部分類 tab：安全／效率／保養

## 畫面不要有

AI 重點、聊天、心情、派車／派區建議、關注 tag、司機卡、drawer、車號名單

想看車 → 切區域負責人頁。

## 計分（與 driver、leader 同一套）

單車現算，不用 `drivers[].s`：

- 安全 = `100 − overspeed_pct × 2`
- 效率 = `100 − idle_pct × 1.2 − high_load_pct × 1.5`
- 保養 = `100 − dtc_count × 4`
- 夾 0–100；燈號 < 55 紅、< 70 黃、其餘綠
- 區分數 = 該區各車 `CATS.score` 四捨五入平均
- 區分級看區平均（≥70 好／55–69 一般／<55 差）
- mix = 該區各車分級人數

區分數不要用 `series` 最後一點（`series.dtc` 是區合計筆數，不可比）。曲線才用序列。

Excel 現算分得出三區：安全最弱北 69；效率最弱南 69；保養最弱南 64。沒有區平均落到差，差在區內的車，用 mix 看見就好。

## 期間／標題

- `meta.period`
- 截至：20 台 `last_time` 最晚（沒有則 `meta.lastRecord`），日期前 10 碼
- 標題「全隊」；`meta.vehicles`（20）

## 頂列

- 全隊平均：當前 tab 對 20 台平均（與 leader 同一數）
- 較上月：全隊序列最後兩點相減（與 leader 同一算法）
  - 安全 ← `aggregate.safety`
  - 效率 ← `metrics.idle` 再 `100 − idle × 1.2`
  - 保養 ← `metrics.dtc` 再 `100 − dtc × 4`
  - 空月：`metrics.speed` 或 `idle` 為 0 則丟掉
- 最弱區：該類區平均最低的 `name` + 分數

## 中段（實作）

- 圓餅：該 tab 異常次數（安全超速筆數／效率怠速＋高負載／保養 DTC），圖例含百分比與每台
- 各區月趨勢：`regions[].series` 三條線
- 圖例：區名、台數、區平均、差／一般／好

## 底部分類 tab

安全／效率／保養：全隊平均、最弱區名

## 要用的欄位

`meta.period`、`meta.lastRecord`、`meta.vehicles`  
`months`  
`aggregate.safety`  
`metrics` 的 `idle`／`dtc`／`speed`  
`regions[].id`、`name`、`color`、`drivers[]`、`series`  
單車只為了算區平均／mix／事實：`overspeed_pct`、`idle_pct`、`high_load_pct`、`dtc_count`、`overspeed_count`、`idle_count`、`high_load_count`、`last_time`

## 不用

單車：`c`、`n`、`s`、`last_status`、`last_speed`、`last_limit`、`position`、`journey`、`journeys`、`i`  
區：`idlePct`、`fuel`、`overload`、`seatbelt`、`onTime`、`lead`、`phone`、`anomaly`、`brake`  
全隊：`todos`、`advice`、`shippers`、`ordersByRegion`、`factMap`、`dimSolData`、`vehicleSnapshot`、`accountBindings`

## 刻意不做

AI、drawer、班表、訂單、寄信、預算、油耗、6 區、單車月曲線、新編譯欄位、把 20 台再列一次

<!--
AI 閱讀說明 — 司機競賽頁
對應畫面：pages/competition/driver/index.html
對應程式：pages/competition/driver/main.js
共用計分：pages/competition/score.js（見 score.md）
身分切換：右上「身分」→ 司機／區域負責人／總負責人。這頁只服務司機。

摺疊時看起來像「總分＋排名」。展開「目前狀況」才看得到分項達成與改進建議。
不要當成功能沒做。截圖若沒展開 details，會誤判成只顯示分數。

畫面上已有（不要重做）：
  · 總分、該類分數名稱、本區較上月正負
  · 全隊排名（第 n / 總人數 · 平均）
  · 所屬區月趨勢（虛線綠燈 70）；最後一點是區分數，不是個人
  · 「目前狀況」：繼續保持／需要注意／可以怎麼改進（statusHtml）
  · 底部分頁：安全／效率／保養，各帶分數與排名
  · AI 關心氣泡＋✦ 聊天（標題「AI 關心」）。是情緒／節奏關心，不是衝排名教練。
    聊天本地關鍵字拼裝，沒接 /api/chat。只有司機頁有聊天。

沒有、也不要發明：日指標、今日 4/5 項、開車中即時 HUD、急煞／分心／手機考核、
距離前一名差幾分、單車月曲線。團隊對照在 leader.md／boss.md，不塞進司機首頁。
-->

# 司機儀表板現有資料

來源：`excel-derived-data.js` → `window.HINO_EXCEL_DATA`  
頁面：`pages/competition/driver/index.html`

## 身分

- `accountBindings.personal_code`（示範帳號，如 `S0`）
- `regions[].id`、`regions[].drivers[]`（區碼 + 序號取出自己）
- 自己的 `c`（車號，排名比對）
- 自己的 `region` → 所屬區物件（月序列、區名）
- `regions[].name`（曲線標題，如「南區月趨勢」）

## 期間／截至

- `meta.period`（資料期間，如 `2025-01-01 至 2025-11-30`）
- `last_time`（該車最後一筆；沒有則用 `meta.lastRecord`）
- 畫面只取日期前 10 碼

## 單車欄位（分數／狀況／AI）

- `overspeed_pct` → 安全分數、目前狀況、心情「激進」
- `idle_pct` → 效率分數、目前狀況、心情「疲憊」
- `high_load_pct` → 效率分數、目前狀況
- `dtc_count` → 保養分數、目前狀況

門檻（畫面寫死，不在資料檔）

- 狀況「好」：超速 < 8%、怠速 < 8%、高負載 < 6%、DTC = 0
- 燈號：< 55 紅、< 70 黃、其餘綠；曲線虛線綠燈 = 70

## 車隊欄位（排名／平均）

- 全區 `regions[].drivers[]` 的上述四欄 + `c`
- 排名 = 該類現算分數在全部車號中的名次
- 平均 = 全隊該類現算分數的四捨五入平均

## 月序列（歷史曲線／車隊較上月）

活頁簿沒有單車月分數，曲線是所屬區 `regions[].series`，**最後一點不改成個人分數**。

- `months`（1月–11月）
- `series.safety` → 安全曲線
- `series.idle` → 效率曲線（`100 − idle × 1.2`）
- `series.dtc` → 保養曲線（`100 − dtc × 4`）
- `series.speed`、`series.idle` → 丟掉沒資料的月
- 「車隊較上月」= 該區曲線最後兩點相減（不是這台車）

## 畫面現算（不在原始檔）

- 安全 = `100 − overspeed_pct × 2`
- 效率 = `100 − idle_pct × 1.2 − high_load_pct × 1.5`
- 保養 = `100 − dtc_count × 4`
- 分數夾在 0–100

## AI 關心（只有司機頁）

依分數與變化猜一種心情，一句話：

- 超速 ≥ 15% 或安全 < 55 → 激進
- 怠速 ≥ 15% 或效率 < 55 → 疲憊
- 安全／效率／保養都 < 70 → 抑鬱
- 車隊安全曲線較上月 ≤ −8 → 緊繃
- 其餘 → 穩定

聊天回覆依關鍵字本地拼裝，沒接 `/api/chat`。

## 原始欄位對應（編譯進上述欄位）

安全：`gps.speed`、`gps.speedLimit` → `overspeed_pct`  
效率：`carStatus=2` → `idle_pct`；`can.engine.engineLoad ≥ 90` → `high_load_pct`  
保養：`event[0~2].info.dtcCodes[0]` → `dtc_count`

## 儀表板沒有用到

單車：`n`、`s`、`overspeed_count`、`idle_count`、`high_load_count`、`last_status`、`last_speed`、`last_limit`、`position`、`journeys`、`journey`、`i`

`score.md` 其餘欄位與事件（急加速、疲勞、安全帶、油耗、水溫、電瓶等）都沒接。

<!--
AI 閱讀說明 — 競賽計分（共用，不是某一身分的畫面）
對應程式：pages/competition/score.js
資料：excel-derived-data.js → window.HINO_EXCEL_DATA
三頁共用同一套 CATS（安全／效率／保養），改分數公式只改 score.js。

畫面實際計分只用四個編譯欄位：
  安全 overspeed_pct；效率 idle_pct + high_load_pct；保養 dtc_count。
本文「事件／欄位」是原始 telemetry 目錄。急加速、急減速、分心、手機、安全帶、疲勞等
有列在目錄裡，但競賽頁沒接、不算分。不要發明「平穩駕駛／急煞／分心／安全時段」當考核項。

沒有日資料、沒有開車中 HUD。曲線是區／全隊月序列，不是單車每日。
身分頁另見：driver.md、leader.md、boss.md。
-->

# 比賽三大類

識別、座標、狀態事件不計分，列在最後。

## 安全

欄位

- gps.speed（GPS 速度，km/h）
- gps.speedLimit（路段限速）
- can.canSpeed（CAN 速度，km/h）
- event[0~2].info.speed
- event[0~2].info.speedLimit
- event[0~2].info.speedDifference
- fenceId（圍籬編號）

事件（event.type）

- 5.fence（進入圍籬／離開圍籬）
- 6.accelerate（急加速）
- 7.decelerate（急減速）
- 8.speeding（超速／超速解除）
- 12.fatigue（疲勞駕駛）
- 13.seatbelt（未繫安全帶）
- 14.phone（使用通訊）
- 15.smoking（抽菸）
- 16.distract（分心）
- 17.lensWardOff（鏡頭遮蔽）
- 18.driverLost（駕駛消失）
- 19.pcs（預警式防護系統）
- 20.ldws（車道偏離警示系統）

## 效率

欄位

- carStatus（車輛狀態：0 parking／1 driving／2 idling）
- can.totalMileage（總里程數，km）
- line.fuelLevel（油量百分比）
- can.engine.totalFuelUsed（高精度燃油總用量，L）
- can.engine.rpm（引擎轉數）
- can.engine.engineLoad（引擎負載百分比）
- event[0~2].info.duration
- event[0~2].info.engineLoad

事件（event.type）

- 2.idle（怠速開始／解除）
- 11.engineOverloading（引擎過載／解除）

## 保養

欄位

- can.canStatus（CAN 狀態：0 正常／9 異常）
- line.battery（電瓶電壓，mV）
- can.engine.engineCoolantTemp（引擎冷卻水溫度，℃）
- can.engine.engineTotalTime（引擎運轉總時數，小時）
- event[0~2].info.dtcCount
- event[0~2].info.dtcCodes[0]
- event[0~2].info.waterTemp

事件（event.type）

- 9.dtc（DTC 錯誤碼）
- 10.engineOverheat（引擎過熱／解除）

## 非計分

- Type
- journeyCode（行程編號）
- time（時間）
- enabledCode（納管碼）
- carNum（車號）
- gps.longitude（經度）
- gps.latitude（緯度）
- gps.azimuth（方位角）
- event[0~2].type
- event[0~2].startTime
- event[0~2].endTime
- 1.driving（行駛中）
- 3.parked（熄火）
- 4.engineOn（引擎啟動）

## 單車模板（ABC-6325，3 筆）

從 `output` 表撈同一車號連續 3 筆。`journeyCode` 維持字串。這 3 筆沒有 event。

```json
[
  {
    "Type": 300,
    "journeyCode": "250121000001",
    "time": "2025-01-21 08:03:39",
    "carStatus": 1,
    "enabledCode": "60LBK6GREF",
    "carNum": "ABC-6325",
    "gps": {
      "longitude": 120.512245,
      "latitude": 24.163834,
      "speed": 0,
      "azimuth": 0.0,
      "speedLimit": 0
    },
    "can": {
      "canStatus": 0,
      "totalMileage": 2330.4,
      "canSpeed": 32,
      "engine": {
        "engineCoolantTemp": 17,
        "totalFuelUsed": 421.5,
        "engineTotalTime": 94.0,
        "rpm": 2469.375,
        "engineLoad": 55
      }
    },
    "line": {
      "fuelLevel": 65,
      "battery": 28204
    },
    "fenceId": null,
    "event": [
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      }
    ]
  },
  {
    "Type": 300,
    "journeyCode": "250121000001",
    "time": "2025-01-21 08:04:39",
    "carStatus": 1,
    "enabledCode": "60LBK6GREF",
    "carNum": "ABC-6325",
    "gps": {
      "longitude": 120.512245,
      "latitude": 24.163834,
      "speed": 0,
      "azimuth": 0.0,
      "speedLimit": 0
    },
    "can": {
      "canStatus": 0,
      "totalMileage": 2330.8,
      "canSpeed": 13,
      "engine": {
        "engineCoolantTemp": 24,
        "totalFuelUsed": 421.5,
        "engineTotalTime": 94.0,
        "rpm": 2230.75,
        "engineLoad": 81
      }
    },
    "line": {
      "fuelLevel": 60,
      "battery": 28142
    },
    "fenceId": null,
    "event": [
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      }
    ]
  },
  {
    "Type": 300,
    "journeyCode": "250121000001",
    "time": "2025-01-21 08:05:39",
    "carStatus": 1,
    "enabledCode": "60LBK6GREF",
    "carNum": "ABC-6325",
    "gps": {
      "longitude": 120.512245,
      "latitude": 24.163834,
      "speed": 0,
      "azimuth": 0.0,
      "speedLimit": 0
    },
    "can": {
      "canStatus": 0,
      "totalMileage": 2331,
      "canSpeed": 16,
      "engine": {
        "engineCoolantTemp": 29,
        "totalFuelUsed": 421.5,
        "engineTotalTime": 94.0,
        "rpm": 938.875,
        "engineLoad": 67
      }
    },
    "line": {
      "fuelLevel": 65,
      "battery": 28133
    },
    "fenceId": null,
    "event": [
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      },
      {
        "type": null,
        "startTime": null,
        "endTime": null,
        "info": {
          "duration": null,
          "speedDifference": null,
          "speedLimit": null,
          "speed": null,
          "dtcCount": null,
          "waterTemp": null,
          "engineLoad": null,
          "dtcCodes": [null]
        }
      }
    ]
  }
]
```

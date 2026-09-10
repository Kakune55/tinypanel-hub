# 天气接口

天气接口用于给面板端读取当前天气、逐小时预报和逐天预报。服务端会把和风天气响应转换成项目内部统一格式，面板端不需要直接调用和风天气。

## 配置

在 `etc/config.json` 中配置：

```json
{
  "weather": {
    "provider": "qweather",
    "api_host": "your-api-host.qweatherapi.com",
    "api_key": "your-api-key",
    "bearer_token": "",
    "location": "101020100",
    "lang": "zh",
    "unit": "m",
    "hours": "24h",
    "days": "3d",
    "cache_ttl": "10m",
    "timeout": "5s"
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `provider` | 天气来源。设为 `qweather` 时启用和风天气；设为 `manual` 或 `none` 时返回本地数据文件中的天气。 |
| `api_host` | 和风天气控制台中的 API Host，例如 `abcxyz.qweatherapi.com`。 |
| `api_key` | 和风天气 API Key。使用 `X-QW-Api-Key` 方式鉴权。 |
| `bearer_token` | 和风天气 JWT Token。填写后优先使用 `Authorization: Bearer ...` 方式鉴权。 |
| `location` | 和风天气 LocationID 或经纬度，例如 `101020100` 或 `121.47,31.23`。 |
| `lang` | 返回天气描述的语言，默认 `zh`。 |
| `unit` | 单位，默认 `m`，表示公制。 |
| `hours` | 逐小时预报范围，默认 `24h`。可选 `24h`、`72h`、`168h`。 |
| `days` | 逐天预报范围，默认 `3d`。可选 `3d`、`7d`、`10d`、`15d`、`30d`。 |
| `cache_ttl` | 本地懒加载缓存时间，默认 `10m`。 |
| `timeout` | 请求和风天气的 HTTP 超时时间，默认 `5s`。 |

## 缓存行为

`GET /api/v1/weather` 和 `GET /api/v1/snapshot` 共用同一个天气缓存。

- 第一次请求天气时，服务端会请求和风天气实时天气、逐小时预报和逐天预报接口。
- 缓存未过期时，后续请求直接返回内存中的天气结果。
- 默认 TTL 是 10 分钟，可通过 `weather.cache_ttl` 调整。
- 缓存过期后的下一次请求会重新请求和风天气。
- 请求和风天气失败时，接口返回 `502`，不会返回过期缓存。

## 获取当前天气

```http
GET /api/v1/weather
Authorization: Bearer alice-token
```

PowerShell 示例：

```powershell
$headers = @{ Authorization = "Bearer alice-token" }
Invoke-RestMethod http://localhost:8080/api/v1/weather -Headers $headers
```

成功响应：

```json
{
  "location": "101020100",
  "condition": "多云",
  "icon": "101",
  "temperature": 24,
  "humidity": 72,
  "updated_at": "2026-05-10T04:05:00Z",
  "hourly": [
    {
      "time": "2026-05-10T05:00:00Z",
      "condition": "阴",
      "icon": "104",
      "temperature": 25,
      "humidity": 70,
      "precipitation": 0,
      "precip_probability": 20,
      "wind_direction": "东南风",
      "wind_scale": "1-3",
      "wind_speed": 8
    }
  ],
  "daily": [
    {
      "date": "2026-05-10",
      "sunrise": "05:01",
      "sunset": "18:40",
      "condition_day": "多云",
      "condition_night": "小雨",
      "icon_day": "101",
      "icon_night": "305",
      "temperature_min": 20,
      "temperature_max": 28,
      "humidity": 75,
      "precipitation": 1.2,
      "wind_direction_day": "东南风",
      "wind_scale_day": "1-3",
      "wind_speed_day": 8,
      "wind_direction_night": "东北风",
      "wind_scale_night": "1-3",
      "wind_speed_night": 6
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `location` | string | 配置中的 `weather.location`。 |
| `condition` | string | 天气现象文本，来自和风天气 `now.text`。 |
| `icon` | string | 和风天气图标码，可用于面板端映射天气图标。 |
| `temperature` | number | 当前温度，公制单位下为摄氏度。 |
| `humidity` | number | 相对湿度百分比。 |
| `updated_at` | string | 天气观测时间，UTC ISO 8601 格式。优先使用和风天气 `now.obsTime`。 |
| `hourly` | array | 逐小时预报数组，范围由 `weather.hours` 决定。 |
| `daily` | array | 逐天预报数组，范围由 `weather.days` 决定。 |

逐小时预报字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `time` | string | 预报时间，UTC ISO 8601 格式。 |
| `condition` | string | 天气现象文本。 |
| `icon` | string | 和风天气图标码。 |
| `temperature` | number | 预报温度。 |
| `humidity` | number | 相对湿度百分比。 |
| `precipitation` | number | 逐小时累计降水量，单位毫米。 |
| `precip_probability` | number | 降水概率百分比。上游缺失或不可解析时省略。 |
| `wind_direction` | string | 风向。 |
| `wind_scale` | string | 风力等级。 |
| `wind_speed` | number | 风速，公制单位下为公里/小时。 |

逐天预报字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | string | 预报日期，`YYYY-MM-DD`。 |
| `sunrise` | string | 日出时间，本地时区 `HH:mm`。 |
| `sunset` | string | 日落时间，本地时区 `HH:mm`。 |
| `condition_day` | string | 白天天气现象文本。 |
| `condition_night` | string | 夜间天气现象文本。 |
| `icon_day` | string | 白天和风天气图标码。 |
| `icon_night` | string | 夜间和风天气图标码。 |
| `temperature_min` | number | 最低温度。 |
| `temperature_max` | number | 最高温度。 |
| `humidity` | number | 相对湿度百分比。 |
| `precipitation` | number | 当天累计降水量，单位毫米。 |
| `wind_direction_day` | string | 白天风向。 |
| `wind_scale_day` | string | 白天风力等级。 |
| `wind_speed_day` | number | 白天风速，公制单位下为公里/小时。 |
| `wind_direction_night` | string | 夜间风向。 |
| `wind_scale_night` | string | 夜间风力等级。 |
| `wind_speed_night` | number | 夜间风速，公制单位下为公里/小时。 |

## 面板快照中的天气

`GET /api/v1/snapshot` 是用户侧快照接口。启用和风天气后，快照里的 `weather` 字段同样来自天气缓存。消息和 TODO 会按当前用户过滤。遥测不进入快照，请使用 `GET /api/v1/devices/{device_id}/telemetry` 单独查询。

```http
GET /api/v1/snapshot
Authorization: Bearer alice-token
```

响应示例：

```json
{
  "weather": {
    "location": "101020100",
    "condition": "多云",
    "icon": "101",
    "temperature": 24,
    "humidity": 72,
    "updated_at": "2026-05-10T04:05:00Z",
    "hourly": [
      {
        "time": "2026-05-10T05:00:00Z",
        "condition": "阴",
        "icon": "104",
        "temperature": 25,
        "humidity": 70,
        "precipitation": 0,
        "precip_probability": 20,
        "wind_direction": "东南风",
        "wind_scale": "1-3",
        "wind_speed": 8
      }
    ],
    "daily": [
      {
        "date": "2026-05-10",
        "sunrise": "05:01",
        "sunset": "18:40",
        "condition_day": "多云",
        "condition_night": "小雨",
        "icon_day": "101",
        "icon_night": "305",
        "temperature_min": 20,
        "temperature_max": 28,
        "humidity": 75,
        "precipitation": 1.2,
        "wind_direction_day": "东南风",
        "wind_scale_day": "1-3",
        "wind_speed_day": 8,
        "wind_direction_night": "东北风",
        "wind_scale_night": "1-3",
        "wind_speed_night": 6
      }
    ]
  },
  "messages": [
    {
      "id": 1,
      "owner_id": "usr_x",
      "device_id": "tinypanel-001",
      "author_id": "usr_x",
      "body": "hello panel",
      "priority": "normal",
      "status": "pending",
      "created_at": "2026-05-10T04:00:00Z"
    }
  ]
}
```

## 错误响应

未携带或携带错误用户 Token：

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
WWW-Authenticate: Bearer realm="tinypanel-hub"
```

```json
{
  "error": "missing or invalid user token",
  "error_detail": {
    "code": "unauthorized",
    "message": "missing or invalid user token"
  }
}
```

和风天气请求失败、认证失败、响应解析失败或返回非 `200` 业务码时：

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json; charset=utf-8
```

```json
{
  "error": "weather provider error",
  "error_detail": {
    "code": "upstream_error",
    "message": "weather provider error"
  }
}
```

## 上游响应映射

服务端只保留面板端需要的字段：

| 和风天气字段 | tinypanel-hub 字段 |
| --- | --- |
| `now.text` | `condition` |
| `now.icon` | `icon` |
| `now.temp` | `temperature` |
| `now.humidity` | `humidity` |
| `now.obsTime` | `updated_at` |
| `hourly[].fxTime` | `hourly[].time` |
| `hourly[].text` | `hourly[].condition` |
| `hourly[].icon` | `hourly[].icon` |
| `hourly[].temp` | `hourly[].temperature` |
| `hourly[].pop` | `hourly[].precip_probability` |
| `hourly[].precip` | `hourly[].precipitation` |
| `daily[].fxDate` | `daily[].date` |
| `daily[].textDay` | `daily[].condition_day` |
| `daily[].textNight` | `daily[].condition_night` |
| `daily[].iconDay` | `daily[].icon_day` |
| `daily[].iconNight` | `daily[].icon_night` |
| `daily[].tempMin` | `daily[].temperature_min` |
| `daily[].tempMax` | `daily[].temperature_max` |
| 配置 `weather.location` | `location` |

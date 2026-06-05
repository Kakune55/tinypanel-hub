# 遥测接口

遥测接口用于设备向 Hub 上报运行状态。遥测数据继续使用 JSONL 追加保存，适合持续写入和后续离线分析。

## 鉴权

设备上报遥测必须使用设备凭据：

```http
X-Device-ID: tinypanel-001
X-Device-Secret: generated-secret
```

服务端会用认证后的设备 ID 覆盖请求体中的 `device_id`，避免设备冒充其他设备。

用户查询遥测使用用户 token：

```http
Authorization: Bearer alice-token
```

用户只能查询自己名下设备的遥测。

## 单条上报

```http
POST /api/v1/device/telemetry
X-Device-ID: tinypanel-001
X-Device-Secret: generated-secret
Content-Type: application/json
```

请求体参考 [遥测示例](遥测示例.json)。

必填字段：

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 当前必须为 `1` |
| `boot_id` | 本次启动 ID |
| `sequence` | 设备端递增序号，必须大于等于 `0` |
| `report_timestamp` | 设备生成遥测的时间 |

成功响应：`201 Created`

响应会补充服务端字段：

```json
{
  "id": 1,
  "schema_version": 1,
  "device_id": "tinypanel-001",
  "boot_id": "boot",
  "sequence": 1,
  "report_timestamp": "2026-05-21T00:00:00Z",
  "received_at": "2026-05-21T00:00:01Z",
  "app": {}
}
```

## 批量上报

```http
POST /api/v1/device/telemetry/batch
X-Device-ID: tinypanel-001
X-Device-Secret: generated-secret
Content-Type: application/json
```

请求体：

```json
{
  "items": [
    {
      "schema_version": 1,
      "boot_id": "boot",
      "sequence": 1,
      "report_timestamp": "2026-05-21T00:00:00Z",
      "power": { "battery": { "status": "discharging" } },
      "environment": { "shtc3": {} },
      "network": {},
      "system": {},
      "storage": {},
      "app": {}
    }
  ]
}
```

单次最多 100 条。

成功响应：

```json
{
  "count": 1,
  "items": []
}
```

## 用户查询设备遥测

```http
GET /api/v1/devices/{device_id}/telemetry?limit=50
Authorization: Bearer alice-token
```

`limit` 范围为 `1` 到 `5000`，默认 `50`。

响应按新到旧排序。

## 存储行为

- 遥测写入 `storage.telemetry_file` 指定的 JSONL 文件。
- 每行是一条完整 JSON。
- 服务启动时会读取最近数据，用于分配新的遥测 ID。
- 当前实现适合轻量使用；如果遥测量明显增大，可按日期拆分 JSONL 文件。

package domain

import "time"

type Weather struct {
	Location    string                  `json:"location"`
	Condition   string                  `json:"condition"`
	Icon        string                  `json:"icon,omitempty"`
	Temperature float64                 `json:"temperature"`
	Humidity    float64                 `json:"humidity"`
	UpdatedAt   time.Time               `json:"updated_at"`
	Hourly      []WeatherHourlyForecast `json:"hourly,omitempty"`
	Daily       []WeatherDailyForecast  `json:"daily,omitempty"`
}

type WeatherHourlyForecast struct {
	Time              time.Time `json:"time"`
	Condition         string    `json:"condition"`
	Icon              string    `json:"icon,omitempty"`
	Temperature       float64   `json:"temperature"`
	Humidity          float64   `json:"humidity"`
	Precipitation     float64   `json:"precipitation"`
	PrecipProbability *float64  `json:"precip_probability,omitempty"`
	WindDirection     string    `json:"wind_direction"`
	WindScale         string    `json:"wind_scale"`
	WindSpeed         float64   `json:"wind_speed"`
}

type WeatherDailyForecast struct {
	Date               string  `json:"date"`
	Sunrise            string  `json:"sunrise,omitempty"`
	Sunset             string  `json:"sunset,omitempty"`
	ConditionDay       string  `json:"condition_day"`
	ConditionNight     string  `json:"condition_night"`
	IconDay            string  `json:"icon_day,omitempty"`
	IconNight          string  `json:"icon_night,omitempty"`
	TemperatureMin     float64 `json:"temperature_min"`
	TemperatureMax     float64 `json:"temperature_max"`
	Humidity           float64 `json:"humidity"`
	Precipitation      float64 `json:"precipitation"`
	WindDirectionDay   string  `json:"wind_direction_day"`
	WindScaleDay       string  `json:"wind_scale_day"`
	WindSpeedDay       float64 `json:"wind_speed_day"`
	WindDirectionNight string  `json:"wind_direction_night"`
	WindScaleNight     string  `json:"wind_scale_night"`
	WindSpeedNight     float64 `json:"wind_speed_night"`
}

type Message struct {
	ID        int64      `json:"id"`
	OwnerID   string     `json:"owner_id"`
	DeviceID  string     `json:"device_id"`
	AuthorID  string     `json:"author_id"`
	Body      string     `json:"body"`
	Priority  string     `json:"priority"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	AckedAt   *time.Time `json:"acked_at,omitempty"`
}

type Todo struct {
	ID        int64     `json:"id"`
	OwnerID   string    `json:"owner_id"`
	Text      string    `json:"text"`
	Status    int       `json:"status"`
	Version   int64     `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TodoPatch struct {
	Text   *string
	Status *int
}

type Telemetry struct {
	ID              int64                `json:"id"`
	SchemaVersion   int                  `json:"schema_version"`
	DeviceID        string               `json:"device_id"`
	BootID          string               `json:"boot_id"`
	Sequence        int64                `json:"sequence"`
	ReportTimestamp time.Time            `json:"report_timestamp"`
	UptimeSeconds   int64                `json:"uptime_s"`
	Power           TelemetryPower       `json:"power"`
	Environment     TelemetryEnvironment `json:"environment"`
	Network         TelemetryNetwork     `json:"network"`
	System          TelemetrySystem      `json:"system"`
	Storage         TelemetryStorage     `json:"storage"`
	App             map[string]any       `json:"app"`
	ReceivedAt      time.Time            `json:"received_at"`
}

type Snapshot struct {
	Weather  Weather   `json:"weather"`
	Messages []Message `json:"messages"`
	Todos    []Todo    `json:"todos"`
}

const (
	MessagePriorityNormal = "normal"
	MessagePriorityHigh   = "high"
	MessageStatusPending  = "pending"
	MessageStatusAcked    = "acked"
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	APITokenHash string    `json:"api_token_hash,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type Device struct {
	ID                string     `json:"id"`
	OwnerID           string     `json:"owner_id,omitempty"`
	Name              string     `json:"name"`
	SecretHash        string     `json:"secret_hash,omitempty"`
	BindCode          string     `json:"bind_code,omitempty"`
	BindCodeExpiresAt *time.Time `json:"bind_code_expires_at,omitempty"`
	BoundAt           *time.Time `json:"bound_at,omitempty"`
	LastSeenAt        *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type DeviceHello struct {
	DeviceID     string     `json:"device_id"`
	DeviceSecret string     `json:"device_secret,omitempty"`
	Bound        bool       `json:"bound"`
	Name         string     `json:"name,omitempty"`
	BindCode     string     `json:"bind_code,omitempty"`
	BindCodeTTL  int        `json:"bind_code_ttl,omitempty"`
	ServerTime   time.Time  `json:"server_time"`
	BoundAt      *time.Time `json:"bound_at,omitempty"`
}

type TelemetryPower struct {
	Battery      TelemetryBattery `json:"battery"`
	USBConnected bool             `json:"usb_connected"`
}

type TelemetryBattery struct {
	RawADC       int     `json:"raw_adc"`
	RawVoltageMV int     `json:"raw_voltage_mv"`
	VoltageMV    int     `json:"voltage_mv"`
	Percentage   float64 `json:"percentage"`
	Status       string  `json:"status"`
}

type TelemetryEnvironment struct {
	SHTC3 TelemetrySHTC3 `json:"shtc3"`
}

type TelemetrySHTC3 struct {
	TemperatureC float64 `json:"temperature_c"`
	HumidityRH   float64 `json:"humidity_rh"`
	SensorOK     bool    `json:"sensor_ok"`
}

type TelemetryNetwork struct {
	WiFiConnected bool   `json:"wifi_connected"`
	SSID          string `json:"ssid"`
	RSSIDBM       int    `json:"rssi_dbm"`
	IP            string `json:"ip"`
}

type TelemetrySystem struct {
	FreeHeapBytes  int64 `json:"free_heap_bytes"`
	FreePSRAMBytes int64 `json:"free_psram_bytes"`
	NTPSync        bool  `json:"ntp_sync"`
}

type TelemetryStorage struct {
	SDCardPresent bool `json:"sd_card_present"`
	SDCardTotalMB int  `json:"sd_card_total_mb"`
	SDCardUsedMB  int  `json:"sd_card_used_mb"`
}

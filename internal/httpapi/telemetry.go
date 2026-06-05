package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"tinypanel-hub/internal/domain"
)

const telemetryLimitMax = 5000

func (s *Server) handleGetTelemetry(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 50, 1, telemetryLimitMax)
	writeJSON(w, http.StatusOK, s.services.Telemetry.List(limit))
}

func (s *Server) handleGetDeviceTelemetry(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	deviceID := pathString(r, "device_id")
	limit := queryInt(r, "limit", 50, 1, telemetryLimitMax)
	writeJSON(w, http.StatusOK, s.services.Telemetry.DeviceList(user.ID, deviceID, limit))
}

func (s *Server) handleDeviceTelemetry(w http.ResponseWriter, r *http.Request) {
	device, _ := currentDevice(r)
	var req domain.Telemetry
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := normalizeTelemetry(&req, device.ID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := s.services.Telemetry.Create(req)
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) handleDeviceTelemetryBatch(w http.ResponseWriter, r *http.Request) {
	device, _ := currentDevice(r)
	var req struct {
		Items []domain.Telemetry `json:"items"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "items is required")
		return
	}
	if len(req.Items) > 100 {
		writeError(w, http.StatusBadRequest, "items must not exceed 100")
		return
	}
	for i := range req.Items {
		if err := normalizeTelemetry(&req.Items[i], device.ID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	items, err := s.services.Telemetry.CreateBatch(req.Items)
	if err != nil {
		s.writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"count": len(items),
		"items": items,
	})
}

func normalizeTelemetry(item *domain.Telemetry, deviceID string) error {
	item.DeviceID = deviceID
	item.BootID = strings.TrimSpace(item.BootID)
	item.Power.Battery.Status = strings.TrimSpace(item.Power.Battery.Status)
	item.Network.SSID = strings.TrimSpace(item.Network.SSID)
	item.Network.IP = strings.TrimSpace(item.Network.IP)
	if item.DeviceID == "" {
		return errors.New("device_id is required")
	}
	if item.SchemaVersion != 1 {
		return errors.New("schema_version must be 1")
	}
	if item.BootID == "" {
		return errors.New("boot_id is required")
	}
	if item.Sequence < 0 {
		return errors.New("sequence must be greater than or equal to 0")
	}
	if item.ReportTimestamp.IsZero() {
		return errors.New("report_timestamp is required")
	}
	return nil
}

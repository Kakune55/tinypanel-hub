package store

import (
	"time"

	"tinypanel-hub/internal/domain"
)

func (s *FileStore) Telemetry(limit int) []domain.Telemetry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items, err := s.telemetry.loadRecent(limit)
	if err != nil {
		return nil
	}
	reverseTelemetry(items)
	return items
}

func (s *FileStore) DeviceTelemetry(ownerID, deviceID string, limit int) []domain.Telemetry {
	s.mu.RLock()
	deviceOwner := ""
	for _, device := range s.state.data.Devices {
		if device.ID == deviceID {
			deviceOwner = device.OwnerID
			break
		}
	}
	s.mu.RUnlock()
	if deviceOwner != ownerID {
		return nil
	}

	items, err := s.telemetry.loadRecent(maxTelemetryHistory)
	if err != nil {
		return nil
	}
	filtered := make([]domain.Telemetry, 0, len(items))
	for i := len(items) - 1; i >= 0; i-- {
		if items[i].DeviceID != deviceID {
			continue
		}
		filtered = append(filtered, items[i])
		if limit > 0 && len(filtered) >= limit {
			break
		}
	}
	return filtered
}

func (s *FileStore) AddTelemetry(t domain.Telemetry) (domain.Telemetry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	t.ID = s.nextTelemetryID
	t.ReceivedAt = now
	if t.ReportTimestamp.IsZero() {
		t.ReportTimestamp = now
	}
	if t.App == nil {
		t.App = map[string]any{}
	}

	if err := s.telemetry.append(t); err != nil {
		return domain.Telemetry{}, err
	}
	s.nextTelemetryID++
	return t, nil
}

func reverseTelemetry(items []domain.Telemetry) {
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
}

package store

import (
	"time"

	"tinypanel-hub/internal/domain"
)

func (s *FileStore) Snapshot(ownerID string) domain.Snapshot {
	s.mu.RLock()
	deviceIDs := s.ownerDeviceIDsLocked(ownerID)
	messages := s.ownerMessagesLocked(ownerID)
	todos := s.ownerTodosLocked(ownerID)
	weather := s.state.data.Weather
	s.mu.RUnlock()

	telemetry, err := s.telemetry.loadRecent(maxSnapshotTelemetry)
	if err != nil {
		telemetry = nil
	}
	telemetry = filterTelemetryByDevices(telemetry, deviceIDs, maxSnapshotTelemetry)
	reverseTelemetry(telemetry)
	return domain.Snapshot{
		Weather:   weather,
		Messages:  messages,
		Todos:     todos,
		Telemetry: telemetry,
	}
}

func (s *FileStore) Weather() domain.Weather {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state.data.Weather
}

func (s *FileStore) ownerDeviceIDsLocked(ownerID string) map[string]bool {
	out := map[string]bool{}
	for _, device := range s.state.data.Devices {
		if device.OwnerID == ownerID {
			out[device.ID] = true
		}
	}
	return out
}

func (s *FileStore) ownerMessagesLocked(ownerID string) []domain.Message {
	var out []domain.Message
	for i := len(s.state.data.Messages) - 1; i >= 0; i-- {
		msg := s.state.data.Messages[i]
		if msg.OwnerID == ownerID {
			out = append(out, msg)
		}
	}
	return out
}

func filterTelemetryByDevices(items []domain.Telemetry, deviceIDs map[string]bool, limit int) []domain.Telemetry {
	out := make([]domain.Telemetry, 0, len(items))
	for i := len(items) - 1; i >= 0; i-- {
		if !deviceIDs[items[i].DeviceID] {
			continue
		}
		out = append(out, items[i])
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func (s *FileStore) DeviceMessages(ownerID, deviceID string, limit int) []domain.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var out []domain.Message
	for i := len(s.state.data.Messages) - 1; i >= 0; i-- {
		msg := s.state.data.Messages[i]
		if msg.OwnerID != ownerID || msg.DeviceID != deviceID {
			continue
		}
		out = append(out, msg)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func (s *FileStore) AddDeviceMessage(ownerID, deviceID, authorID, body, priority string) (domain.Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if priority == "" {
		priority = domain.MessagePriorityNormal
	}
	msg := domain.Message{
		ID:        s.state.data.NextMessageID,
		OwnerID:   ownerID,
		DeviceID:  deviceID,
		AuthorID:  authorID,
		Body:      body,
		Priority:  priority,
		Status:    domain.MessageStatusPending,
		CreatedAt: time.Now().UTC(),
	}
	s.state.data.NextMessageID++
	s.state.data.Messages = append(s.state.data.Messages, msg)
	if len(s.state.data.Messages) > maxMessages {
		s.state.data.Messages = s.state.data.Messages[len(s.state.data.Messages)-maxMessages:]
	}
	return msg, s.state.save()
}

func (s *FileStore) PendingDeviceMessages(deviceID string, limit int) []domain.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var out []domain.Message
	for _, msg := range s.state.data.Messages {
		if msg.DeviceID != deviceID || msg.Status != domain.MessageStatusPending {
			continue
		}
		out = append(out, msg)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func (s *FileStore) AckDeviceMessages(deviceID string, messageIDs []int64) ([]int64, []int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	want := make(map[int64]bool, len(messageIDs))
	for _, id := range messageIDs {
		want[id] = true
	}

	var acked []int64
	for i := range s.state.data.Messages {
		msg := &s.state.data.Messages[i]
		if msg.DeviceID != deviceID || !want[msg.ID] {
			continue
		}
		if msg.Status != domain.MessageStatusAcked {
			msg.Status = domain.MessageStatusAcked
			msg.AckedAt = &now
		}
		acked = append(acked, msg.ID)
		delete(want, msg.ID)
	}

	missing := make([]int64, 0, len(want))
	for _, id := range messageIDs {
		if want[id] {
			missing = append(missing, id)
		}
	}
	return acked, missing, s.state.save()
}

package httpapi

import (
	"net/http"
	"strings"

	"tinypanel-hub/internal/domain"
)

func (s *Server) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r)
	snapshot, err := s.services.Snapshot.Get(r.Context(), user.ID)
	if err != nil {
		s.logger.Error("weather provider error", "err", err)
		writeError(w, http.StatusBadGateway, "weather provider error")
		return
	}
	if include := snapshotInclude(r); len(include) > 0 {
		writeJSON(w, http.StatusOK, filteredSnapshot(snapshot, include))
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (s *Server) handleDeviceSnapshot(w http.ResponseWriter, r *http.Request) {
	device, _ := currentDevice(r)
	weather, err := s.services.Weather.Get(r.Context())
	if err != nil {
		s.logger.Error("weather provider error", "err", err)
		writeError(w, http.StatusBadGateway, "weather provider error")
		return
	}
	writeJSON(w, http.StatusOK, domain.Snapshot{
		Weather:  weather,
		Messages: s.services.Messages.Pending(device.ID, 20),
		Todos:    s.services.Todos.List(device.OwnerID),
	})
}

func snapshotInclude(r *http.Request) map[string]bool {
	raw := strings.TrimSpace(r.URL.Query().Get("include"))
	if raw == "" {
		return nil
	}
	include := map[string]bool{}
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			include[item] = true
		}
	}
	return include
}

func filteredSnapshot(snapshot domain.Snapshot, include map[string]bool) map[string]any {
	out := map[string]any{}
	if include["weather"] {
		out["weather"] = snapshot.Weather
	}
	if include["messages"] {
		out["messages"] = snapshot.Messages
	}
	if include["todos"] {
		out["todos"] = snapshot.Todos
	}
	return out
}

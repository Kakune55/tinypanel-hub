package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"tinypanel-hub/internal/domain"
)

func TestTelemetryUsesJSONL(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "state.json")
	telemetryPath := filepath.Join(dir, "telemetry.jsonl")

	s, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}

	first := telemetryFixture(1)
	second := telemetryFixture(2)
	if _, err := s.AddTelemetry(first); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddTelemetry(second); err != nil {
		t.Fatal(err)
	}

	b, err := os.ReadFile(telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) != 2 {
		t.Fatalf("jsonl lines = %d, want 2; content=%s", len(lines), b)
	}

	var stored domain.Telemetry
	if err := json.Unmarshal([]byte(lines[0]), &stored); err != nil {
		t.Fatal(err)
	}
	if stored.ID != 1 || stored.Sequence != 1 {
		t.Fatalf("first telemetry = %+v", stored)
	}

	got := s.Telemetry(2)
	if len(got) != 2 || got[0].ID != 2 || got[1].ID != 1 {
		t.Fatalf("telemetry order = %+v", got)
	}
}

func TestDeviceTelemetryKeepsExtendedHistory(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "state.json")
	telemetryPath := filepath.Join(dir, "telemetry.jsonl")

	s, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	user, err := s.CreateUser("Alice", "alice@example.com", "user-token-hash")
	if err != nil {
		t.Fatal(err)
	}
	hello, err := s.HelloDevice("tinypanel-001", "device-secret-hash")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, bound, err := s.BindDevice(user.ID, hello.BindCode, "书桌屏幕"); err != nil || !bound {
		t.Fatalf("bind bound=%v err=%v", bound, err)
	}

	for i := int64(1); i <= 700; i++ {
		if _, err := s.AddTelemetry(telemetryFixture(i)); err != nil {
			t.Fatal(err)
		}
	}

	got := s.DeviceTelemetry(user.ID, "tinypanel-001", 650)
	if len(got) != 650 {
		t.Fatalf("device telemetry len = %d, want 650", len(got))
	}
	if got[0].ID != 700 || got[len(got)-1].ID != 51 {
		t.Fatalf("device telemetry window first=%d last=%d", got[0].ID, got[len(got)-1].ID)
	}
}

func TestDeviceBindingAndMessagesPersist(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "state.json")
	telemetryPath := filepath.Join(dir, "telemetry.jsonl")

	s, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	user, err := s.CreateUser("Alice", "alice@example.com", "user-token-hash")
	if err != nil {
		t.Fatal(err)
	}
	hello, err := s.HelloDevice("tinypanel-001", "device-secret-hash")
	if err != nil {
		t.Fatal(err)
	}
	if hello.Bound || hello.BindCode == "" {
		t.Fatalf("hello = %+v", hello)
	}
	device, found, bound, err := s.BindDevice(user.ID, hello.BindCode, "书桌屏幕")
	if err != nil {
		t.Fatal(err)
	}
	if !found || !bound || device.OwnerID != user.ID {
		t.Fatalf("bind device=%+v found=%v bound=%v", device, found, bound)
	}

	msg, err := s.AddDeviceMessage(user.ID, device.ID, user.ID, "hello", domain.MessagePriorityNormal)
	if err != nil {
		t.Fatal(err)
	}
	acked, missing, err := s.AckDeviceMessages(device.ID, []int64{msg.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(acked) != 1 || len(missing) != 0 {
		t.Fatalf("acked=%v missing=%v", acked, missing)
	}
	reopened, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := reopened.UserByTokenHash("user-token-hash"); !ok {
		t.Fatalf("user not persisted")
	}
	if _, ok := reopened.Device(user.ID, device.ID); !ok {
		t.Fatalf("device not persisted")
	}
	pending := reopened.PendingDeviceMessages(device.ID, 10)
	if len(pending) != 0 {
		t.Fatalf("pending after ack = %+v", pending)
	}
}

func TestUserDeviceIsolation(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "state.json")
	telemetryPath := filepath.Join(dir, "telemetry.jsonl")

	s, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	alice, err := s.CreateUser("Alice", "alice@example.com", "alice-hash")
	if err != nil {
		t.Fatal(err)
	}
	bob, err := s.CreateUser("Bob", "bob@example.com", "bob-hash")
	if err != nil {
		t.Fatal(err)
	}
	hello, err := s.HelloDevice("tinypanel-001", "device-secret-hash")
	if err != nil {
		t.Fatal(err)
	}
	device, _, bound, err := s.BindDevice(alice.ID, hello.BindCode, "书桌屏幕")
	if err != nil || !bound {
		t.Fatalf("bind device=%+v bound=%v err=%v", device, bound, err)
	}
	if devices := s.Devices(bob.ID); len(devices) != 0 {
		t.Fatalf("bob devices = %+v", devices)
	}
	if _, ok := s.Device(bob.ID, device.ID); ok {
		t.Fatalf("bob should not access alice device")
	}
	if _, err := s.AddDeviceMessage(alice.ID, device.ID, alice.ID, "hello", domain.MessagePriorityNormal); err != nil {
		t.Fatal(err)
	}
	if got := s.DeviceMessages(bob.ID, device.ID, 10); len(got) != 0 {
		t.Fatalf("bob messages = %+v", got)
	}
}

func TestTodosPersistAndUseCAS(t *testing.T) {
	dir := t.TempDir()
	statePath := filepath.Join(dir, "state.json")
	telemetryPath := filepath.Join(dir, "telemetry.jsonl")

	s, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	ownerID := "usr_test"
	todo, err := s.AddTodo(ownerID, "写 TODO 功能", 0)
	if err != nil {
		t.Fatal(err)
	}
	if todo.ID != 1 || todo.Version != 1 {
		t.Fatalf("created todo = %+v", todo)
	}

	status := 1
	updated, found, swapped, err := s.UpdateTodo(ownerID, todo.ID, todo.Version, domain.TodoPatch{Status: &status})
	if err != nil {
		t.Fatal(err)
	}
	if !found || !swapped || updated.Status != 1 || updated.Version != 2 {
		t.Fatalf("updated=%+v found=%v swapped=%v", updated, found, swapped)
	}

	status = 2
	_, found, swapped, err = s.UpdateTodo(ownerID, todo.ID, 1, domain.TodoPatch{Status: &status})
	if err != nil {
		t.Fatal(err)
	}
	if !found || swapped {
		t.Fatalf("stale update found=%v swapped=%v", found, swapped)
	}

	reopened, err := OpenFiles(statePath, telemetryPath)
	if err != nil {
		t.Fatal(err)
	}
	got, ok := reopened.Todo(ownerID, todo.ID)
	if !ok || got.Status != 1 || got.Version != 2 {
		t.Fatalf("reopened todo = %+v ok=%v", got, ok)
	}

	found, swapped, err = reopened.DeleteTodo(ownerID, todo.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !found || swapped {
		t.Fatalf("stale delete found=%v swapped=%v", found, swapped)
	}

	found, swapped, err = reopened.DeleteTodo(ownerID, todo.ID, 2)
	if err != nil {
		t.Fatal(err)
	}
	if !found || !swapped {
		t.Fatalf("delete found=%v swapped=%v", found, swapped)
	}
}

func telemetryFixture(sequence int64) domain.Telemetry {
	return domain.Telemetry{
		SchemaVersion:   1,
		DeviceID:        "tinypanel-001",
		BootID:          "boot",
		Sequence:        sequence,
		ReportTimestamp: time.Date(2026, 5, 10, 16, 20, 0, 0, time.UTC),
		App:             map[string]any{},
	}
}

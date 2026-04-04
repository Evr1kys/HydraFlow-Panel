package panel

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// EventType identifies the kind of real-time event.
type EventType string

const (
	EventConnection   EventType = "connection"
	EventDisconnect   EventType = "disconnect"
	EventTraffic      EventType = "traffic"
	EventBlocking     EventType = "blocking"
	EventInboundState EventType = "inbound_state"
	EventStatus       EventType = "status"
)

// Event is a real-time event broadcast to connected clients.
type Event struct {
	Type      EventType   `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// Hub manages real-time event broadcasting to connected clients.
// It uses Server-Sent Events (SSE) for simplicity and broad
// browser support without external WebSocket dependencies.
type Hub struct {
	mu      sync.RWMutex
	clients map[*sseClient]struct{}
	logger  *slog.Logger
}

// sseClient represents a connected SSE client.
type sseClient struct {
	events     chan *Event
	done       chan struct{}
	subscribed map[EventType]bool
}

// NewHub creates a new real-time event hub.
func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		clients: make(map[*sseClient]struct{}),
		logger:  logger,
	}
}

// Broadcast sends an event to all connected clients that are
// subscribed to the event type.
func (h *Hub) Broadcast(event *Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	for client := range h.clients {
		// If client subscribed to specific types, filter.
		if len(client.subscribed) > 0 && !client.subscribed[event.Type] {
			continue
		}

		select {
		case client.events <- event:
		default:
			// Client is slow, drop the event to prevent blocking.
			h.logger.Debug("dropping event for slow client",
				"type", event.Type,
			)
		}
	}
}

// BroadcastConnection notifies about a new connection.
func (h *Hub) BroadcastConnection(protocol, remoteAddr string) {
	h.Broadcast(&Event{
		Type: EventConnection,
		Data: map[string]string{
			"protocol": protocol,
			"remote":   remoteAddr,
		},
	})
}

// BroadcastDisconnect notifies about a disconnection.
func (h *Hub) BroadcastDisconnect(protocol, remoteAddr, reason string) {
	h.Broadcast(&Event{
		Type: EventDisconnect,
		Data: map[string]string{
			"protocol": protocol,
			"remote":   remoteAddr,
			"reason":   reason,
		},
	})
}

// BroadcastTraffic sends a traffic update.
func (h *Hub) BroadcastTraffic(totalUp, totalDown, connections int64) {
	h.Broadcast(&Event{
		Type: EventTraffic,
		Data: map[string]int64{
			"total_up":    totalUp,
			"total_down":  totalDown,
			"connections": connections,
		},
	})
}

// BroadcastBlocking sends a blocking report event.
func (h *Hub) BroadcastBlocking(isp, protocol, status string) {
	h.Broadcast(&Event{
		Type: EventBlocking,
		Data: map[string]string{
			"isp":      isp,
			"protocol": protocol,
			"status":   status,
		},
	})
}

// ClientCount returns the number of connected SSE clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ServeHTTP handles SSE connections. Clients can subscribe to specific
// event types via the ?events=connection,traffic query parameter.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Ensure the response writer supports flushing.
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Check if the connection supports hijacking for detecting client disconnect.
	// We also watch the request context.
	ctx := r.Context()

	// Set SSE headers.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Parse event type subscriptions.
	subscribed := make(map[EventType]bool)
	if types := r.URL.Query().Get("events"); types != "" {
		for _, t := range splitCSV(types) {
			subscribed[EventType(t)] = true
		}
	}

	client := &sseClient{
		events:     make(chan *Event, 64),
		done:       make(chan struct{}),
		subscribed: subscribed,
	}

	h.mu.Lock()
	h.clients[client] = struct{}{}
	h.mu.Unlock()

	h.logger.Debug("SSE client connected",
		"remote", r.RemoteAddr,
		"subscriptions", len(subscribed),
	)

	// Send initial ping.
	fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	// Keepalive ticker.
	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()

	defer func() {
		h.mu.Lock()
		delete(h.clients, client)
		h.mu.Unlock()
		close(client.done)

		h.logger.Debug("SSE client disconnected",
			"remote", r.RemoteAddr,
		)
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-client.events:
			data, err := json.Marshal(event)
			if err != nil {
				h.logger.Error("failed to marshal event", "error", err)
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
			flusher.Flush()
		case <-keepalive.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

// splitCSV splits a comma-separated string into trimmed parts.
func splitCSV(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			// Trim spaces.
			for len(part) > 0 && part[0] == ' ' {
				part = part[1:]
			}
			for len(part) > 0 && part[len(part)-1] == ' ' {
				part = part[:len(part)-1]
			}
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}

// StartTrafficBroadcast starts a goroutine that periodically broadcasts
// traffic statistics to connected SSE clients.
func (h *Hub) StartTrafficBroadcast(db Database, interval time.Duration, stopCh <-chan struct{}) {
	if interval <= 0 {
		interval = 5 * time.Second
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				if h.ClientCount() == 0 {
					continue // no one listening
				}

				clients, err := db.ListClients()
				if err != nil {
					continue
				}

				var totalUp, totalDown int64
				for _, c := range clients {
					totalUp += c.TrafficUp
					totalDown += c.TrafficDown
				}

				h.BroadcastTraffic(totalUp, totalDown, int64(len(clients)))
			}
		}
	}()
}

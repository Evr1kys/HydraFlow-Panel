package main

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

type ProtocolHealth struct {
	Protocol string `json:"protocol"`
	Port     int    `json:"port"`
	Status   string `json:"status"`
	Latency  int64  `json:"latency"`
}

type HealthCache struct {
	mu      sync.RWMutex
	results []ProtocolHealth
	updated time.Time
	ttl     time.Duration
}

func NewHealthCache() *HealthCache {
	return &HealthCache{
		ttl: 5 * time.Minute,
	}
}

func (hc *HealthCache) Get() ([]ProtocolHealth, bool) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	if hc.results == nil || time.Since(hc.updated) > hc.ttl {
		return nil, false
	}
	cp := make([]ProtocolHealth, len(hc.results))
	copy(cp, hc.results)
	return cp, true
}

func (hc *HealthCache) Set(results []ProtocolHealth) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	hc.results = results
	hc.updated = time.Now()
}

func checkPort(port int, timeout time.Duration) (bool, int64) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), timeout)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return false, latency
	}
	_ = conn.Close()
	return true, latency
}

func checkProtocolHealth(settings ServerSettings) []ProtocolHealth {
	var results []ProtocolHealth
	timeout := 3 * time.Second

	if settings.Reality.Enabled {
		up, lat := checkPort(settings.Reality.Port, timeout)
		status := "down"
		if up {
			status = "up"
		}
		results = append(results, ProtocolHealth{
			Protocol: "VLESS+Reality",
			Port:     settings.Reality.Port,
			Status:   status,
			Latency:  lat,
		})
	}

	if settings.WS.Enabled {
		up, lat := checkPort(settings.WS.Port, timeout)
		status := "down"
		if up {
			status = "up"
		}
		results = append(results, ProtocolHealth{
			Protocol: "VLESS+WS",
			Port:     settings.WS.Port,
			Status:   status,
			Latency:  lat,
		})
	}

	if settings.SS.Enabled {
		up, lat := checkPort(settings.SS.Port, timeout)
		status := "down"
		if up {
			status = "up"
		}
		results = append(results, ProtocolHealth{
			Protocol: "Shadowsocks",
			Port:     settings.SS.Port,
			Status:   status,
			Latency:  lat,
		})
	}

	return results
}

func (h *Handler) ProtocolHealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		jsonError(w, 405, "method not allowed")
		return
	}

	if cached, ok := h.healthCache.Get(); ok {
		jsonResponse(w, 200, cached)
		return
	}

	results := checkProtocolHealth(h.db.Data.Settings)
	h.healthCache.Set(results)
	jsonResponse(w, 200, results)
}

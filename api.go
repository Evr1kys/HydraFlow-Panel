package panel

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

// API implements the REST API handlers for the admin panel.
type API struct {
	db      Database
	auth    *Auth
	hub     *Hub
	xray    *XrayIntegration
	logger  *slog.Logger
	startAt time.Time
}

// NewAPI creates a new API handler set.
func NewAPI(db Database, auth *Auth, hub *Hub, xray *XrayIntegration, logger *slog.Logger) *API {
	return &API{
		db:      db,
		auth:    auth,
		hub:     hub,
		xray:    xray,
		logger:  logger,
		startAt: time.Now(),
	}
}

// RegisterRoutes registers all API endpoints on the given mux.
func (a *API) RegisterRoutes(mux *http.ServeMux) {
	// Public endpoints.
	mux.HandleFunc("/api/v1/auth/login", a.handleLogin)
	mux.HandleFunc("/api/v1/health", a.handleHealth)

	// Subscription (public, token-based).
	mux.HandleFunc("/sub/", a.handleSubscription)

	// Protected endpoints.
	mux.HandleFunc("/api/v1/auth/refresh", a.auth.Middleware(a.handleRefreshToken))
	mux.HandleFunc("/api/v1/auth/password", a.auth.Middleware(a.handleChangePassword))
	mux.HandleFunc("/api/v1/status", a.auth.Middleware(a.handleStatus))
	mux.HandleFunc("/api/v1/clients", a.auth.Middleware(a.handleClients))
	mux.HandleFunc("/api/v1/clients/", a.auth.Middleware(a.handleClientByID))
	mux.HandleFunc("/api/v1/servers", a.auth.Middleware(a.handleServers))
	mux.HandleFunc("/api/v1/servers/", a.auth.Middleware(a.handleServerByID))
	mux.HandleFunc("/api/v1/settings", a.auth.Middleware(a.handleSettings))
	mux.HandleFunc("/api/v1/xray/status", a.auth.Middleware(a.handleXrayStatus))
	mux.HandleFunc("/api/v1/xray/restart", a.auth.Middleware(a.handleXrayRestart))
	mux.HandleFunc("/api/v1/xray/stop", a.auth.Middleware(a.handleXrayStop))
	mux.HandleFunc("/api/v1/xray/start", a.auth.Middleware(a.handleXrayStart))
	mux.HandleFunc("/api/v1/xray/config", a.auth.Middleware(a.handleXrayConfig))
	mux.HandleFunc("/api/v1/metrics", a.auth.Middleware(a.handleMetrics))
	mux.HandleFunc("/api/v1/inbounds", a.auth.Middleware(a.handleInbounds))

	// SSE events.
	mux.HandleFunc("/api/v1/events", a.auth.Middleware(a.hub.ServeHTTP))
}

// --- Auth ---

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string `json:"token"`
	ExpiresIn int64  `json:"expires_in"`
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req loginRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	token, err := a.auth.Login(req.Username, req.Password)
	if err != nil {
		a.logger.Warn("login failed", "username", req.Username, "remote", r.RemoteAddr)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	a.logger.Info("admin login", "username", req.Username, "remote", r.RemoteAddr)
	writeJSON(w, http.StatusOK, loginResponse{
		Token:     token,
		ExpiresIn: int64(a.auth.sessionTimeout.Seconds()),
	})
}

func (a *API) handleRefreshToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	newToken, err := a.auth.RefreshToken(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "could not refresh token"})
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{
		Token:     newToken,
		ExpiresIn: int64(a.auth.sessionTimeout.Seconds()),
	})
}

func (a *API) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.NewPassword == "" || len(req.NewPassword) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 4 characters"})
		return
	}
	admin, _ := a.db.GetAdmin()
	if admin == nil || !CheckPassword(admin.PasswordHash, req.OldPassword) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid old password"})
		return
	}
	hash, err := HashPassword(req.NewPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
		return
	}
	admin.PasswordHash = hash
	a.db.SetAdmin(admin)
	a.logger.Info("admin password changed")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Health (public) ---

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	xrayStatus := a.xray.GetXrayStatus()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok",
		"xray":   xrayStatus.Running,
	})
}

// --- Status ---

func (a *API) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	clients, _ := a.db.ListClients()
	servers, _ := a.db.ListServers()
	settings, _ := a.db.GetSettings()

	var totalUp, totalDown int64
	var enabledClients, disabledClients int
	for _, c := range clients {
		totalUp += c.TrafficUp
		totalDown += c.TrafficDown
		if c.Enabled && !c.IsExpired() {
			enabledClients++
		} else {
			disabledClients++
		}
	}

	var onlineServers int
	for _, s := range servers {
		if s.Status == "online" {
			onlineServers++
		}
	}

	xrayStatus := a.xray.GetXrayStatus()
	uptime := time.Since(a.startAt)

	// System info.
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Active protocols.
	var protocols []string
	if settings != nil {
		if settings.RealityEnabled {
			protocols = append(protocols, "VLESS Reality")
		}
		if settings.VLESSWSEnabled {
			protocols = append(protocols, "VLESS WS")
		}
		if settings.VMessWSEnabled {
			protocols = append(protocols, "VMess WS")
		}
		if settings.SSEnabled {
			protocols = append(protocols, "Shadowsocks")
		}
		if settings.TrojanEnabled {
			protocols = append(protocols, "Trojan")
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":             "running",
		"uptime":             uptime.Round(time.Second).String(),
		"uptime_seconds":     int64(uptime.Seconds()),
		"total_clients":      len(clients),
		"enabled_clients":    enabledClients,
		"disabled_clients":   disabledClients,
		"total_traffic_up":   totalUp,
		"total_traffic_down": totalDown,
		"online_servers":     onlineServers,
		"total_servers":      len(servers),
		"xray":               xrayStatus,
		"protocols":          protocols,
		"system": map[string]interface{}{
			"go_version":   runtime.Version(),
			"os":           runtime.GOOS,
			"arch":         runtime.GOARCH,
			"cpus":         runtime.NumCPU(),
			"goroutines":   runtime.NumGoroutine(),
			"mem_alloc_mb": memStats.Alloc / 1024 / 1024,
			"mem_sys_mb":   memStats.Sys / 1024 / 1024,
		},
		"sse_connections": a.hub.ClientCount(),
	})
}

// --- Clients ---

func (a *API) handleClients(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listClients(w, r)
	case http.MethodPost:
		a.createClient(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (a *API) listClients(w http.ResponseWriter, r *http.Request) {
	clients, err := a.db.ListClients()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list clients"})
		return
	}

	settings, _ := a.db.GetSettings()
	subDomain := ""
	if settings != nil {
		subDomain = settings.SubDomain
		if subDomain == "" {
			subDomain = settings.ServerIP
		}
	}

	type clientResponse struct {
		*Client
		SubURL    string `json:"sub_url"`
		Expired   bool   `json:"expired"`
		OverLimit bool   `json:"over_limit"`
	}

	result := make([]clientResponse, len(clients))
	for i, c := range clients {
		subURL := ""
		if subDomain != "" {
			subURL = fmt.Sprintf("https://%s/sub/%s", subDomain, c.SubscriptionToken)
		} else {
			subURL = fmt.Sprintf("/sub/%s", c.SubscriptionToken)
		}
		result[i] = clientResponse{
			Client:    c,
			SubURL:    subURL,
			Expired:   c.IsExpired(),
			OverLimit: c.IsOverLimit(),
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"clients": result,
		"total":   len(result),
	})
}

type createClientRequest struct {
	Email        string `json:"email"`
	TrafficLimit int64  `json:"traffic_limit"`
	ExpiryDays   int    `json:"expiry_days"`
	Enabled      *bool  `json:"enabled"`
}

func (a *API) createClient(w http.ResponseWriter, r *http.Request) {
	var req createClientRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	clientID := generateShortID()
	clientUUID := uuid.New().String()
	subToken := generateSubToken()

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	var expiry time.Time
	if req.ExpiryDays > 0 {
		expiry = time.Now().Add(time.Duration(req.ExpiryDays) * 24 * time.Hour)
	}

	client := &Client{
		ID:                clientID,
		Email:             req.Email,
		UUID:              clientUUID,
		TrafficLimit:      req.TrafficLimit,
		ExpiryDate:        expiry,
		Enabled:           enabled,
		SubscriptionToken: subToken,
	}

	if err := a.db.CreateClient(client); err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}

	a.logger.Info("client created", "email", client.Email, "id", client.ID)

	// Sync xray config to add the new user.
	if err := a.xray.SyncConfigAndReload(); err != nil {
		a.logger.Error("failed to sync xray after client creation", "error", err)
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"ok":     true,
		"client": client,
	})
}

func (a *API) handleClientByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/clients/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "client ID required"})
		return
	}
	clientID := parts[0]
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}

	switch action {
	case "toggle":
		a.toggleClient(w, r, clientID)
	case "reset-traffic":
		a.resetClientTraffic(w, r, clientID)
	case "subscription":
		a.handleClientSubscription(w, r, clientID)
	case "":
		switch r.Method {
		case http.MethodGet:
			a.getClient(w, r, clientID)
		case http.MethodPut:
			a.updateClient(w, r, clientID)
		case http.MethodDelete:
			a.deleteClient(w, r, clientID)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown action"})
	}
}

func (a *API) getClient(w http.ResponseWriter, r *http.Request, id string) {
	client, err := a.db.GetClient(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, client)
}

func (a *API) updateClient(w http.ResponseWriter, r *http.Request, id string) {
	existing, err := a.db.GetClient(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	var updates struct {
		Email        string    `json:"email"`
		TrafficLimit *int64    `json:"traffic_limit"`
		ExpiryDate   time.Time `json:"expiry_date"`
		ExpiryDays   int       `json:"expiry_days"`
		Enabled      *bool     `json:"enabled"`
	}
	if err := readJSON(r, &updates); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if updates.Email != "" {
		existing.Email = updates.Email
	}
	if updates.TrafficLimit != nil {
		existing.TrafficLimit = *updates.TrafficLimit
	}
	if !updates.ExpiryDate.IsZero() {
		existing.ExpiryDate = updates.ExpiryDate
	}
	if updates.ExpiryDays > 0 {
		existing.ExpiryDate = time.Now().Add(time.Duration(updates.ExpiryDays) * 24 * time.Hour)
	}
	if updates.Enabled != nil {
		existing.Enabled = *updates.Enabled
	}

	if err := a.db.UpdateClient(existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	a.logger.Info("client updated", "id", id)

	// Sync xray config.
	if err := a.xray.SyncConfigAndReload(); err != nil {
		a.logger.Error("failed to sync xray after client update", "error", err)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "client": existing})
}

func (a *API) deleteClient(w http.ResponseWriter, r *http.Request, id string) {
	client, err := a.db.GetClient(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	if err := a.db.DeleteClient(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	a.logger.Info("client deleted", "id", id, "email", client.Email)

	// Sync xray config to remove the user.
	if err := a.xray.SyncConfigAndReload(); err != nil {
		a.logger.Error("failed to sync xray after client deletion", "error", err)
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) toggleClient(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	client, err := a.db.GetClient(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	client.Enabled = !client.Enabled
	a.db.UpdateClient(client)

	if err := a.xray.SyncConfigAndReload(); err != nil {
		a.logger.Error("failed to sync xray after toggle", "error", err)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "enabled": client.Enabled})
}

func (a *API) resetClientTraffic(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := a.db.SetClientTraffic(id, 0, 0); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	a.logger.Info("client traffic reset", "id", id)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleClientSubscription(w http.ResponseWriter, r *http.Request, id string) {
	client, err := a.db.GetClient(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	settings, _ := a.db.GetSettings()
	serverAddr := ""
	if settings != nil {
		serverAddr = settings.SubDomain
		if serverAddr == "" {
			serverAddr = settings.ServerIP
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"client_id": client.ID,
		"email":     client.Email,
		"sub_url":   fmt.Sprintf("https://%s/sub/%s", serverAddr, client.SubscriptionToken),
		"sub_token": client.SubscriptionToken,
	})
}

// --- Servers (multi-server) ---

func (a *API) handleServers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listServers(w, r)
	case http.MethodPost:
		a.createServer(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (a *API) listServers(w http.ResponseWriter, r *http.Request) {
	servers, err := a.db.ListServers()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"servers": servers,
		"total":   len(servers),
	})
}

func (a *API) createServer(w http.ResponseWriter, r *http.Request) {
	var srv RemoteServer
	if err := readJSON(r, &srv); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if srv.Address == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "address is required"})
		return
	}
	if srv.Port <= 0 {
		srv.Port = 2080
	}
	if srv.Name == "" {
		srv.Name = srv.Address
	}
	srv.ID = generateShortID()
	srv.Status = "unknown"
	srv.Enabled = true

	if err := a.db.CreateServer(&srv); err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}

	a.logger.Info("remote server added", "name", srv.Name, "address", srv.Address)
	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "server": srv})
}

func (a *API) handleServerByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/servers/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "server ID required"})
		return
	}
	serverID := parts[0]

	switch r.Method {
	case http.MethodGet:
		srv, err := a.db.GetServer(serverID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, srv)
	case http.MethodPut:
		existing, err := a.db.GetServer(serverID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		var updates RemoteServer
		if err := readJSON(r, &updates); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if updates.Name != "" {
			existing.Name = updates.Name
		}
		if updates.Address != "" {
			existing.Address = updates.Address
		}
		if updates.Port > 0 {
			existing.Port = updates.Port
		}
		if updates.APIKey != "" {
			existing.APIKey = updates.APIKey
		}
		existing.Enabled = updates.Enabled
		a.db.UpdateServer(existing)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "server": existing})
	case http.MethodDelete:
		if err := a.db.DeleteServer(serverID); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		a.logger.Info("remote server deleted", "id", serverID)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// --- Xray Management ---

func (a *API) handleXrayStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	status := a.xray.GetXrayStatus()
	writeJSON(w, http.StatusOK, status)
}

func (a *API) handleXrayRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := a.xray.RestartXray(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	a.logger.Info("xray restarted via panel")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleXrayStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := a.xray.StopXray(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	a.logger.Info("xray stopped via panel")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleXrayStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := a.xray.StartXray(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	a.logger.Info("xray started via panel")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleXrayConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	// Read the current xray config file.
	configPath := a.xray.Manager().Builder().LogLevel // not this, read from manager config
	_ = configPath

	data, err := os.ReadFile("/etc/hydraflow/xray.json")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"config": "config file not found: " + err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// --- Inbounds (read-only, derived from settings) ---

func (a *API) handleInbounds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	settings, _ := a.db.GetSettings()
	if settings == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"inbounds": []interface{}{}, "total": 0})
		return
	}

	type inboundInfo struct {
		Tag      string `json:"tag"`
		Protocol string `json:"protocol"`
		Port     int    `json:"port"`
		Enabled  bool   `json:"enabled"`
		CDN      bool   `json:"cdn_compatible"`
	}

	var inbounds []inboundInfo
	if settings.RealityEnabled {
		inbounds = append(inbounds, inboundInfo{
			Tag: "vless-reality", Protocol: "VLESS Reality",
			Port: settings.RealityPort, Enabled: true, CDN: false,
		})
	}
	if settings.VLESSWSEnabled {
		inbounds = append(inbounds, inboundInfo{
			Tag: "vless-ws", Protocol: "VLESS WebSocket",
			Port: settings.VLESSWSPort, Enabled: true, CDN: true,
		})
	}
	if settings.VMessWSEnabled {
		inbounds = append(inbounds, inboundInfo{
			Tag: "vmess-ws", Protocol: "VMess WebSocket",
			Port: settings.VMessWSPort, Enabled: true, CDN: true,
		})
	}
	if settings.SSEnabled {
		inbounds = append(inbounds, inboundInfo{
			Tag: "shadowsocks", Protocol: "Shadowsocks 2022",
			Port: settings.SSPort, Enabled: true, CDN: false,
		})
	}
	if settings.TrojanEnabled {
		inbounds = append(inbounds, inboundInfo{
			Tag: "trojan-tls", Protocol: "Trojan TLS",
			Port: settings.TrojanPort, Enabled: true, CDN: false,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"inbounds": inbounds,
		"total":    len(inbounds),
	})
}

// --- Settings ---

func (a *API) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		settings, err := a.db.GetSettings()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, settings)

	case http.MethodPost:
		var settings ServerSettings
		if err := readJSON(r, &settings); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
			return
		}
		if err := a.db.SaveSettings(&settings); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		a.logger.Info("settings updated, syncing xray config")

		// Re-sync xray with new settings.
		if err := a.xray.SyncConfigAndReload(); err != nil {
			a.logger.Error("failed to sync xray after settings update", "error", err)
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"ok":       true,
				"settings": settings,
				"warning":  "settings saved but xray reload failed: " + err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "settings": settings})

	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// --- Metrics ---

func (a *API) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	period := r.URL.Query().Get("period")
	since := time.Now().Add(-24 * time.Hour)
	switch period {
	case "1h":
		since = time.Now().Add(-time.Hour)
	case "6h":
		since = time.Now().Add(-6 * time.Hour)
	case "24h", "":
		since = time.Now().Add(-24 * time.Hour)
		period = "24h"
	case "7d":
		since = time.Now().Add(-7 * 24 * time.Hour)
	case "30d":
		since = time.Now().Add(-30 * 24 * time.Hour)
	}

	records, _ := a.db.GetTrafficHistory(since)
	if records == nil {
		records = []*TrafficRecord{}
	}

	clients, _ := a.db.ListClients()

	var totalUp, totalDown int64
	type clientStat struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Up      int64  `json:"traffic_up"`
		Down    int64  `json:"traffic_down"`
		Limit   int64  `json:"traffic_limit"`
		Enabled bool   `json:"enabled"`
		Expired bool   `json:"expired"`
	}

	var stats []clientStat
	for _, c := range clients {
		totalUp += c.TrafficUp
		totalDown += c.TrafficDown
		stats = append(stats, clientStat{
			ID:      c.ID,
			Email:   c.Email,
			Up:      c.TrafficUp,
			Down:    c.TrafficDown,
			Limit:   c.TrafficLimit,
			Enabled: c.Enabled,
			Expired: c.IsExpired(),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"period":       period,
		"records":      records,
		"total_up":     totalUp,
		"total_down":   totalDown,
		"client_stats": stats,
	})
}

// --- Subscription (public, token-based) ---

func (a *API) handleSubscription(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.URL.Path, "/sub/")
	if token == "" {
		http.Error(w, "subscription token required", http.StatusBadRequest)
		return
	}

	client, err := a.db.GetClientByToken(token)
	if err != nil {
		http.Error(w, "invalid subscription", http.StatusNotFound)
		return
	}

	if !client.Enabled {
		http.Error(w, "subscription disabled", http.StatusForbidden)
		return
	}
	if client.IsExpired() {
		http.Error(w, "subscription expired", http.StatusForbidden)
		return
	}
	if client.IsOverLimit() {
		http.Error(w, "traffic limit exceeded", http.StatusForbidden)
		return
	}

	settings, _ := a.db.GetSettings()
	if settings == nil {
		http.Error(w, "server not configured", http.StatusInternalServerError)
		return
	}

	servers, _ := a.db.ListServers()

	// Generate base64-encoded subscription with V2Ray share links.
	subData := GenerateSubscription(client, settings, servers)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Profile-Update-Interval", "6")
	w.Header().Set("Subscription-UserInfo", fmt.Sprintf(
		"upload=%d; download=%d; total=%d; expire=%d",
		client.TrafficUp,
		client.TrafficDown,
		client.TrafficLimit,
		client.ExpiryDate.Unix(),
	))

	// Decode and re-encode to ensure clean output.
	decoded, err := base64.StdEncoding.DecodeString(subData)
	if err != nil {
		w.Write([]byte(subData))
		return
	}
	w.Write(decoded)
}

// --- Helpers ---

func readJSON(r *http.Request, v interface{}) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	defer r.Body.Close()
	return json.Unmarshal(body, v)
}

func generateShortID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateSubToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

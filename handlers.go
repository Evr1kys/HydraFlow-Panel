package main

import (
	"crypto/rand"; "encoding/base64"; "encoding/json"; "fmt"; "net"; "net/http"; "runtime"; "strings"; "time"
)

type Handler struct {
	db          *Database
	xray        *XrayManager
	auth        *AuthManager
	intel       *IntelligenceStore
	healthCache *HealthCache
}

func NewHandler(db *Database, xray *XrayManager, auth *AuthManager) *Handler {
	return &Handler{db: db, xray: xray, auth: auth, intel: NewIntelligenceStore(), healthCache: NewHealthCache()}
}
func jsonResponse(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type", "application/json"); w.WriteHeader(s); _ = json.NewEncoder(w).Encode(d) }
func jsonError(w http.ResponseWriter, s int, m string) { jsonResponse(w, s, map[string]string{"error": m}) }

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonError(w, 405, "method not allowed"); return }
	var req struct{ Email, Password string }
	if json.NewDecoder(r.Body).Decode(&req) != nil { jsonError(w, 400, "bad request"); return }
	if req.Email != h.db.Data.Admin.Email || !h.auth.CheckPassword(req.Password) { jsonError(w, 401, "invalid credentials"); return }
	t, err := h.auth.GenerateToken(); if err != nil { jsonError(w, 500, "token error"); return }
	jsonResponse(w, 200, map[string]string{"token": t})
}
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { jsonError(w, 405, "method not allowed"); return }
	var m runtime.MemStats; runtime.ReadMemStats(&m); us := h.db.GetUsers(); ac := 0; var tu, td int64
	for _, u := range us { if u.Enabled { ac++ }; tu += u.TrafficUp; td += u.TrafficDown }
	jsonResponse(w, 200, map[string]interface{}{"uptime": int64(time.Since(startTime).Seconds()), "mem_used": m.Alloc, "mem_sys": m.Sys, "goroutines": runtime.NumGoroutine(), "total_users": len(us), "active_users": ac, "traffic_up": tu, "traffic_down": td, "cpu_count": runtime.NumCPU(), "go_version": runtime.Version(), "xray_running": h.xray.IsRunning()})
}
func (h *Handler) Users(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET": jsonResponse(w, 200, h.db.GetUsers())
	case "POST":
		var req struct{ Email string; TrafficLimit int64 `json:"traffic_limit"`; ExpiryDate string `json:"expiry_date"` }
		if json.NewDecoder(r.Body).Decode(&req) != nil { jsonError(w, 400, "bad request"); return }
		if req.Email == "" { jsonError(w, 400, "email required"); return }
		u := User{ID: generateID(), Email: req.Email, UUID: generateUUID(), SubToken: generateSubToken(), Enabled: true, TrafficLimit: req.TrafficLimit, ExpiryDate: req.ExpiryDate}
		if h.db.AddUser(u) != nil { jsonError(w, 500, "failed"); return }
		_ = h.xray.ApplyConfig(h.db.Data.Settings, h.db.GetUsers(), true); jsonResponse(w, 201, u)
	default: jsonError(w, 405, "method not allowed")
	}
}
func (h *Handler) UserByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" { jsonError(w, 405, "method not allowed"); return }
	id := extractID(r.URL.Path, "/api/users/"); if id == "" { jsonError(w, 400, "id required"); return }
	if h.db.DeleteUser(id) != nil { jsonError(w, 404, "not found"); return }
	_ = h.xray.ApplyConfig(h.db.Data.Settings, h.db.GetUsers(), true); jsonResponse(w, 200, map[string]string{"status": "deleted"})
}
func (h *Handler) ToggleUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonError(w, 405, "method not allowed"); return }
	id := extractID(strings.TrimSuffix(r.URL.Path, "/toggle"), "/api/users/"); if id == "" { jsonError(w, 400, "id required"); return }
	var ns bool; if h.db.UpdateUser(id, func(u *User) { u.Enabled = !u.Enabled; ns = u.Enabled }) != nil { jsonError(w, 404, "not found"); return }
	_ = h.xray.ApplyConfig(h.db.Data.Settings, h.db.GetUsers(), true); jsonResponse(w, 200, map[string]interface{}{"enabled": ns})
}
func (h *Handler) UserSubLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { jsonError(w, 405, "method not allowed"); return }
	id := extractID(strings.TrimSuffix(r.URL.Path, "/sub"), "/api/users/"); u := h.db.GetUser(id)
	if u == nil { jsonError(w, 404, "not found"); return }
	host := r.Host; if host == "" { host = h.db.Data.Settings.ServerIP + ":2080" }
	sc := "http"; if r.TLS != nil { sc = "https" }
	jsonResponse(w, 200, map[string]string{"sub_url": fmt.Sprintf("%s://%s/sub/%s", sc, host, u.SubToken), "sub_token": u.SubToken})
}
func (h *Handler) Settings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET": jsonResponse(w, 200, h.db.Data.Settings)
	case "POST":
		var s ServerSettings; if json.NewDecoder(r.Body).Decode(&s) != nil { jsonError(w, 400, "bad request"); return }
		if h.db.UpdateSettings(s) != nil { jsonError(w, 500, "save failed"); return }
		if err := h.xray.ApplyConfig(s, h.db.GetUsers(), true); err != nil { jsonResponse(w, 200, map[string]interface{}{"status": "saved", "warning": err.Error()}); return }
		jsonResponse(w, 200, map[string]string{"status": "saved"})
	default: jsonError(w, 405, "method not allowed")
	}
}
func (h *Handler) XrayRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonError(w, 405, "method not allowed"); return }
	if err := h.xray.Restart(); err != nil { jsonError(w, 500, err.Error()); return }; jsonResponse(w, 200, map[string]string{"status": "restarted"})
}
func (h *Handler) XrayStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { jsonError(w, 405, "method not allowed"); return }; jsonResponse(w, 200, map[string]interface{}{"running": h.xray.IsRunning()})
}
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonError(w, 405, "method not allowed"); return }
	var req struct{ CurrentPassword string `json:"current_password"`; NewPassword string `json:"new_password"` }
	if json.NewDecoder(r.Body).Decode(&req) != nil { jsonError(w, 400, "bad request"); return }
	if !h.auth.CheckPassword(req.CurrentPassword) { jsonError(w, 401, "wrong password"); return }
	if len(req.NewPassword) < 6 { jsonError(w, 400, "password too short"); return }
	hash, err := HashPassword(req.NewPassword); if err != nil { jsonError(w, 500, "hash error"); return }
	if h.db.UpdateAdminPassword(hash) != nil { jsonError(w, 500, "save failed"); return }; jsonResponse(w, 200, map[string]string{"status": "password changed"})
}
func (h *Handler) Subscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { jsonError(w, 405, "method not allowed"); return }
	tk := strings.TrimPrefix(r.URL.Path, "/sub/"); if tk == "" { http.Error(w, "not found", 404); return }
	u := h.db.GetUserBySubToken(tk); if u == nil || !u.Enabled { http.Error(w, "not found", 404); return }
	if u.ExpiryDate != "" { if exp, err := time.Parse(time.RFC3339, u.ExpiryDate); err == nil && time.Now().After(exp) { http.Error(w, "expired", 410); return } }
	if u.TrafficLimit > 0 && (u.TrafficUp+u.TrafficDown) >= u.TrafficLimit { http.Error(w, "limit exceeded", 410); return }
	s := h.db.Data.Settings; ip := s.ServerIP; if ip == "" || ip == "0.0.0.0" { ip = getOutboundIP() }
	var links []string
	if s.Reality.Enabled { links = append(links, fmt.Sprintf("vless://%s@%s:%d?security=reality&sni=%s&fp=chrome&pbk=%s&sid=%s&type=tcp&flow=xtls-rprx-vision&encryption=none#HydraFlow-Reality", u.UUID, ip, s.Reality.Port, s.Reality.SNI, s.Reality.PublicKey, s.Reality.ShortID)) }
	if s.WS.Enabled { links = append(links, fmt.Sprintf("vless://%s@%s:%d?type=ws&security=none&path=%s&host=%s&encryption=none#HydraFlow-WS", u.UUID, ip, s.WS.Port, s.WS.Path, s.WS.Host)) }
	if s.SS.Enabled { ui := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", s.SS.Method, s.SS.Password))); links = append(links, fmt.Sprintf("ss://%s@%s:%d#HydraFlow-SS", ui, ip, s.SS.Port)) }
	if len(links) == 0 { http.Error(w, "no protocols", 404); return }
	enc := base64.StdEncoding.EncodeToString([]byte(strings.Join(links, "\n")))
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Subscription-Userinfo", fmt.Sprintf("upload=%d; download=%d; total=%d", u.TrafficUp, u.TrafficDown, u.TrafficLimit))
	fmt.Fprint(w, enc)
}
func extractID(path, prefix string) string { t := strings.TrimPrefix(path, prefix); p := strings.Split(t, "/"); if len(p) > 0 && p[0] != "" { return p[0] }; return "" }
func generateUUID() string { b := make([]byte, 16); _, _ = rand.Read(b); b[6] = (b[6]&0x0f)|0x40; b[8] = (b[8]&0x3f)|0x80; return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]) }
func getOutboundIP() string { c, e := net.Dial("udp", "8.8.8.8:80"); if e != nil { return "127.0.0.1" }; defer c.Close(); return c.LocalAddr().(*net.UDPAddr).IP.String() }

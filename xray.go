package main

import (
	"encoding/json"; "fmt"; "os"; "os/exec"; "sync"; "syscall"
)

type XrayManager struct { mu sync.Mutex; configPath string; cmd *exec.Cmd; running bool }
func NewXrayManager(cp string) *XrayManager { return &XrayManager{configPath: cp} }
func (x *XrayManager) IsRunning() bool {
	x.mu.Lock(); defer x.mu.Unlock()
	if x.cmd == nil || x.cmd.Process == nil { return false }
	if x.cmd.Process.Signal(syscall.Signal(0)) != nil { x.running = false; return false }; return x.running
}
func (x *XrayManager) Start() error {
	x.mu.Lock(); defer x.mu.Unlock(); if x.running { return nil }
	b, err := exec.LookPath("xray"); if err != nil { return fmt.Errorf("xray not found: %w", err) }
	x.cmd = exec.Command(b, "run", "-c", x.configPath); x.cmd.Stdout = os.Stdout; x.cmd.Stderr = os.Stderr
	if err := x.cmd.Start(); err != nil { return err }; x.running = true
	go func() { _ = x.cmd.Wait(); x.mu.Lock(); x.running = false; x.mu.Unlock() }(); return nil
}
func (x *XrayManager) Stop() {
	x.mu.Lock(); defer x.mu.Unlock()
	if x.cmd != nil && x.cmd.Process != nil && x.running { _ = x.cmd.Process.Signal(syscall.SIGTERM); _ = x.cmd.Wait(); x.running = false }
}
func (x *XrayManager) Restart() error { x.Stop(); return x.Start() }
func (x *XrayManager) WriteConfig(cfg map[string]interface{}) error {
	d, err := json.MarshalIndent(cfg, "", "  "); if err != nil { return err }; return os.WriteFile(x.configPath, d, 0644)
}
func (x *XrayManager) BuildConfig(s ServerSettings, users []User) map[string]interface{} {
	cfg := map[string]interface{}{"log": map[string]interface{}{"loglevel": "warning"}, "stats": map[string]interface{}{},
		"api": map[string]interface{}{"tag": "api", "services": []string{"StatsService"}},
		"policy": map[string]interface{}{"levels": map[string]interface{}{"0": map[string]interface{}{"statsUserUplink": true, "statsUserDownlink": true}},
			"system": map[string]interface{}{"statsInboundUplink": true, "statsInboundDownlink": true, "statsOutboundUplink": true, "statsOutboundDownlink": true}}}
	inb := []map[string]interface{}{{"tag": "api", "listen": "127.0.0.1", "port": 61080, "protocol": "dokodemo-door", "settings": map[string]interface{}{"address": "127.0.0.1"}}}
	vc := []map[string]interface{}{}
	for _, u := range users { if u.Enabled { vc = append(vc, map[string]interface{}{"id": u.UUID, "email": u.Email, "level": 0}) } }
	if s.Reality.Enabled && len(vc) > 0 { inb = append(inb, map[string]interface{}{"tag": "vless-reality", "listen": "0.0.0.0", "port": s.Reality.Port, "protocol": "vless", "settings": map[string]interface{}{"clients": vc, "decryption": "none"}, "streamSettings": map[string]interface{}{"network": "tcp", "security": "reality", "realitySettings": map[string]interface{}{"show": false, "dest": fmt.Sprintf("%s:443", s.Reality.SNI), "serverNames": []string{s.Reality.SNI}, "privateKey": s.Reality.PrivateKey, "shortIds": []string{s.Reality.ShortID}}}, "sniffing": map[string]interface{}{"enabled": true, "destOverride": []string{"http", "tls", "quic"}}}) }
	if s.WS.Enabled && len(vc) > 0 { inb = append(inb, map[string]interface{}{"tag": "vless-ws", "listen": "0.0.0.0", "port": s.WS.Port, "protocol": "vless", "settings": map[string]interface{}{"clients": vc, "decryption": "none"}, "streamSettings": map[string]interface{}{"network": "ws", "wsSettings": map[string]interface{}{"path": s.WS.Path, "headers": map[string]interface{}{"Host": s.WS.Host}}}, "sniffing": map[string]interface{}{"enabled": true, "destOverride": []string{"http", "tls", "quic"}}}) }
	if s.SS.Enabled { inb = append(inb, map[string]interface{}{"tag": "shadowsocks", "listen": "0.0.0.0", "port": s.SS.Port, "protocol": "shadowsocks", "settings": map[string]interface{}{"method": s.SS.Method, "password": s.SS.Password, "network": "tcp,udp"}}) }
	cfg["inbounds"] = inb
	cfg["outbounds"] = []map[string]interface{}{{"tag": "direct", "protocol": "freedom"}, {"tag": "blocked", "protocol": "blackhole"}}
	cfg["routing"] = map[string]interface{}{"rules": []map[string]interface{}{{"type": "field", "inboundTag": []string{"api"}, "outboundTag": "api"}, {"type": "field", "ip": []string{"geoip:private"}, "outboundTag": "blocked"}}}
	return cfg
}
func (x *XrayManager) ApplyConfig(s ServerSettings, users []User, restart bool) error {
	if err := x.WriteConfig(x.BuildConfig(s, users)); err != nil { return err }
	if restart && x.IsRunning() { return x.Restart() }; return nil
}

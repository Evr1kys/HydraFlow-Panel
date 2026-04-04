// Package panel provides a web-based admin panel for HydraFlow.
package panel

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// Client represents a managed proxy user.
type Client struct {
	ID                string    `json:"id"`
	Email             string    `json:"email"`
	UUID              string    `json:"uuid"`
	TrafficUp         int64     `json:"traffic_up"`
	TrafficDown       int64     `json:"traffic_down"`
	TrafficLimit      int64     `json:"traffic_limit"`
	ExpiryDate        time.Time `json:"expiry_date"`
	Enabled           bool      `json:"enabled"`
	SubscriptionToken string    `json:"subscription_token"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// IsExpired returns true if the client's subscription has expired.
func (c *Client) IsExpired() bool {
	if c.ExpiryDate.IsZero() {
		return false
	}
	return time.Now().After(c.ExpiryDate)
}

// IsOverLimit returns true if the client has exceeded their traffic limit.
func (c *Client) IsOverLimit() bool {
	if c.TrafficLimit <= 0 {
		return false
	}
	return (c.TrafficUp + c.TrafficDown) >= c.TrafficLimit
}

// Inbound represents a protocol inbound configuration stored in the database.
type Inbound struct {
	Tag      string                 `json:"tag"`
	Protocol string                 `json:"protocol"`
	Port     int                    `json:"port"`
	Listen   string                 `json:"listen"`
	Settings map[string]interface{} `json:"settings"`
	Enabled  bool                   `json:"enabled"`
}

// AdminCredentials stores hashed admin credentials.
type AdminCredentials struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
}

// TrafficRecord stores periodic traffic snapshots.
type TrafficRecord struct {
	Timestamp   time.Time `json:"timestamp"`
	TotalUp     int64     `json:"total_up"`
	TotalDown   int64     `json:"total_down"`
	Connections int64     `json:"connections"`
}

// RemoteServer represents a remote HydraFlow node for multi-server support.
type RemoteServer struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Address         string    `json:"address"`
	Port            int       `json:"port"`
	APIKey          string    `json:"api_key"`
	Enabled         bool      `json:"enabled"`
	Status          string    `json:"status"`
	LastHealthCheck time.Time `json:"last_health_check"`
	XrayVersion     string    `json:"xray_version,omitempty"`
	Protocols       []string  `json:"protocols,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// ServerSettings stores configurable server settings.
type ServerSettings struct {
	PanelListen    string `json:"panel_listen"`
	SubDomain      string `json:"sub_domain"`
	ServerIP       string `json:"server_ip"`
	SessionTimeout int    `json:"session_timeout"`
	XrayAPIPort    int    `json:"xray_api_port"`

	// Protocol settings.
	RealityEnabled bool   `json:"reality_enabled"`
	RealityPort    int    `json:"reality_port"`
	RealityDest    string `json:"reality_dest"`
	RealitySNI     string `json:"reality_sni"`
	RealityPrivKey string `json:"reality_private_key"`
	RealityPubKey  string `json:"reality_public_key"`
	RealityShortID string `json:"reality_short_id"`

	VLESSWSEnabled bool   `json:"vless_ws_enabled"`
	VLESSWSPort    int    `json:"vless_ws_port"`
	VLESSWSPath    string `json:"vless_ws_path"`
	VLESSWSHost    string `json:"vless_ws_host"`

	VMessWSEnabled bool   `json:"vmess_ws_enabled"`
	VMessWSPort    int    `json:"vmess_ws_port"`
	VMessWSPath    string `json:"vmess_ws_path"`
	VMessWSHost    string `json:"vmess_ws_host"`

	SSEnabled  bool   `json:"ss_enabled"`
	SSPort     int    `json:"ss_port"`
	SSMethod   string `json:"ss_method"`
	SSPassword string `json:"ss_password"`

	TrojanEnabled  bool   `json:"trojan_enabled"`
	TrojanPort     int    `json:"trojan_port"`
	TrojanCertFile string `json:"trojan_cert_file"`
	TrojanKeyFile  string `json:"trojan_key_file"`

	// CDN settings.
	CDNDomain  string `json:"cdn_domain"`
	CDNEnabled bool   `json:"cdn_enabled"`

	TrafficResetDay int `json:"traffic_reset_day"`
}

// Database defines the interface for panel data persistence.
type Database interface {
	// Admin credentials
	GetAdmin() (*AdminCredentials, error)
	SetAdmin(creds *AdminCredentials) error

	// Client CRUD
	ListClients() ([]*Client, error)
	GetClient(id string) (*Client, error)
	CreateClient(client *Client) error
	UpdateClient(client *Client) error
	DeleteClient(id string) error
	GetClientByToken(token string) (*Client, error)
	GetClientByEmail(email string) (*Client, error)

	// Inbound CRUD
	ListInbounds() ([]*Inbound, error)
	GetInbound(tag string) (*Inbound, error)
	CreateInbound(inbound *Inbound) error
	UpdateInbound(inbound *Inbound) error
	DeleteInbound(tag string) error

	// Remote servers
	ListServers() ([]*RemoteServer, error)
	GetServer(id string) (*RemoteServer, error)
	CreateServer(server *RemoteServer) error
	UpdateServer(server *RemoteServer) error
	DeleteServer(id string) error

	// Traffic
	RecordTraffic(record *TrafficRecord) error
	GetTrafficHistory(since time.Time) ([]*TrafficRecord, error)
	UpdateClientTraffic(id string, up, down int64) error
	SetClientTraffic(id string, up, down int64) error

	// Settings
	GetSettings() (*ServerSettings, error)
	SaveSettings(settings *ServerSettings) error

	// Lifecycle
	Save() error
	Close() error
}

// jsonStore is the on-disk JSON structure.
type jsonStore struct {
	Admin          *AdminCredentials `json:"admin"`
	Clients        []*Client         `json:"clients"`
	Inbounds       []*Inbound        `json:"inbounds"`
	Servers        []*RemoteServer   `json:"servers"`
	TrafficHistory []*TrafficRecord  `json:"traffic_history"`
	Settings       *ServerSettings   `json:"settings"`
}

// JSONDatabase implements Database using a JSON file for persistence.
type JSONDatabase struct {
	mu   sync.RWMutex
	path string
	data *jsonStore
}

// NewJSONDatabase creates or loads a JSON-backed database at the given path.
func NewJSONDatabase(path string) (*JSONDatabase, error) {
	db := &JSONDatabase{
		path: path,
		data: &jsonStore{
			Clients:        make([]*Client, 0),
			Inbounds:       make([]*Inbound, 0),
			Servers:        make([]*RemoteServer, 0),
			TrafficHistory: make([]*TrafficRecord, 0),
			Settings: &ServerSettings{
				PanelListen:    ":2080",
				SessionTimeout: 86400,
				XrayAPIPort:    10085,
			},
		},
	}

	if _, err := os.Stat(path); err == nil {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read database file: %w", err)
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, db.data); err != nil {
				return nil, fmt.Errorf("parse database file: %w", err)
			}
		}
	}

	// Ensure slices are not nil after load.
	if db.data.Clients == nil {
		db.data.Clients = make([]*Client, 0)
	}
	if db.data.Inbounds == nil {
		db.data.Inbounds = make([]*Inbound, 0)
	}
	if db.data.Servers == nil {
		db.data.Servers = make([]*RemoteServer, 0)
	}
	if db.data.TrafficHistory == nil {
		db.data.TrafficHistory = make([]*TrafficRecord, 0)
	}
	if db.data.Settings == nil {
		db.data.Settings = &ServerSettings{
			PanelListen:    ":2080",
			SessionTimeout: 86400,
			XrayAPIPort:    10085,
		}
	}

	return db, nil
}

// --- Admin ---

func (db *JSONDatabase) GetAdmin() (*AdminCredentials, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.data.Admin, nil
}

func (db *JSONDatabase) SetAdmin(creds *AdminCredentials) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.Admin = creds
	return db.saveLocked()
}

// --- Clients ---

func (db *JSONDatabase) ListClients() ([]*Client, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	result := make([]*Client, len(db.data.Clients))
	copy(result, db.data.Clients)
	return result, nil
}

func (db *JSONDatabase) GetClient(id string) (*Client, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, c := range db.data.Clients {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, fmt.Errorf("client not found: %s", id)
}

func (db *JSONDatabase) GetClientByEmail(email string) (*Client, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, c := range db.data.Clients {
		if c.Email == email {
			return c, nil
		}
	}
	return nil, fmt.Errorf("client not found by email: %s", email)
}

func (db *JSONDatabase) CreateClient(client *Client) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, c := range db.data.Clients {
		if c.ID == client.ID {
			return fmt.Errorf("client already exists: %s", client.ID)
		}
		if c.Email == client.Email {
			return fmt.Errorf("email already in use: %s", client.Email)
		}
	}
	now := time.Now()
	client.CreatedAt = now
	client.UpdatedAt = now
	db.data.Clients = append(db.data.Clients, client)
	return db.saveLocked()
}

func (db *JSONDatabase) UpdateClient(client *Client) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, c := range db.data.Clients {
		if c.ID == client.ID {
			client.UpdatedAt = time.Now()
			client.CreatedAt = c.CreatedAt
			db.data.Clients[i] = client
			return db.saveLocked()
		}
	}
	return fmt.Errorf("client not found: %s", client.ID)
}

func (db *JSONDatabase) DeleteClient(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, c := range db.data.Clients {
		if c.ID == id {
			db.data.Clients = append(db.data.Clients[:i], db.data.Clients[i+1:]...)
			return db.saveLocked()
		}
	}
	return fmt.Errorf("client not found: %s", id)
}

func (db *JSONDatabase) GetClientByToken(token string) (*Client, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, c := range db.data.Clients {
		if c.SubscriptionToken == token {
			return c, nil
		}
	}
	return nil, fmt.Errorf("client not found for token")
}

// --- Inbounds ---

func (db *JSONDatabase) ListInbounds() ([]*Inbound, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	result := make([]*Inbound, len(db.data.Inbounds))
	copy(result, db.data.Inbounds)
	return result, nil
}

func (db *JSONDatabase) GetInbound(tag string) (*Inbound, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, in := range db.data.Inbounds {
		if in.Tag == tag {
			return in, nil
		}
	}
	return nil, fmt.Errorf("inbound not found: %s", tag)
}

func (db *JSONDatabase) CreateInbound(inbound *Inbound) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, in := range db.data.Inbounds {
		if in.Tag == inbound.Tag {
			return fmt.Errorf("inbound already exists: %s", inbound.Tag)
		}
	}
	db.data.Inbounds = append(db.data.Inbounds, inbound)
	return db.saveLocked()
}

func (db *JSONDatabase) UpdateInbound(inbound *Inbound) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, in := range db.data.Inbounds {
		if in.Tag == inbound.Tag {
			db.data.Inbounds[i] = inbound
			return db.saveLocked()
		}
	}
	return fmt.Errorf("inbound not found: %s", inbound.Tag)
}

func (db *JSONDatabase) DeleteInbound(tag string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, in := range db.data.Inbounds {
		if in.Tag == tag {
			db.data.Inbounds = append(db.data.Inbounds[:i], db.data.Inbounds[i+1:]...)
			return db.saveLocked()
		}
	}
	return fmt.Errorf("inbound not found: %s", tag)
}

// --- Remote Servers ---

func (db *JSONDatabase) ListServers() ([]*RemoteServer, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	result := make([]*RemoteServer, len(db.data.Servers))
	copy(result, db.data.Servers)
	return result, nil
}

func (db *JSONDatabase) GetServer(id string) (*RemoteServer, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	for _, s := range db.data.Servers {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, fmt.Errorf("server not found: %s", id)
}

func (db *JSONDatabase) CreateServer(server *RemoteServer) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, s := range db.data.Servers {
		if s.ID == server.ID {
			return fmt.Errorf("server already exists: %s", server.ID)
		}
	}
	server.CreatedAt = time.Now()
	db.data.Servers = append(db.data.Servers, server)
	return db.saveLocked()
}

func (db *JSONDatabase) UpdateServer(server *RemoteServer) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, s := range db.data.Servers {
		if s.ID == server.ID {
			server.CreatedAt = s.CreatedAt
			db.data.Servers[i] = server
			return db.saveLocked()
		}
	}
	return fmt.Errorf("server not found: %s", server.ID)
}

func (db *JSONDatabase) DeleteServer(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for i, s := range db.data.Servers {
		if s.ID == id {
			db.data.Servers = append(db.data.Servers[:i], db.data.Servers[i+1:]...)
			return db.saveLocked()
		}
	}
	return fmt.Errorf("server not found: %s", id)
}

// --- Traffic ---

func (db *JSONDatabase) RecordTraffic(record *TrafficRecord) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.TrafficHistory = append(db.data.TrafficHistory, record)
	if len(db.data.TrafficHistory) > 2000 {
		db.data.TrafficHistory = db.data.TrafficHistory[len(db.data.TrafficHistory)-2000:]
	}
	return db.saveLocked()
}

func (db *JSONDatabase) GetTrafficHistory(since time.Time) ([]*TrafficRecord, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	var result []*TrafficRecord
	for _, r := range db.data.TrafficHistory {
		if r.Timestamp.After(since) || r.Timestamp.Equal(since) {
			result = append(result, r)
		}
	}
	return result, nil
}

func (db *JSONDatabase) UpdateClientTraffic(id string, up, down int64) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, c := range db.data.Clients {
		if c.ID == id {
			c.TrafficUp += up
			c.TrafficDown += down
			c.UpdatedAt = time.Now()
			return db.saveLocked()
		}
	}
	return fmt.Errorf("client not found: %s", id)
}

func (db *JSONDatabase) SetClientTraffic(id string, up, down int64) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	for _, c := range db.data.Clients {
		if c.ID == id {
			c.TrafficUp = up
			c.TrafficDown = down
			c.UpdatedAt = time.Now()
			return db.saveLocked()
		}
	}
	return fmt.Errorf("client not found: %s", id)
}

// --- Settings ---

func (db *JSONDatabase) GetSettings() (*ServerSettings, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	if db.data.Settings == nil {
		return &ServerSettings{
			PanelListen:    ":2080",
			SessionTimeout: 86400,
			XrayAPIPort:    10085,
		}, nil
	}
	return db.data.Settings, nil
}

func (db *JSONDatabase) SaveSettings(settings *ServerSettings) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.Settings = settings
	return db.saveLocked()
}

// --- Lifecycle ---

func (db *JSONDatabase) Save() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.saveLocked()
}

func (db *JSONDatabase) Close() error {
	return db.Save()
}

func (db *JSONDatabase) saveLocked() error {
	raw, err := json.MarshalIndent(db.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal database: %w", err)
	}
	if err := os.WriteFile(db.path, raw, 0600); err != nil {
		return fmt.Errorf("write database: %w", err)
	}
	return nil
}

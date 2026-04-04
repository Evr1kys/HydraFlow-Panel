package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"golang.org/x/crypto/bcrypt"
)

type Database struct { mu sync.RWMutex; path string; Data *DatabaseData }
type DatabaseData struct { Admin AdminConfig `json:"admin"`; Users []User `json:"users"`; Settings ServerSettings `json:"settings"` }
type AdminConfig struct { Email string `json:"email"`; Password string `json:"password"` }
type User struct {
	ID string `json:"id"`; Email string `json:"email"`; UUID string `json:"uuid"`; SubToken string `json:"sub_token"`
	Enabled bool `json:"enabled"`; TrafficUp int64 `json:"traffic_up"`; TrafficDown int64 `json:"traffic_down"`
	TrafficLimit int64 `json:"traffic_limit"`; ExpiryDate string `json:"expiry_date"`; CreatedAt string `json:"created_at"`
}
type ServerSettings struct { ServerIP string `json:"server_ip"`; Reality RealityConfig `json:"reality"`; WS WSConfig `json:"ws"`; SS SSConfig `json:"ss"` }
type RealityConfig struct { Enabled bool `json:"enabled"`; Port int `json:"port"`; SNI string `json:"sni"`; PublicKey string `json:"public_key"`; PrivateKey string `json:"private_key"`; ShortID string `json:"short_id"` }
type WSConfig struct { Enabled bool `json:"enabled"`; Port int `json:"port"`; Path string `json:"path"`; Host string `json:"host"` }
type SSConfig struct { Enabled bool `json:"enabled"`; Port int `json:"port"`; Method string `json:"method"`; Password string `json:"password"` }

func NewDatabase(path string) (*Database, error) {
	db := &Database{path: path}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		dp, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
		db.Data = &DatabaseData{Admin: AdminConfig{Email: "admin@hydraflow.dev", Password: string(dp)}, Users: []User{},
			Settings: ServerSettings{ServerIP: "0.0.0.0", Reality: RealityConfig{Port: 443, SNI: "www.google.com"}, WS: WSConfig{Port: 8080, Path: "/ws"}, SS: SSConfig{Port: 1080, Method: "2022-blake3-aes-128-gcm", Password: generateRandomHex(16)}}}
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil { return nil, err }
		if err := db.Save(); err != nil { return nil, err }
		return db, nil
	}
	data, err := os.ReadFile(path); if err != nil { return nil, err }
	db.Data = &DatabaseData{}; if err := json.Unmarshal(data, db.Data); err != nil { return nil, err }
	return db, nil
}
func (db *Database) Save() error {
	db.mu.Lock(); defer db.mu.Unlock()
	d, err := json.MarshalIndent(db.Data, "", "  "); if err != nil { return err }
	t := db.path + ".tmp"; if err := os.WriteFile(t, d, 0644); err != nil { return err }; return os.Rename(t, db.path)
}
func (db *Database) GetUsers() []User { db.mu.RLock(); defer db.mu.RUnlock(); u := make([]User, len(db.Data.Users)); copy(u, db.Data.Users); return u }
func (db *Database) GetUser(id string) *User { db.mu.RLock(); defer db.mu.RUnlock(); for _, u := range db.Data.Users { if u.ID == id { c := u; return &c } }; return nil }
func (db *Database) GetUserBySubToken(tk string) *User { db.mu.RLock(); defer db.mu.RUnlock(); for _, u := range db.Data.Users { if u.SubToken == tk { c := u; return &c } }; return nil }
func (db *Database) AddUser(u User) error { db.mu.Lock(); u.CreatedAt = time.Now().UTC().Format(time.RFC3339); db.Data.Users = append(db.Data.Users, u); db.mu.Unlock(); return db.Save() }
func (db *Database) UpdateUser(id string, fn func(*User)) error { db.mu.Lock(); for i := range db.Data.Users { if db.Data.Users[i].ID == id { fn(&db.Data.Users[i]); db.mu.Unlock(); return db.Save() } }; db.mu.Unlock(); return fmt.Errorf("not found") }
func (db *Database) DeleteUser(id string) error { db.mu.Lock(); for i, u := range db.Data.Users { if u.ID == id { db.Data.Users = append(db.Data.Users[:i], db.Data.Users[i+1:]...); db.mu.Unlock(); return db.Save() } }; db.mu.Unlock(); return fmt.Errorf("not found") }
func (db *Database) UpdateSettings(s ServerSettings) error { db.mu.Lock(); db.Data.Settings = s; db.mu.Unlock(); return db.Save() }
func (db *Database) UpdateAdminPassword(h string) error { db.mu.Lock(); db.Data.Admin.Password = h; db.mu.Unlock(); return db.Save() }
func generateRandomHex(n int) string { b := make([]byte, n); _, _ = rand.Read(b); return hex.EncodeToString(b) }
func generateSubToken() string { return generateRandomHex(16) }
func generateID() string { return generateRandomHex(8) }

package main

import (
	"crypto/hmac"; "crypto/rand"; "crypto/sha256"; "encoding/base64"; "encoding/json"
	"fmt"; "net/http"; "strings"; "time"; "golang.org/x/crypto/bcrypt"
)

type AuthManager struct { db *Database; jwtSecret []byte }
type JWTHeader struct { Alg string `json:"alg"`; Typ string `json:"typ"` }
type JWTPayload struct { Sub string `json:"sub"`; Exp int64 `json:"exp"`; Iat int64 `json:"iat"` }

func NewAuthManager(db *Database) *AuthManager {
	s := make([]byte, 32); if _, err := rand.Read(s); err != nil { panic(err) }; return &AuthManager{db: db, jwtSecret: s}
}
func (a *AuthManager) CheckPassword(pw string) bool { return bcrypt.CompareHashAndPassword([]byte(a.db.Data.Admin.Password), []byte(pw)) == nil }
func HashPassword(pw string) (string, error) { h, e := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost); return string(h), e }
func (a *AuthManager) GenerateToken() (string, error) {
	hj, _ := json.Marshal(JWTHeader{Alg: "HS256", Typ: "JWT"})
	pj, _ := json.Marshal(JWTPayload{Sub: a.db.Data.Admin.Email, Iat: time.Now().Unix(), Exp: time.Now().Add(24*time.Hour).Unix()})
	si := base64.RawURLEncoding.EncodeToString(hj) + "." + base64.RawURLEncoding.EncodeToString(pj)
	m := hmac.New(sha256.New, a.jwtSecret); m.Write([]byte(si))
	return si + "." + base64.RawURLEncoding.EncodeToString(m.Sum(nil)), nil
}
func (a *AuthManager) ValidateToken(t string) (*JWTPayload, error) {
	p := strings.Split(t, "."); if len(p) != 3 { return nil, fmt.Errorf("bad token") }
	si := p[0] + "." + p[1]; m := hmac.New(sha256.New, a.jwtSecret); m.Write([]byte(si))
	if !hmac.Equal([]byte(p[2]), []byte(base64.RawURLEncoding.EncodeToString(m.Sum(nil)))) { return nil, fmt.Errorf("bad sig") }
	pj, err := base64.RawURLEncoding.DecodeString(p[1]); if err != nil { return nil, err }
	var pl JWTPayload; if err := json.Unmarshal(pj, &pl); err != nil { return nil, err }
	if time.Now().Unix() > pl.Exp { return nil, fmt.Errorf("expired") }; return &pl, nil
}
func (a *AuthManager) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ah := r.Header.Get("Authorization"); if ah == "" { http.Error(w, `{"error":"unauthorized"}`, 401); return }
		tk := strings.TrimPrefix(ah, "Bearer "); if tk == ah { http.Error(w, `{"error":"bad auth"}`, 401); return }
		if _, err := a.ValidateToken(tk); err != nil { http.Error(w, `{"error":"invalid token"}`, 401); return }
		next(w, r)
	}
}

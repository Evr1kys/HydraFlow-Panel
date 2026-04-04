package panel

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Auth handles JWT-based authentication for the admin panel.
type Auth struct {
	db             Database
	secretKey      []byte
	sessionTimeout time.Duration
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

type jwtClaims struct {
	Sub string `json:"sub"`
	Iat int64  `json:"iat"`
	Exp int64  `json:"exp"`
	Jti string `json:"jti"`
}

// NewAuth creates a new Auth instance with a random secret key.
func NewAuth(db Database, sessionTimeout time.Duration) (*Auth, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, fmt.Errorf("generate secret key: %w", err)
	}
	if sessionTimeout <= 0 {
		sessionTimeout = 24 * time.Hour
	}
	return &Auth{
		db:             db,
		secretKey:      secret,
		sessionTimeout: sessionTimeout,
	}, nil
}

// HashPassword hashes a plaintext password using bcrypt.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword verifies a plaintext password against a bcrypt hash.
func CheckPassword(hash, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Login validates credentials and returns a JWT token.
func (a *Auth) Login(username, password string) (string, error) {
	admin, err := a.db.GetAdmin()
	if err != nil {
		return "", fmt.Errorf("get admin: %w", err)
	}
	if admin == nil {
		return "", fmt.Errorf("no admin account configured")
	}
	if admin.Username != username {
		return "", fmt.Errorf("invalid credentials")
	}
	if !CheckPassword(admin.PasswordHash, password) {
		return "", fmt.Errorf("invalid credentials")
	}
	return a.generateToken(username)
}

// ValidateToken checks a JWT token and returns the username if valid.
func (a *Auth) ValidateToken(tokenStr string) (string, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid token format")
	}
	signingInput := parts[0] + "." + parts[1]
	expectedSig := a.sign([]byte(signingInput))
	actualSig, err := base64URLDecode(parts[2])
	if err != nil {
		return "", fmt.Errorf("decode signature: %w", err)
	}
	if !hmac.Equal(expectedSig, actualSig) {
		return "", fmt.Errorf("invalid signature")
	}
	claimsJSON, err := base64URLDecode(parts[1])
	if err != nil {
		return "", fmt.Errorf("decode claims: %w", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return "", fmt.Errorf("parse claims: %w", err)
	}
	if time.Now().Unix() > claims.Exp {
		return "", fmt.Errorf("token expired")
	}
	return claims.Sub, nil
}

// RefreshToken generates a new token if the current one is still valid.
func (a *Auth) RefreshToken(tokenStr string) (string, error) {
	username, err := a.ValidateToken(tokenStr)
	if err != nil {
		return "", err
	}
	return a.generateToken(username)
}

// Middleware returns an HTTP middleware that validates JWT tokens.
func (a *Auth) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "authorization header required",
			})
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid authorization format",
			})
			return
		}
		username, err := a.ValidateToken(token)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid or expired token",
			})
			return
		}
		r.Header.Set("X-Admin-User", username)
		next(w, r)
	}
}

func (a *Auth) generateToken(username string) (string, error) {
	jti := make([]byte, 16)
	if _, err := rand.Read(jti); err != nil {
		return "", fmt.Errorf("generate jti: %w", err)
	}
	header := jwtHeader{Alg: "HS256", Typ: "JWT"}
	claims := jwtClaims{
		Sub: username,
		Iat: time.Now().Unix(),
		Exp: time.Now().Add(a.sessionTimeout).Unix(),
		Jti: hex.EncodeToString(jti),
	}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)
	headerB64 := base64URLEncode(headerJSON)
	claimsB64 := base64URLEncode(claimsJSON)
	signingInput := headerB64 + "." + claimsB64
	signature := a.sign([]byte(signingInput))
	return signingInput + "." + base64URLEncode(signature), nil
}

func (a *Auth) sign(data []byte) []byte {
	mac := hmac.New(sha256.New, a.secretKey)
	mac.Write(data)
	return mac.Sum(nil)
}

func base64URLEncode(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

func base64URLDecode(s string) ([]byte, error) {
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.URLEncoding.DecodeString(s)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// InitAdmin creates the default admin account if none exists.
func InitAdmin(db Database, username, password string) error {
	existing, err := db.GetAdmin()
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	return db.SetAdmin(&AdminCredentials{
		Username:     username,
		PasswordHash: hash,
	})
}

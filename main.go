package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

//go:embed static
var staticFS embed.FS
var startTime = time.Now()

func main() {
	listen := flag.String("listen", ":2080", "HTTP listen address")
	dbPath := flag.String("db", "/etc/hydraflow/panel.json", "Path to database JSON file")
	xrayConfig := flag.String("xray-config", "/etc/hydraflow/xray-config.json", "Path to xray config JSON file")
	flag.Parse()
	db, err := NewDatabase(*dbPath)
	if err != nil { log.Fatalf("Failed to initialize database: %v", err) }
	xray := NewXrayManager(*xrayConfig)
	auth := NewAuthManager(db)
	h := NewHandler(db, xray, auth)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/login", h.Login)
	mux.HandleFunc("/api/status", auth.RequireAuth(h.Status))
	mux.HandleFunc("/api/users", auth.RequireAuth(h.Users))
	mux.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if strings.HasSuffix(p, "/toggle") { auth.RequireAuth(h.ToggleUser)(w, r); return }
		if strings.HasSuffix(p, "/sub") { auth.RequireAuth(h.UserSubLink)(w, r); return }
		auth.RequireAuth(h.UserByID)(w, r)
	})
	mux.HandleFunc("/api/settings", auth.RequireAuth(h.Settings))
	mux.HandleFunc("/api/xray/restart", auth.RequireAuth(h.XrayRestart))
	mux.HandleFunc("/api/xray/status", auth.RequireAuth(h.XrayStatus))
	mux.HandleFunc("/api/admin/password", auth.RequireAuth(h.ChangePassword))
	mux.HandleFunc("/api/intelligence", auth.RequireAuth(h.Intelligence))
	mux.HandleFunc("/api/intelligence/report", h.IntelligenceReport)
	mux.HandleFunc("/api/alerts", auth.RequireAuth(h.Alerts))
	mux.HandleFunc("/api/health", auth.RequireAuth(h.ProtocolHealthCheck))
	mux.HandleFunc("/sub/", h.Subscription)
	mux.HandleFunc("/p/", h.SubscriptionPage)
	sc, err := fs.Sub(staticFS, "static")
	if err != nil { log.Fatalf("Failed to load static files: %v", err) }
	fserv := http.FileServer(http.FS(sc))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" { r.URL.Path = "/index.html" }
		fserv.ServeHTTP(w, r)
	})
	srv := &http.Server{Addr: *listen, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() { <-quit; fmt.Println("\nShutting down..."); xray.Stop(); os.Exit(0) }()
	fmt.Printf("HydraFlow Panel starting on %s\n", *listen)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("Server error: %v", err) }
}

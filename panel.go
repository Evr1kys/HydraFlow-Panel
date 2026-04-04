package panel

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/Evr1kys/HydraFlow/xray"
)

// PanelConfig configures the admin panel server.
type PanelConfig struct {
	// Listen is the address the panel HTTP server listens on.
	Listen string `yaml:"listen"`

	// DatabasePath is the path to the JSON database file.
	DatabasePath string `yaml:"database_path"`

	// AdminUsername is the initial admin username (used on first run).
	AdminUsername string `yaml:"admin_username"`

	// AdminPassword is the initial admin password (used on first run).
	AdminPassword string `yaml:"admin_password"`

	// SessionTimeout is how long admin sessions last (in seconds).
	SessionTimeout int `yaml:"session_timeout"`

	// SubDomain is the public domain for subscription URLs.
	SubDomain string `yaml:"sub_domain"`

	// XrayConfig is the xray manager configuration.
	XrayConfig xray.ManagerConfig `yaml:"xray"`
}

// Panel is the main admin panel server that manages xray and serves the web UI.
type Panel struct {
	config  PanelConfig
	logger  *slog.Logger
	db      Database
	auth    *Auth
	hub     *Hub
	api     *API
	xrayInt *XrayIntegration
	server  *http.Server
	stopCh  chan struct{}
}

// New creates a new admin panel with the given configuration.
func New(config PanelConfig, logger *slog.Logger) (*Panel, error) {
	if logger == nil {
		logger = slog.Default()
	}

	// Apply defaults.
	if config.Listen == "" {
		config.Listen = ":2080"
	}
	if config.DatabasePath == "" {
		config.DatabasePath = "/etc/hydraflow/hydraflow.json"
	}
	if config.AdminUsername == "" {
		config.AdminUsername = "admin"
	}
	if config.AdminPassword == "" {
		config.AdminPassword = "admin"
	}
	if config.SessionTimeout <= 0 {
		config.SessionTimeout = 86400
	}

	// Initialize database.
	db, err := NewJSONDatabase(config.DatabasePath)
	if err != nil {
		return nil, fmt.Errorf("init database: %w", err)
	}

	// Initialize admin account if first run.
	if err := InitAdmin(db, config.AdminUsername, config.AdminPassword); err != nil {
		return nil, fmt.Errorf("init admin: %w", err)
	}

	// Save subscription domain in settings if provided.
	if config.SubDomain != "" {
		settings, _ := db.GetSettings()
		if settings != nil && settings.SubDomain == "" {
			settings.SubDomain = config.SubDomain
			settings.PanelListen = config.Listen
			db.SaveSettings(settings)
		}
	}

	// Initialize auth.
	sessionTimeout := time.Duration(config.SessionTimeout) * time.Second
	auth, err := NewAuth(db, sessionTimeout)
	if err != nil {
		return nil, fmt.Errorf("init auth: %w", err)
	}

	// Initialize real-time hub.
	hub := NewHub(logger)

	// Initialize xray manager.
	xrayCfg := config.XrayConfig
	if xrayCfg.XrayPath == "" {
		xrayCfg = xray.DefaultManagerConfig()
	}
	xrayMgr := xray.NewManager(xrayCfg, logger)

	// Initialize xray integration.
	xrayInt := NewXrayIntegration(xrayMgr, db, logger)

	// Initialize API.
	api := NewAPI(db, auth, hub, xrayInt, logger)

	return &Panel{
		config:  config,
		logger:  logger,
		db:      db,
		auth:    auth,
		hub:     hub,
		api:     api,
		xrayInt: xrayInt,
		stopCh:  make(chan struct{}),
	}, nil
}

// Database returns the panel's database for external integration.
func (p *Panel) Database() Database {
	return p.db
}

// Hub returns the panel's real-time event hub.
func (p *Panel) Hub() *Hub {
	return p.hub
}

// XrayIntegration returns the panel's xray integration layer.
func (p *Panel) XrayIntegration() *XrayIntegration {
	return p.xrayInt
}

// Start starts the admin panel HTTP server and xray process.
func (p *Panel) Start(ctx context.Context) error {
	mux := http.NewServeMux()

	// Register API routes.
	p.api.RegisterRoutes(mux)

	// Serve the embedded frontend at root.
	frontendHandler := staticHandler()
	mux.Handle("/", frontendHandler)

	p.server = &http.Server{
		Addr:              p.config.Listen,
		Handler:           p.corsMiddleware(p.recoveryMiddleware(mux)),
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	ln, err := net.Listen("tcp", p.config.Listen)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", p.config.Listen, err)
	}

	p.logger.Info("admin panel started",
		"addr", p.config.Listen,
		"database", p.config.DatabasePath,
	)

	// Start xray with current config.
	if err := p.xrayInt.SyncConfigAndReload(); err != nil {
		p.logger.Warn("initial xray start failed (may not be installed yet)", "error", err)
	}

	// Start traffic sync from xray stats.
	p.xrayInt.StartTrafficSync(30 * time.Second)

	// Start traffic broadcast to SSE clients.
	p.hub.StartTrafficBroadcast(p.db, 5*time.Second, p.stopCh)

	// Start remote server health checks.
	p.startHealthChecker(5 * time.Minute)

	errCh := make(chan error, 1)
	go func() {
		if err := p.server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case <-ctx.Done():
		p.logger.Info("admin panel shutting down (context cancelled)")
	case err := <-errCh:
		return fmt.Errorf("panel server error: %w", err)
	}

	return p.shutdown()
}

// Stop gracefully shuts down the admin panel.
func (p *Panel) Stop() error {
	close(p.stopCh)
	return p.shutdown()
}

func (p *Panel) shutdown() error {
	// Stop xray integration.
	p.xrayInt.Stop()

	if p.server != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := p.server.Shutdown(shutdownCtx); err != nil {
			p.logger.Error("panel server shutdown error", "error", err)
		}
	}

	if err := p.db.Close(); err != nil {
		p.logger.Error("database close error", "error", err)
	}

	p.logger.Info("admin panel shutdown complete")
	return nil
}

// startHealthChecker runs periodic health checks on remote servers.
func (p *Panel) startHealthChecker(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Run immediately once.
		p.checkRemoteServers()

		for {
			select {
			case <-p.stopCh:
				return
			case <-ticker.C:
				p.checkRemoteServers()
			}
		}
	}()
}

// checkRemoteServers pings each remote server to update its status.
func (p *Panel) checkRemoteServers() {
	servers, err := p.db.ListServers()
	if err != nil || len(servers) == 0 {
		return
	}

	for _, srv := range servers {
		if !srv.Enabled {
			continue
		}

		status := "offline"
		healthURL := fmt.Sprintf("http://%s:%d/api/v1/health", srv.Address, srv.Port)

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(healthURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				status = "online"
			}
		}

		srv.Status = status
		srv.LastHealthCheck = time.Now()
		p.db.UpdateServer(srv)
	}
}

func (p *Panel) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (p *Panel) recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rv := recover(); rv != nil {
				p.logger.Error("panic in panel handler",
					"panic", rv,
					"path", r.URL.Path,
					"method", r.Method,
				)
				writeJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "internal server error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

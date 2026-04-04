// hydraflow-panel is the HydraFlow admin panel that manages xray-core,
// users, servers, and subscriptions through a web interface.
//
// Usage:
//
//	hydraflow-panel                              Start with defaults
//	hydraflow-panel --listen :2080               Custom listen address
//	hydraflow-panel --db /etc/hydraflow/data.json  Custom database path
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Evr1kys/HydraFlow/panel"
	"github.com/Evr1kys/HydraFlow/xray"
)

var (
	version   = "dev"
	buildTime = "unknown"
)

func main() {
	listen := flag.String("listen", ":2080", "Panel listen address")
	dbPath := flag.String("db", "/etc/hydraflow/hydraflow.json", "Path to JSON database")
	adminUser := flag.String("admin-user", "admin", "Initial admin username")
	adminPass := flag.String("admin-pass", "admin", "Initial admin password")
	subDomain := flag.String("sub-domain", "", "Public domain for subscription URLs")
	xrayPath := flag.String("xray-path", "/usr/local/bin/xray", "Path to xray-core binary")
	xrayConfig := flag.String("xray-config", "/etc/hydraflow/xray.json", "Path for generated xray config")
	xrayAPIPort := flag.Int("xray-api-port", 10085, "Xray stats API port")
	logLevel := flag.String("log-level", "info", "Log level: debug, info, warn, error")
	showVersion := flag.Bool("version", false, "Print version")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "HydraFlow Panel %s (built %s)\n\n", version, buildTime)
		fmt.Fprintf(os.Stderr, "Admin panel for managing xray-core proxy users and servers.\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n  hydraflow-panel [flags]\n\nFlags:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nDefaults:\n")
		fmt.Fprintf(os.Stderr, "  Web UI:        http://localhost:2080\n")
		fmt.Fprintf(os.Stderr, "  Credentials:   admin / admin\n")
		fmt.Fprintf(os.Stderr, "  Database:      /etc/hydraflow/hydraflow.json\n")
	}
	flag.Parse()

	if *showVersion {
		fmt.Printf("hydraflow-panel %s (built %s)\n", version, buildTime)
		os.Exit(0)
	}

	level := slog.LevelInfo
	switch *logLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
	}))

	// Ensure database directory exists.
	dbDir := "/etc/hydraflow"
	if *dbPath != "/etc/hydraflow/hydraflow.json" {
		// Extract directory from custom path.
		for i := len(*dbPath) - 1; i >= 0; i-- {
			if (*dbPath)[i] == '/' {
				dbDir = (*dbPath)[:i]
				break
			}
		}
	}
	if err := os.MkdirAll(dbDir, 0750); err != nil {
		logger.Error("failed to create database directory", "path", dbDir, "error", err)
		os.Exit(1)
	}

	cfg := panel.PanelConfig{
		Listen:         *listen,
		DatabasePath:   *dbPath,
		AdminUsername:  *adminUser,
		AdminPassword:  *adminPass,
		SessionTimeout: 86400,
		SubDomain:      *subDomain,
		XrayConfig: xray.ManagerConfig{
			XrayPath:   *xrayPath,
			ConfigPath: *xrayConfig,
			AssetPath:  "/usr/local/share/xray",
			APIPort:    *xrayAPIPort,
		},
	}

	p, err := panel.New(cfg, logger)
	if err != nil {
		logger.Error("failed to initialize panel", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		logger.Info("received signal, shutting down", "signal", sig)
		cancel()
	}()

	logger.Info("starting HydraFlow panel",
		"version", version,
		"listen", *listen,
		"database", *dbPath,
	)

	if err := p.Start(ctx); err != nil {
		logger.Error("panel error", "error", err)
		os.Exit(1)
	}
}

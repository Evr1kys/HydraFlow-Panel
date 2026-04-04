package panel

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Evr1kys/HydraFlow/xray"
)

// XrayIntegration bridges the panel with the xray-core process.
// It manages config generation, process lifecycle, and traffic stats sync.
type XrayIntegration struct {
	mu      sync.Mutex
	manager *xray.XrayManager
	stats   *xray.StatsClient
	db      Database
	logger  *slog.Logger
	stopCh  chan struct{}
}

// NewXrayIntegration creates a new integration layer.
func NewXrayIntegration(manager *xray.XrayManager, db Database, logger *slog.Logger) *XrayIntegration {
	settings, _ := db.GetSettings()
	apiPort := 10085
	if settings != nil && settings.XrayAPIPort > 0 {
		apiPort = settings.XrayAPIPort
	}

	statsAddr := fmt.Sprintf("127.0.0.1:%d", apiPort)

	return &XrayIntegration{
		manager: manager,
		stats:   xray.NewStatsClient(statsAddr, logger),
		db:      db,
		logger:  logger,
		stopCh:  make(chan struct{}),
	}
}

// Manager returns the underlying xray manager.
func (xi *XrayIntegration) Manager() *xray.XrayManager {
	return xi.manager
}

// SyncConfigAndReload regenerates the xray config from the current database
// state (all enabled clients + enabled protocols from settings) and reloads xray.
func (xi *XrayIntegration) SyncConfigAndReload() error {
	xi.mu.Lock()
	defer xi.mu.Unlock()

	builder := xi.manager.Builder()

	// Clear existing inbounds and users.
	builder.Reset()
	settings, _ := xi.db.GetSettings()

	// Get all enabled clients.
	clients, _ := xi.db.ListClients()
	var enabledClients []*Client
	for _, c := range clients {
		if c.Enabled && !c.IsExpired() && !c.IsOverLimit() {
			enabledClients = append(enabledClients, c)
		}
	}

	// Configure inbounds from settings.
	if settings != nil {
		if settings.RealityEnabled && settings.RealityPort > 0 {
			inCfg := xray.InboundConfig{
				Tag:                "vless-reality",
				Type:               xray.InboundVLESSReality,
				Port:               settings.RealityPort,
				RealityPrivateKey:  settings.RealityPrivKey,
				RealityPublicKey:   settings.RealityPubKey,
				RealityDest:        settings.RealityDest,
				RealityServerNames: []string{settings.RealitySNI},
				Flow:               "xtls-rprx-vision",
			}
			if settings.RealityShortID != "" {
				inCfg.RealityShortIDs = []string{settings.RealityShortID}
			}
			builder.AddInbound(inCfg)
			for _, c := range enabledClients {
				builder.AddUser("vless-reality", c.Email, c.UUID)
			}
		}

		if settings.VLESSWSEnabled && settings.VLESSWSPort > 0 {
			inCfg := xray.InboundConfig{
				Tag:  "vless-ws",
				Type: xray.InboundVLESSWS,
				Port: settings.VLESSWSPort,
				Path: settings.VLESSWSPath,
				Host: settings.VLESSWSHost,
			}
			builder.AddInbound(inCfg)
			for _, c := range enabledClients {
				builder.AddUser("vless-ws", c.Email, c.UUID)
			}
		}

		if settings.VMessWSEnabled && settings.VMessWSPort > 0 {
			inCfg := xray.InboundConfig{
				Tag:  "vmess-ws",
				Type: xray.InboundVMessWS,
				Port: settings.VMessWSPort,
				Path: settings.VMessWSPath,
				Host: settings.VMessWSHost,
			}
			builder.AddInbound(inCfg)
			for _, c := range enabledClients {
				builder.AddUser("vmess-ws", c.Email, c.UUID)
			}
		}

		if settings.SSEnabled && settings.SSPort > 0 {
			inCfg := xray.InboundConfig{
				Tag:        "shadowsocks",
				Type:       xray.InboundShadowsocks,
				Port:       settings.SSPort,
				SSMethod:   settings.SSMethod,
				SSPassword: settings.SSPassword,
			}
			builder.AddInbound(inCfg)
			for _, c := range enabledClients {
				builder.AddUser("shadowsocks", c.Email, c.UUID)
			}
		}

		if settings.TrojanEnabled && settings.TrojanPort > 0 {
			inCfg := xray.InboundConfig{
				Tag:         "trojan-tls",
				Type:        xray.InboundTrojanTLS,
				Port:        settings.TrojanPort,
				TLSCertFile: settings.TrojanCertFile,
				TLSKeyFile:  settings.TrojanKeyFile,
			}
			builder.AddInbound(inCfg)
			for _, c := range enabledClients {
				builder.AddUser("trojan-tls", c.Email, c.UUID)
			}
		}

		if settings.XrayAPIPort > 0 {
			builder.APIPort = settings.XrayAPIPort
		}
	}

	// Reload xray (generates config + restarts).
	if err := xi.manager.Reload(); err != nil {
		xi.logger.Error("failed to reload xray", "error", err)
		return fmt.Errorf("reload xray: %w", err)
	}

	xi.logger.Info("xray config synced and reloaded",
		"enabled_clients", len(enabledClients),
	)
	return nil
}

// StartTrafficSync starts a background goroutine that periodically
// queries xray stats API and updates client traffic in the database.
func (xi *XrayIntegration) StartTrafficSync(interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-xi.stopCh:
				return
			case <-ticker.C:
				xi.syncTraffic()
			}
		}
	}()
}

// syncTraffic fetches traffic stats from xray and updates the database.
func (xi *XrayIntegration) syncTraffic() {
	status := xi.manager.Status()
	if !status.Running {
		return
	}

	// Get all user traffic with reset (so we get delta since last query).
	allTraffic, err := xi.stats.GetAllUserTraffic(true)
	if err != nil {
		xi.logger.Debug("failed to sync traffic stats", "error", err)
		return
	}

	if len(allTraffic) == 0 {
		return
	}

	clients, _ := xi.db.ListClients()
	for _, c := range clients {
		traffic, ok := allTraffic[c.Email]
		if !ok {
			continue
		}
		if traffic.Uplink > 0 || traffic.Downlink > 0 {
			if err := xi.db.UpdateClientTraffic(c.ID, traffic.Uplink, traffic.Downlink); err != nil {
				xi.logger.Error("failed to update client traffic",
					"client", c.Email,
					"error", err,
				)
			}
		}
	}

	// Record total traffic snapshot.
	var totalUp, totalDown int64
	for _, t := range allTraffic {
		totalUp += t.Uplink
		totalDown += t.Downlink
	}
	if totalUp > 0 || totalDown > 0 {
		xi.db.RecordTraffic(&TrafficRecord{
			Timestamp:   time.Now(),
			TotalUp:     totalUp,
			TotalDown:   totalDown,
			Connections: int64(len(allTraffic)),
		})
	}

	// Check for clients over limit and disable if needed.
	for _, c := range clients {
		if c.Enabled && c.IsOverLimit() {
			xi.logger.Info("client exceeded traffic limit, will be excluded on next sync",
				"email", c.Email,
			)
		}
	}
}

// Stop stops the background sync.
func (xi *XrayIntegration) Stop() {
	close(xi.stopCh)
}

// GetXrayStatus returns the current xray process status.
func (xi *XrayIntegration) GetXrayStatus() xray.ProcessStatus {
	return xi.manager.Status()
}

// RestartXray restarts the xray process.
func (xi *XrayIntegration) RestartXray() error {
	return xi.SyncConfigAndReload()
}

// StopXray stops the xray process.
func (xi *XrayIntegration) StopXray() error {
	return xi.manager.Stop()
}

// StartXray starts the xray process.
func (xi *XrayIntegration) StartXray() error {
	return xi.SyncConfigAndReload()
}

// GetUserTraffic returns live traffic stats for a specific user.
func (xi *XrayIntegration) GetUserTraffic(email string) (up, down int64, err error) {
	stats, err := xi.stats.GetUserTraffic(email)
	if err != nil {
		return 0, 0, err
	}
	return stats.Uplink, stats.Downlink, nil
}

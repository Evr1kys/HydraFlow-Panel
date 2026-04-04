package panel

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// GenerateSubscription creates a base64-encoded subscription response
// containing V2Ray/Clash-compatible share links for all enabled protocols.
// This is what clients like v2rayNG, Hiddify, Streisand consume.
func GenerateSubscription(client *Client, settings *ServerSettings, servers []*RemoteServer) string {
	var links []string

	serverIP := settings.ServerIP
	if serverIP == "" {
		serverIP = settings.SubDomain
	}
	if serverIP == "" {
		serverIP = "127.0.0.1"
	}

	// Local server links.
	links = append(links, generateServerLinks(client, settings, serverIP, "")...)

	// Remote server links (only healthy ones).
	for _, srv := range servers {
		if srv.Enabled && srv.Status == "online" {
			remoteSettings := *settings // copy
			// Remote servers share protocol config but have different IP.
			remoteLinks := generateServerLinks(client, &remoteSettings, srv.Address, srv.Name)
			links = append(links, remoteLinks...)
		}
	}

	combined := strings.Join(links, "\n")
	return base64.StdEncoding.EncodeToString([]byte(combined))
}

// generateServerLinks creates share links for a single server.
func generateServerLinks(client *Client, settings *ServerSettings, serverAddr, serverName string) []string {
	var links []string
	remark := serverAddr
	if serverName != "" {
		remark = serverName
	}

	// VLESS Reality
	if settings.RealityEnabled && settings.RealityPort > 0 {
		link := generateVLESSRealityLink(client, settings, serverAddr, remark)
		if link != "" {
			links = append(links, link)
		}
	}

	// VLESS WS (CDN or direct)
	if settings.VLESSWSEnabled && settings.VLESSWSPort > 0 {
		link := generateVLESSWSLink(client, settings, serverAddr, remark)
		if link != "" {
			links = append(links, link)
		}
		// If CDN is enabled, also generate CDN variant.
		if settings.CDNEnabled && settings.CDNDomain != "" {
			link := generateVLESSWSLink(client, settings, settings.CDNDomain, remark+" CDN")
			if link != "" {
				links = append(links, link)
			}
		}
	}

	// VMess WS
	if settings.VMessWSEnabled && settings.VMessWSPort > 0 {
		link := generateVMessWSLink(client, settings, serverAddr, remark)
		if link != "" {
			links = append(links, link)
		}
		if settings.CDNEnabled && settings.CDNDomain != "" {
			link := generateVMessWSLink(client, settings, settings.CDNDomain, remark+" CDN")
			if link != "" {
				links = append(links, link)
			}
		}
	}

	// Shadowsocks
	if settings.SSEnabled && settings.SSPort > 0 {
		link := generateSSLink(client, settings, serverAddr, remark)
		if link != "" {
			links = append(links, link)
		}
	}

	// Trojan
	if settings.TrojanEnabled && settings.TrojanPort > 0 {
		link := generateTrojanLink(client, settings, serverAddr, remark)
		if link != "" {
			links = append(links, link)
		}
	}

	return links
}

// generateVLESSRealityLink creates a vless:// share link for Reality.
func generateVLESSRealityLink(client *Client, settings *ServerSettings, addr, remark string) string {
	params := url.Values{}
	params.Set("type", "tcp")
	params.Set("security", "reality")
	params.Set("pbk", settings.RealityPubKey)
	params.Set("fp", "chrome")
	params.Set("sni", settings.RealitySNI)
	params.Set("flow", "xtls-rprx-vision")
	if settings.RealityShortID != "" {
		params.Set("sid", settings.RealityShortID)
	}

	return fmt.Sprintf("vless://%s@%s:%d?%s#%s",
		client.UUID,
		addr,
		settings.RealityPort,
		params.Encode(),
		url.PathEscape(remark+" Reality"),
	)
}

// generateVLESSWSLink creates a vless:// share link for WebSocket transport.
func generateVLESSWSLink(client *Client, settings *ServerSettings, addr, remark string) string {
	params := url.Values{}
	params.Set("type", "ws")
	params.Set("security", "none")
	path := settings.VLESSWSPath
	if path == "" {
		path = "/ws"
	}
	params.Set("path", path)
	if settings.VLESSWSHost != "" {
		params.Set("host", settings.VLESSWSHost)
	}

	return fmt.Sprintf("vless://%s@%s:%d?%s#%s",
		client.UUID,
		addr,
		settings.VLESSWSPort,
		params.Encode(),
		url.PathEscape(remark+" WS"),
	)
}

// generateVMessWSLink creates a vmess:// share link (base64 JSON format).
func generateVMessWSLink(client *Client, settings *ServerSettings, addr, remark string) string {
	path := settings.VMessWSPath
	if path == "" {
		path = "/vmess"
	}

	vmessConfig := map[string]interface{}{
		"v":    "2",
		"ps":   remark + " VMess",
		"add":  addr,
		"port": settings.VMessWSPort,
		"id":   client.UUID,
		"aid":  0,
		"scy":  "auto",
		"net":  "ws",
		"type": "none",
		"host": settings.VMessWSHost,
		"path": path,
		"tls":  "",
	}

	jsonBytes, err := json.Marshal(vmessConfig)
	if err != nil {
		return ""
	}
	return "vmess://" + base64.StdEncoding.EncodeToString(jsonBytes)
}

// generateSSLink creates an ss:// share link for Shadowsocks 2022.
func generateSSLink(client *Client, settings *ServerSettings, addr, remark string) string {
	method := settings.SSMethod
	if method == "" {
		method = "2022-blake3-aes-128-gcm"
	}

	// Shadowsocks 2022 uses server_password:user_password format.
	userInfo := fmt.Sprintf("%s:%s:%s", method, settings.SSPassword, client.UUID)
	encoded := base64.URLEncoding.EncodeToString([]byte(userInfo))

	return fmt.Sprintf("ss://%s@%s:%d#%s",
		encoded,
		addr,
		settings.SSPort,
		url.PathEscape(remark+" SS"),
	)
}

// generateTrojanLink creates a trojan:// share link.
func generateTrojanLink(client *Client, settings *ServerSettings, addr, remark string) string {
	params := url.Values{}
	params.Set("type", "tcp")
	params.Set("security", "tls")

	return fmt.Sprintf("trojan://%s@%s:%d?%s#%s",
		client.UUID,
		addr,
		settings.TrojanPort,
		params.Encode(),
		url.PathEscape(remark+" Trojan"),
	)
}

// SubscriptionURLs holds the generated subscription links for a client.
type SubscriptionURLs struct {
	HydraFlow string `json:"hydraflow"`
	HTTPS     string `json:"https"`
}

// GenerateSubURLs creates subscription URLs for a client.
func GenerateSubURLs(serverAddr, token string) *SubscriptionURLs {
	return &SubscriptionURLs{
		HydraFlow: fmt.Sprintf("hydraflow://connect/%s", token),
		HTTPS:     fmt.Sprintf("https://%s/sub/%s", serverAddr, token),
	}
}

package main

import (
	"encoding/json"
	"net/http"
	"sort"
	"sync"
	"time"
)

type ProtocolStatus struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	LastChecked string `json:"last_checked"`
}

type ISPData struct {
	Name      string           `json:"name"`
	ASN       string           `json:"asn"`
	Protocols []ProtocolStatus `json:"protocols"`
}

type CountryData struct {
	Country string    `json:"country"`
	ISPs    []ISPData `json:"isps"`
}

type BlockingReport struct {
	Country  string `json:"country"`
	ISP      string `json:"isp"`
	ASN      string `json:"asn"`
	Protocol string `json:"protocol"`
	Status   string `json:"status"`
}

type CensorshipAlert struct {
	Protocol  string `json:"protocol"`
	ISP       string `json:"isp"`
	Country   string `json:"country"`
	OldStatus string `json:"old_status"`
	NewStatus string `json:"new_status"`
	Timestamp string `json:"timestamp"`
}

type IntelligenceStore struct {
	mu        sync.RWMutex
	countries map[string]*CountryData
	alerts    []CensorshipAlert
}

func NewIntelligenceStore() *IntelligenceStore {
	s := &IntelligenceStore{
		countries: make(map[string]*CountryData),
		alerts:    []CensorshipAlert{},
	}
	s.seedData()
	return s
}

func (s *IntelligenceStore) seedData() {
	now := time.Now().UTC().Format(time.RFC3339)

	s.countries["russia"] = &CountryData{
		Country: "Russia",
		ISPs: []ISPData{
			{Name: "MegaFon", ASN: "AS31133", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "slow", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "working", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "MTS", ASN: "AS8359", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "slow", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "working", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "Beeline", ASN: "AS16345", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "slow", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "Tele2", ASN: "AS15493", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "working", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "working", LastChecked: now},
				{Name: "WireGuard", Status: "slow", LastChecked: now},
			}},
			{Name: "Rostelecom", ASN: "AS12389", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
		},
	}

	s.countries["china"] = &CountryData{
		Country: "China",
		ISPs: []ISPData{
			{Name: "China Telecom", ASN: "AS4134", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "China Unicom", ASN: "AS4837", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "China Mobile", ASN: "AS9808", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "blocked", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
		},
	}

	s.countries["iran"] = &CountryData{
		Country: "Iran",
		ISPs: []ISPData{
			{Name: "MCI (Hamrahe Aval)", ASN: "AS197207", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "Irancell", ASN: "AS44244", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "blocked", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "Rightel", ASN: "AS57218", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "slow", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "slow", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
			{Name: "Shatel", ASN: "AS31549", Protocols: []ProtocolStatus{
				{Name: "VLESS+Reality", Status: "working", LastChecked: now},
				{Name: "VLESS+WS", Status: "blocked", LastChecked: now},
				{Name: "Shadowsocks", Status: "blocked", LastChecked: now},
				{Name: "VMess+WS", Status: "blocked", LastChecked: now},
				{Name: "Trojan", Status: "working", LastChecked: now},
				{Name: "WireGuard", Status: "blocked", LastChecked: now},
			}},
		},
	}
}

func (s *IntelligenceStore) GetCountryData(country string) *CountryData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if d, ok := s.countries[country]; ok {
		cp := *d
		cp.ISPs = make([]ISPData, len(d.ISPs))
		copy(cp.ISPs, d.ISPs)
		return &cp
	}
	return nil
}

func (s *IntelligenceStore) GetAllCountries() []CountryData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]CountryData, 0, len(s.countries))
	for _, d := range s.countries {
		result = append(result, *d)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Country < result[j].Country
	})
	return result
}

func (s *IntelligenceStore) ProcessReport(report BlockingReport) {
	s.mu.Lock()
	defer s.mu.Unlock()

	country := report.Country
	cd, ok := s.countries[country]
	if !ok {
		cd = &CountryData{Country: country, ISPs: []ISPData{}}
		s.countries[country] = cd
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false
	for i, isp := range cd.ISPs {
		if isp.Name == report.ISP || isp.ASN == report.ASN {
			found = true
			protoFound := false
			for j, p := range cd.ISPs[i].Protocols {
				if p.Name == report.Protocol {
					protoFound = true
					oldStatus := p.Status
					if oldStatus != report.Status {
						cd.ISPs[i].Protocols[j].Status = report.Status
						cd.ISPs[i].Protocols[j].LastChecked = now
						s.alerts = append(s.alerts, CensorshipAlert{
							Protocol:  report.Protocol,
							ISP:       isp.Name,
							Country:   cd.Country,
							OldStatus: oldStatus,
							NewStatus: report.Status,
							Timestamp: now,
						})
						if len(s.alerts) > 200 {
							s.alerts = s.alerts[len(s.alerts)-200:]
						}
					}
					break
				}
			}
			if !protoFound {
				cd.ISPs[i].Protocols = append(cd.ISPs[i].Protocols, ProtocolStatus{
					Name:        report.Protocol,
					Status:      report.Status,
					LastChecked: now,
				})
			}
			break
		}
	}
	if !found {
		cd.ISPs = append(cd.ISPs, ISPData{
			Name: report.ISP,
			ASN:  report.ASN,
			Protocols: []ProtocolStatus{
				{Name: report.Protocol, Status: report.Status, LastChecked: now},
			},
		})
	}
}

func (s *IntelligenceStore) GetAlerts(limit int) []CensorshipAlert {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.alerts) {
		limit = len(s.alerts)
	}
	result := make([]CensorshipAlert, limit)
	for i := 0; i < limit; i++ {
		result[i] = s.alerts[len(s.alerts)-limit+i]
	}
	// Reverse so newest first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

// HTTP handlers

func (h *Handler) Intelligence(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		jsonError(w, 405, "method not allowed")
		return
	}
	country := r.URL.Query().Get("country")
	if country != "" {
		d := h.intel.GetCountryData(country)
		if d == nil {
			jsonError(w, 404, "country not found")
			return
		}
		jsonResponse(w, 200, d)
		return
	}
	jsonResponse(w, 200, h.intel.GetAllCountries())
}

func (h *Handler) IntelligenceReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		jsonError(w, 405, "method not allowed")
		return
	}
	var report BlockingReport
	if json.NewDecoder(r.Body).Decode(&report) != nil {
		jsonError(w, 400, "bad request")
		return
	}
	if report.Country == "" || report.ISP == "" || report.Protocol == "" || report.Status == "" {
		jsonError(w, 400, "missing required fields: country, isp, protocol, status")
		return
	}
	validStatuses := map[string]bool{"working": true, "slow": true, "blocked": true, "unknown": true}
	if !validStatuses[report.Status] {
		jsonError(w, 400, "status must be: working, slow, blocked, or unknown")
		return
	}
	h.intel.ProcessReport(report)
	jsonResponse(w, 200, map[string]string{"status": "accepted"})
}

func (h *Handler) Alerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		jsonError(w, 405, "method not allowed")
		return
	}
	alerts := h.intel.GetAlerts(50)
	jsonResponse(w, 200, alerts)
}

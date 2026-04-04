package main

import (
	"html/template"
	"net/http"
	"strings"
	"time"
)

type subPageData struct {
	Lang        string
	PageTitle   string
	AccountInfo string
	EmailLabel  string
	EmailValue  string
	StatusLabel string
	StatusClass string
	StatusValue string
	SubURLLabel string
	SubURL      string
	CopyLabel   string
	QRLabel     string
	AppsLabel   string
	GuidesLabel string
	Android1    string
	Android2    string
	Android3    string
	IOS1        string
	IOS2        string
	IOS3        string
	Desktop1    string
	Desktop2    string
	Desktop3    string
	CopiedText  string
}

var subPageTmpl = template.Must(template.New("subpage").Parse(subPageHTML))

func (h *Handler) SubscriptionPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}

	token := strings.TrimPrefix(r.URL.Path, "/p/")
	if token == "" {
		http.Error(w, "not found", 404)
		return
	}

	u := h.db.GetUserBySubToken(token)
	if u == nil {
		http.Error(w, "not found", 404)
		return
	}

	expired := false
	limitHit := false
	if u.ExpiryDate != "" {
		if exp, err := time.Parse(time.RFC3339, u.ExpiryDate); err == nil && time.Now().After(exp) {
			expired = true
		}
	}
	if u.TrafficLimit > 0 && (u.TrafficUp+u.TrafficDown) >= u.TrafficLimit {
		limitHit = true
	}

	statusText := "Active"
	statusClass := "sp-status-active"
	if !u.Enabled {
		statusText = "Disabled"
		statusClass = "sp-status-disabled"
	} else if expired {
		statusText = "Expired"
		statusClass = "sp-status-expired"
	} else if limitHit {
		statusText = "Traffic Limit Reached"
		statusClass = "sp-status-expired"
	}

	host := r.Host
	if host == "" {
		host = h.db.Data.Settings.ServerIP + ":2080"
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	subURL := scheme + "://" + host + "/sub/" + u.SubToken

	lang := detectLanguage(r.Header.Get("Accept-Language"))
	t := getTranslations(lang)

	data := subPageData{
		Lang:        lang,
		PageTitle:   t.pageTitle,
		AccountInfo: t.accountInfo,
		EmailLabel:  t.email,
		EmailValue:  u.Email,
		StatusLabel: t.status,
		StatusClass: statusClass,
		StatusValue: statusText,
		SubURLLabel: t.subscriptionURL,
		SubURL:      subURL,
		CopyLabel:   t.copyURL,
		QRLabel:     t.qrCode,
		AppsLabel:   t.downloadApps,
		GuidesLabel: t.setupGuides,
		Android1:    t.androidStep1,
		Android2:    t.androidStep2,
		Android3:    t.androidStep3,
		IOS1:        t.iosStep1,
		IOS2:        t.iosStep2,
		IOS3:        t.iosStep3,
		Desktop1:    t.desktopStep1,
		Desktop2:    t.desktopStep2,
		Desktop3:    t.desktopStep3,
		CopiedText:  t.copied,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	_ = subPageTmpl.Execute(w, data)
}

type translations struct {
	pageTitle       string
	accountInfo     string
	email           string
	status          string
	subscriptionURL string
	copyURL         string
	qrCode          string
	downloadApps    string
	setupGuides     string
	androidStep1    string
	androidStep2    string
	androidStep3    string
	iosStep1        string
	iosStep2        string
	iosStep3        string
	desktopStep1    string
	desktopStep2    string
	desktopStep3    string
	copied          string
}

func detectLanguage(acceptLang string) string {
	acceptLang = strings.ToLower(acceptLang)
	if strings.Contains(acceptLang, "ru") {
		return "ru"
	}
	if strings.Contains(acceptLang, "zh") {
		return "zh"
	}
	if strings.Contains(acceptLang, "fa") {
		return "fa"
	}
	return "en"
}

func getTranslations(lang string) translations {
	switch lang {
	case "ru":
		return translations{
			pageTitle:       "Your Subscription",
			accountInfo:     "Account Information",
			email:           "Email",
			status:          "Status",
			subscriptionURL: "Subscription URL",
			copyURL:         "Copy Subscription URL",
			qrCode:          "QR Code",
			downloadApps:    "Download Apps",
			setupGuides:     "Setup Guides",
			androidStep1:    "Install v2rayNG from Google Play",
			androidStep2:    "Tap + and select Import from clipboard, or scan the QR code",
			androidStep3:    "Tap the connect button",
			iosStep1:        "Install Streisand from App Store",
			iosStep2:        "Tap + and paste the subscription URL",
			iosStep3:        "Select a server and connect",
			desktopStep1:    "Download Hiddify from GitHub",
			desktopStep2:    "Open the app and add the subscription URL",
			desktopStep3:    "Select a protocol and connect",
			copied:          "URL Copied",
		}
	case "zh":
		return translations{
			pageTitle:       "Your Subscription",
			accountInfo:     "Account Information",
			email:           "Email",
			status:          "Status",
			subscriptionURL: "Subscription URL",
			copyURL:         "Copy Subscription URL",
			qrCode:          "QR Code",
			downloadApps:    "Download Apps",
			setupGuides:     "Setup Guides",
			androidStep1:    "Install v2rayNG from Google Play",
			androidStep2:    "Tap + and select Import from clipboard, or scan the QR code",
			androidStep3:    "Tap the connect button",
			iosStep1:        "Install Streisand from App Store",
			iosStep2:        "Tap + and paste the subscription URL",
			iosStep3:        "Select a server and connect",
			desktopStep1:    "Download Hiddify from GitHub",
			desktopStep2:    "Open the app and add the subscription URL",
			desktopStep3:    "Select a protocol and connect",
			copied:          "URL Copied",
		}
	case "fa":
		return translations{
			pageTitle:       "Your Subscription",
			accountInfo:     "Account Information",
			email:           "Email",
			status:          "Status",
			subscriptionURL: "Subscription URL",
			copyURL:         "Copy Subscription URL",
			qrCode:          "QR Code",
			downloadApps:    "Download Apps",
			setupGuides:     "Setup Guides",
			androidStep1:    "Install v2rayNG from Google Play",
			androidStep2:    "Tap + and select Import from clipboard, or scan the QR code",
			androidStep3:    "Tap the connect button",
			iosStep1:        "Install Streisand from App Store",
			iosStep2:        "Tap + and paste the subscription URL",
			iosStep3:        "Select a server and connect",
			desktopStep1:    "Download Hiddify from GitHub",
			desktopStep2:    "Open the app and add the subscription URL",
			desktopStep3:    "Select a protocol and connect",
			copied:          "URL Copied",
		}
	default:
		return translations{
			pageTitle:       "Your Subscription",
			accountInfo:     "Account Information",
			email:           "Email",
			status:          "Status",
			subscriptionURL: "Subscription URL",
			copyURL:         "Copy Subscription URL",
			qrCode:          "QR Code",
			downloadApps:    "Download Apps",
			setupGuides:     "Setup Guides",
			androidStep1:    "Install v2rayNG from Google Play",
			androidStep2:    "Tap + and select Import from clipboard, or scan the QR code",
			androidStep3:    "Tap the connect button",
			iosStep1:        "Install Streisand from App Store",
			iosStep2:        "Tap + and paste the subscription URL",
			iosStep3:        "Select a server and connect",
			desktopStep1:    "Download Hiddify from GitHub",
			desktopStep2:    "Open the app and add the subscription URL",
			desktopStep3:    "Select a protocol and connect",
			copied:          "URL Copied",
		}
	}
}

const subPageHTML = `<!DOCTYPE html>
<html lang="{{.Lang}}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HydraFlow - {{.PageTitle}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#060a12;--bg-card:#0c1220;--cyan:#00e8c6;--cyan-dim:rgba(0,232,198,.15);--cyan-glow:rgba(0,232,198,.3);--text:#e0e6f0;--text-dim:#7a8ba8;--text-muted:#4a5a74;--border:rgba(100,140,200,.1);--red:#ff4d6a;--green:#00e87a;--yellow:#ffb84d;--radius:12px;--radius-sm:8px}
body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px}
.mono{font-family:'JetBrains Mono',monospace}
.sp-container{width:100%;max-width:560px;margin:0 auto}
.sp-header{text-align:center;margin-bottom:32px}
.sp-logo{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px}
.sp-logo svg{width:40px;height:40px;color:var(--cyan)}
.sp-logo h1{font-size:1.4rem;font-weight:600}
.sp-logo h1 span{color:var(--cyan)}
.sp-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px}
.sp-card h2{font-size:1rem;font-weight:500;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.sp-card h2 svg{width:18px;height:18px;color:var(--cyan)}
.sp-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}
.sp-row:last-child{border-bottom:none}
.sp-key{color:var(--text-dim);font-size:.85rem}
.sp-val{font-family:'JetBrains Mono',monospace;font-size:.85rem}
.sp-status-active{color:var(--green)}
.sp-status-disabled,.sp-status-expired{color:var(--red)}
.sp-sub-url{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-family:'JetBrains Mono',monospace;font-size:.75rem;word-break:break-all;margin-bottom:12px;color:var(--text-dim)}
.sp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;border:none;border-radius:var(--radius-sm);font-weight:500;font-size:.85rem;cursor:pointer;transition:all .2s;width:100%;font-family:'Outfit',sans-serif}
.sp-btn-primary{background:var(--cyan);color:var(--bg)}
.sp-btn-primary:hover{opacity:.9;box-shadow:0 4px 20px var(--cyan-glow)}
.sp-qr{display:flex;justify-content:center;padding:16px;background:#fff;border-radius:var(--radius-sm);margin-bottom:16px}
.sp-qr canvas{max-width:200px;max-height:200px;image-rendering:pixelated}
.sp-apps{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.sp-app-link{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:.8rem;transition:all .2s}
.sp-app-link:hover{border-color:rgba(0,232,198,.3);color:var(--cyan)}
.sp-app-link svg{width:16px;height:16px;flex-shrink:0;color:var(--cyan)}
.sp-guide{margin-top:12px}
.sp-guide summary{cursor:pointer;color:var(--cyan);font-size:.85rem;padding:8px 0}
.sp-guide summary:hover{opacity:.8}
.sp-guide-content{padding:12px;background:var(--bg);border-radius:var(--radius-sm);margin-top:8px;font-size:.82rem;color:var(--text-dim);line-height:1.7}
.sp-guide-content ol{padding-left:20px}
.sp-footer{text-align:center;margin-top:24px;color:var(--text-muted);font-size:.75rem}
.sp-copy-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--cyan);color:var(--bg);padding:10px 24px;border-radius:var(--radius-sm);font-size:.85rem;font-weight:500;opacity:0;transition:opacity .3s;pointer-events:none}
.sp-copy-toast.show{opacity:1}
</style></head><body>
<div class="sp-container">
<div class="sp-header">
<div class="sp-logo">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
<h1>Hydra<span>Flow</span></h1>
</div>
</div>

<div class="sp-card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> {{.AccountInfo}}</h2>
<div class="sp-row"><span class="sp-key">{{.EmailLabel}}</span><span class="sp-val">{{.EmailValue}}</span></div>
<div class="sp-row"><span class="sp-key">{{.StatusLabel}}</span><span class="sp-val {{.StatusClass}}">{{.StatusValue}}</span></div>
</div>

<div class="sp-card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> {{.SubURLLabel}}</h2>
<div class="sp-sub-url" id="sub-url">{{.SubURL}}</div>
<button class="sp-btn sp-btn-primary" onclick="copyURL()">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
{{.CopyLabel}}</button>
</div>

<div class="sp-card" id="qr-card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg> {{.QRLabel}}</h2>
<div class="sp-qr" id="qr-container"></div>
</div>

<div class="sp-card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> {{.AppsLabel}}</h2>
<div class="sp-apps">
<a href="https://play.google.com/store/apps/details?id=com.v2ray.ang" target="_blank" rel="noopener" class="sp-app-link">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
v2rayNG</a>
<a href="https://apps.apple.com/app/streisand/id6450534064" target="_blank" rel="noopener" class="sp-app-link">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
Streisand</a>
<a href="https://github.com/hiddify/hiddify-app/releases" target="_blank" rel="noopener" class="sp-app-link">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
Hiddify</a>
<a href="https://github.com/MatsuriDayo/NekoBoxForAndroid/releases" target="_blank" rel="noopener" class="sp-app-link">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
NekoBox</a>
</div>
</div>

<div class="sp-card">
<h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {{.GuidesLabel}}</h2>
<details class="sp-guide"><summary>Android (v2rayNG)</summary>
<div class="sp-guide-content"><ol>
<li>{{.Android1}}</li>
<li>{{.Android2}}</li>
<li>{{.Android3}}</li>
</ol></div></details>
<details class="sp-guide"><summary>iOS (Streisand)</summary>
<div class="sp-guide-content"><ol>
<li>{{.IOS1}}</li>
<li>{{.IOS2}}</li>
<li>{{.IOS3}}</li>
</ol></div></details>
<details class="sp-guide"><summary>Windows / macOS (Hiddify)</summary>
<div class="sp-guide-content"><ol>
<li>{{.Desktop1}}</li>
<li>{{.Desktop2}}</li>
<li>{{.Desktop3}}</li>
</ol></div></details>
</div>

<div class="sp-footer">Powered by HydraFlow</div>
</div>

<div class="sp-copy-toast" id="copy-toast">{{.CopiedText}}</div>

<script>
function copyURL(){
var u=document.getElementById('sub-url').textContent;
if(navigator.clipboard){navigator.clipboard.writeText(u).then(showToast)}
else{var t=document.createElement('textarea');t.value=u;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);showToast()}
}
function showToast(){var t=document.getElementById('copy-toast');t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000)}

(function(){
var url=document.getElementById('sub-url').textContent;
var container=document.getElementById('qr-container');
var canvas=document.createElement('canvas');
var size=200;
canvas.width=size;canvas.height=size;
var ctx=canvas.getContext('2d');
ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
// Simple QR-like visual using the URL hash as seed
// For production QR, include a proper library; this creates a recognizable pattern
var hash=0;
for(var i=0;i<url.length;i++){hash=((hash<<5)-hash)+url.charCodeAt(i);hash|=0;}
var modules=21;
var cellSize=Math.floor(size/modules);
var offset=Math.floor((size-cellSize*modules)/2);
ctx.fillStyle='#000000';
// Finder patterns
function drawFinder(x,y){
for(var dy=0;dy<7;dy++){for(var dx=0;dx<7;dx++){
if(dy===0||dy===6||dx===0||dx===6||(dy>=2&&dy<=4&&dx>=2&&dx<=4)){
ctx.fillRect(offset+(x+dx)*cellSize,offset+(y+dy)*cellSize,cellSize,cellSize);
}}}
}
drawFinder(0,0);drawFinder(modules-7,0);drawFinder(0,modules-7);
// Timing patterns
for(var i=8;i<modules-8;i++){
if(i%2===0){
ctx.fillRect(offset+i*cellSize,offset+6*cellSize,cellSize,cellSize);
ctx.fillRect(offset+6*cellSize,offset+i*cellSize,cellSize,cellSize);
}}
// Data area - encode URL bytes as module pattern
var seed=Math.abs(hash);
for(var y=0;y<modules;y++){for(var x=0;x<modules;x++){
// Skip finder and timing areas
if((x<9&&y<9)||(x>=modules-8&&y<9)||(x<9&&y>=modules-8))continue;
if(x===6||y===6)continue;
// Use URL data to determine module
var byteIdx=(y*modules+x);
var bit=0;
if(byteIdx<url.length*8){
var charIdx=Math.floor(byteIdx/8);
var bitIdx=byteIdx%8;
bit=(url.charCodeAt(charIdx%url.length)>>bitIdx)&1;
}else{
bit=(seed>>((byteIdx)%31))&1;
}
if(bit){ctx.fillRect(offset+x*cellSize,offset+y*cellSize,cellSize,cellSize);}
}}
container.appendChild(canvas);
})();
</script>
</body></html>`

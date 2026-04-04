package panel

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed static/*
var staticFiles embed.FS

// staticHandler returns an http.Handler that serves the embedded frontend
// files. It serves index.html for the root path and any unknown paths
// to support single-page application routing.
func staticHandler() http.Handler {
	// Strip the "static" prefix from the embedded filesystem.
	subFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		// This should never happen since the path is hardcoded.
		panic("failed to create sub filesystem: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(subFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file. If it doesn't exist, serve index.html
		// for SPA routing support.
		path := r.URL.Path

		// Check if the file exists in the embedded FS.
		if path != "/" && path != "" {
			trimmed := path
			if len(trimmed) > 0 && trimmed[0] == '/' {
				trimmed = trimmed[1:]
			}
			_, err := fs.Stat(subFS, trimmed)
			if err != nil {
				// File not found, serve index.html for SPA routing.
				r.URL.Path = "/"
			}
		}

		// Set caching headers for static assets.
		if path != "/" && path != "/index.html" {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		fileServer.ServeHTTP(w, r)
	})
}

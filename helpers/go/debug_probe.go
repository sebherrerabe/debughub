package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
)

type DebugProbeMeta struct {
	HypothesisID *string            `json:"hypothesisId"`
	Loc          *string            `json:"loc"`
	Level        string             `json:"level"`
	Tags         map[string]string  `json:"tags"`
}

func DebugProbe(label string, data interface{}, meta *DebugProbeMeta) {
	defer func() {
		_ = recover()
	}()

	if os.Getenv("DEBUGHUB_ENABLED") != "1" {
		return
	}

	sessionID := os.Getenv("DEBUGHUB_SESSION")
	if sessionID == "" {
		return
	}

	endpoint := os.Getenv("DEBUGHUB_ENDPOINT")
	if endpoint == "" {
		return
	}

	level := "info"
	var hypothesisID *string
	var loc *string
	var tags map[string]string
	if meta != nil {
		if meta.Level == "info" || meta.Level == "warn" || meta.Level == "error" {
			level = meta.Level
		}
		hypothesisID = meta.HypothesisID
		loc = meta.Loc
		tags = meta.Tags
	}

	event := map[string]interface{}{
		"ts":           time.Now().UTC().Format(time.RFC3339Nano),
		"sessionId":    sessionID,
		"label":        label,
		"data":         data,
		"hypothesisId": hypothesisID,
		"loc":          loc,
		"level":        level,
		"tags":         tags,
		"runtime":      "go",
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	target := strings.TrimRight(endpoint, "/") + "/event"
	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

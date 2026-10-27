// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gulindev/gulin/pkg/aiusechat/uctypes"
	"github.com/gulindev/gulin/pkg/gulinobj"
	"github.com/gulindev/gulin/pkg/wcore"
	"github.com/gulindev/gulin/pkg/wshrpc"
	"github.com/gulindev/gulin/pkg/wshrpc/wshclient"
	"github.com/gulindev/gulin/pkg/wstore"
)

type WebNavigateToolInput struct {
	WidgetId string `json:"widget_id,omitempty"`
	Url      string `json:"url"`
}

func parseWebNavigateInput(input any) (*WebNavigateToolInput, error) {
	result := &WebNavigateToolInput{}

	if input == nil {
		return nil, fmt.Errorf("input is required")
	}

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	if err := json.Unmarshal(inputBytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}

	if result.Url == "" {
		return nil, fmt.Errorf("url is required")
	}

	url := strings.TrimSpace(result.Url)
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "file://") {
		url = "https://" + url
	}
	result.Url = url

	return result, nil
}

func findWebBlockId(ctx context.Context, tabId string) (string, error) {
	tab, err := wstore.DBMustGet[*gulinobj.Tab](ctx, tabId)
	if err != nil {
		return "", err
	}
	for _, blockId := range tab.BlockIds {
		block, err := wstore.DBGet[*gulinobj.Block](ctx, blockId)
		if err != nil || block == nil || block.Meta == nil {
			continue
		}
		if block.Meta.GetString(gulinobj.MetaKey_View, "") == "web" {
			return blockId, nil
		}
	}
	return "", nil
}

func GetWebNavigateToolDefinition(tabId string) uctypes.ToolDefinition {

	return uctypes.ToolDefinition{
		Name:        "web_navigate",
		DisplayName: "Navigate Web Widget",
		Description: "Open or navigate a web browser to a URL. If a web browser is already open in the workspace, it navigates it to the URL. If no web browser is open, it automatically OPENS a new web browser widget and navigates to the URL.",
		ToolLogName: "web:navigate",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Optional 8-character widget ID of an existing web browser. If omitted, uses the current web browser or opens a new one automatically.",
				},
				"url": map[string]any{
					"type":        "string",
					"description": "URL to navigate to (e.g. https://www.lun.com)",
				},
			},
			"required": []string{"url"},
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseWebNavigateInput(input)
			if err != nil {
				return fmt.Sprintf("error parsing input: %v", err)
			}
			if parsed.WidgetId != "" {
				return fmt.Sprintf("navigating web widget %s to %q", parsed.WidgetId, parsed.Url)
			}
			return fmt.Sprintf("opening web browser to %q", parsed.Url)
		},
		ToolAnyCallback: func(ctx context.Context, input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseWebNavigateInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			var targetBlockId string
			if parsed.WidgetId != "" {
				fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, parsed.WidgetId)
				if err == nil {
					targetBlockId = fullBlockId
				}
			}

			if targetBlockId == "" {
				targetBlockId, _ = findWebBlockId(ctx, tabId)
			}

			if targetBlockId != "" {
				blockORef := gulinobj.MakeORef(gulinobj.OType_Block, targetBlockId)
				meta := map[string]any{
					"url": parsed.Url,
				}

				err = wstore.UpdateObjectMeta(ctx, blockORef, meta, false)
				if err != nil {
					return nil, fmt.Errorf("failed to update web block URL: %w", err)
				}

				wcore.SendGulinObjUpdate(blockORef)
				shortId := targetBlockId
				if len(shortId) > 8 {
					shortId = shortId[:8]
				}
				return fmt.Sprintf("Navegador web actualizado a: %s (widget: %s)", parsed.Url, shortId), nil
			}

			// Si no hay navegador web abierto, se crea y abre uno automáticamente
			rpcClient := wshclient.GetBareRpcClient()
			newBlockORef, err := wshclient.CreateBlockCommand(rpcClient, wshrpc.CommandCreateBlockData{
				TabId: tabId,
				BlockDef: &gulinobj.BlockDef{
					Meta: map[string]any{
						"view": "web",
						"url":  parsed.Url,
					},
				},
			}, nil)
			if err != nil {
				return nil, fmt.Errorf("falló al abrir automáticamente el navegador web: %w", err)
			}

			oid := newBlockORef.OID
			shortId := oid
			if len(shortId) > 8 {
				shortId = shortId[:8]
			}
			return fmt.Sprintf("Navegador web abierto automáticamente y navegando a: %s (widget: %s)", parsed.Url, shortId), nil
		},
	}
}

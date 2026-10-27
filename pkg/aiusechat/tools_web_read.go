// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gulindev/gulin/pkg/aiusechat/uctypes"
	"github.com/gulindev/gulin/pkg/wcore"
	"github.com/gulindev/gulin/pkg/wshrpc"
	"github.com/gulindev/gulin/pkg/wshrpc/wshclient"
	"github.com/gulindev/gulin/pkg/wstore"
)

type WebReadPageToolInput struct {
	WidgetId string `json:"widget_id,omitempty"`
}

func parseWebReadPageInput(input any) (*WebReadPageToolInput, error) {
	result := &WebReadPageToolInput{}

	if input == nil {
		return result, nil
	}

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	if err := json.Unmarshal(inputBytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}

	return result, nil
}

// GetWebReadPageToolDefinition returns the tool definition for extracting text content from a web page.
// This tool allows the AI to "read" the visible text of the current web browser widget.
func GetWebReadPageToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "web_read_page",
		DisplayName: "Read Web Page (Raw Text Fallback)",
		Description: "FALLBACK ONLY: Extracts raw text content from a web page. PROHIBITED to call first if the page could have structured tools. You MUST ALWAYS call 'webmcp_list_tools' first (especially on Wikipedia, Mercado Libre, e-commerce, documentation) to check for native tools and invoke them via 'webmcp_call_tool'. Use 'web_read_page' ONLY when 'webmcp_list_tools' returns no tools.",
		ToolLogName: "web:read",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Optional 8-character widget ID of the web browser widget. If omitted, reads from the open web browser.",
				},
			},
			"required": []string{},
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseWebReadPageInput(input)
			if err != nil {
				return fmt.Sprintf("error parsing input: %v", err)
			}
			if parsed.WidgetId != "" {
				return fmt.Sprintf("reading web page content from %s", parsed.WidgetId)
			}
			return "reading web page content from active browser"
		},
		ToolAnyCallback: func(ctx context.Context, input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseWebReadPageInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancelFn()

			var fullBlockId string
			if parsed.WidgetId != "" {
				resolvedId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, parsed.WidgetId)
				if err == nil {
					fullBlockId = resolvedId
				}
			}

			if fullBlockId == "" {
				fullBlockId, _ = findWebBlockId(ctx, tabId)
			}

			if fullBlockId == "" {
				return nil, fmt.Errorf("no hay ningún navegador web abierto en este espacio. Usa primero 'web_navigate' para abrir la página deseada.")
			}

			workspaceId, err := wstore.DBFindWorkspaceForTabId(ctx, tabId)
			if err != nil {
				return nil, fmt.Errorf("failed to find workspace for tab: %w", err)
			}

			rpcClient := wshclient.GetBareRpcClient()
			text, err := wshclient.WebGetTextCommand(
				rpcClient,
				wshrpc.CommandWebGetTextData{
					WorkspaceId: workspaceId,
					TabId:       tabId,
					BlockId:     fullBlockId,
				},
				&wshrpc.RpcOpts{Route: "electron"},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to extract web text: %w", err)
			}
			return text, nil
		},
	}
}

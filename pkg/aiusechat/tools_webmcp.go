// Copyright 2026, Command Line Inc.
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

type WebMCPCallToolInput struct {
	WidgetId string         `json:"widget_id,omitempty"`
	ToolName string         `json:"tool_name"`
	Params   map[string]any `json:"params,omitempty"`
}

func parseWebMCPCallInput(input any) (*WebMCPCallToolInput, error) {
	result := &WebMCPCallToolInput{}
	if input == nil {
		return nil, fmt.Errorf("tool_name is required")
	}

	bytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	if err := json.Unmarshal(bytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}

	if result.ToolName == "" {
		return nil, fmt.Errorf("tool_name is required")
	}

	if result.Params == nil {
		result.Params = make(map[string]any)
	}

	return result, nil
}

// GetWebMCPListToolDefinition lists tools registered on the page via document.modelContext
func GetWebMCPListToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "webmcp_list_tools",
		DisplayName: "List WebMCP In-Page Tools",
		Description: "PRIMARY TOOL FOR WEBPAGES: Discover native WebMCP tools exposed by the current web page (e.g. Wikipedia summary and sections, Mercado Libre search and products, Google results). ALWAYS call this tool first upon opening or analyzing any webpage before attempting raw text extraction.",
		ToolLogName: "webmcp:list",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Optional widget ID. If omitted, discovers tools on the open browser widget.",
				},
			},
			"required": []string{},
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			return "Consultando herramientas nativas WebMCP de la página web"
		},
		ToolAnyCallback: func(ctx context.Context, input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			var fullBlockId string
			if inputMap, ok := input.(map[string]any); ok {
				if wid, ok := inputMap["widget_id"].(string); ok && wid != "" {
					fullBlockId, _ = wcore.ResolveBlockIdFromPrefix(ctx, tabId, wid)
				}
			}

			if fullBlockId == "" {
				fullBlockId, _ = findWebBlockId(ctx, tabId)
			}

			if fullBlockId == "" {
				return nil, fmt.Errorf("no hay navegador web abierto para consultar herramientas WebMCP")
			}

			workspaceId, err := wstore.DBFindWorkspaceForTabId(ctx, tabId)
			if err != nil {
				return nil, fmt.Errorf("failed to find workspace: %w", err)
			}

			rpcClient := wshclient.GetBareRpcClient()
			data := wshrpc.CommandWebMCPListData{
				WorkspaceId: workspaceId,
				TabId:       tabId,
				BlockId:     fullBlockId,
			}

			toolsJson, err := wshclient.WebMCPListCommand(rpcClient, data, &wshrpc.RpcOpts{Route: "electron"})
			if err != nil {
				return nil, fmt.Errorf("failed to list WebMCP tools: %w", err)
			}

			return toolsJson, nil
		},
	}
}

// GetWebMCPCallToolDefinition executes a tool on the page via document.modelContext.executeTool
func GetWebMCPCallToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "webmcp_call_tool",
		DisplayName: "Execute WebMCP In-Page Tool",
		Description: "Executes a native WebMCP tool directly inside the web page client-side (e.g. 'mercadolibre_search', 'mercadolibre_get_page_items', 'wikipedia_get_summary'). Interacts directly with the site's own JavaScript logic without fragile scraping.",
		ToolLogName: "webmcp:call",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tool_name": map[string]any{
					"type":        "string",
					"description": "The exact name of the WebMCP tool to invoke (e.g. 'mercadolibre_get_page_items', 'mercadolibre_search', 'wikipedia_get_summary')",
				},
				"params": map[string]any{
					"type":        "object",
					"description": "Structured parameters expected by the WebMCP tool",
				},
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Optional widget ID. If omitted, runs on the active web browser.",
				},
			},
			"required": []string{"tool_name"},
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseWebMCPCallInput(input)
			if err != nil {
				return "ejecutando herramienta WebMCP"
			}
			return fmt.Sprintf("Ejecutando WebMCP: %s", parsed.ToolName)
		},
		ToolAnyCallback: func(ctx context.Context, input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseWebMCPCallInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancelFn()

			var fullBlockId string
			if parsed.WidgetId != "" {
				fullBlockId, _ = wcore.ResolveBlockIdFromPrefix(ctx, tabId, parsed.WidgetId)
			}
			if fullBlockId == "" {
				fullBlockId, _ = findWebBlockId(ctx, tabId)
			}

			if fullBlockId == "" {
				return nil, fmt.Errorf("no hay navegador web abierto para ejecutar la herramienta WebMCP '%s'", parsed.ToolName)
			}

			workspaceId, err := wstore.DBFindWorkspaceForTabId(ctx, tabId)
			if err != nil {
				return nil, fmt.Errorf("failed to find workspace: %w", err)
			}

			rpcClient := wshclient.GetBareRpcClient()
			data := wshrpc.CommandWebMCPExecuteData{
				WorkspaceId: workspaceId,
				TabId:       tabId,
				BlockId:     fullBlockId,
				ToolName:    parsed.ToolName,
				Params:      parsed.Params,
			}

			resJson, err := wshclient.WebMCPExecuteCommand(rpcClient, data, &wshrpc.RpcOpts{Route: "electron"})
			if err != nil {
				return nil, fmt.Errorf("failed to execute WebMCP tool '%s': %w", parsed.ToolName, err)
			}

			return resJson, nil
		},
	}
}

// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, globalStore } from "@/app/store/global";
import { makeORef, splitORef } from "@/app/store/wos";
import { RpcResponseHelper, WshClient } from "@/app/store/wshclient";
import { RpcApi } from "@/app/store/wshclientapi";
import { makeFeBlockRouteId } from "@/app/store/wshrouter";
import { TermViewModel } from "@/app/view/term/term-model";
import { bufferLinesToText } from "@/app/view/term/termutil";
import { isBlank } from "@/util/util";
import type * as TermTypes from "@xterm/xterm";
import debug from "debug";

const dlog = debug("gulin:vdom");

function getEffectiveBufferLength(buffer: TermTypes.IBuffer): number {
    const cursorAbsY = buffer.baseY + buffer.cursorY;
    let lastNonEmpty = cursorAbsY;
    for (let i = buffer.length - 1; i > cursorAbsY; i--) {
        const line = buffer.getLine(i);
        if (line && line.translateToString(true).trim() !== "") {
            lastNonEmpty = i;
            break;
        }
    }
    return Math.max(1, lastNonEmpty + 1);
}

export class TermWshClient extends WshClient {
    blockId: string;
    model: TermViewModel;

    constructor(blockId: string, model: TermViewModel) {
        super(makeFeBlockRouteId(blockId));
        this.blockId = blockId;
        this.model = model;
    }

    async handle_vdomcreatecontext(rh: RpcResponseHelper, data: VDomCreateContext) {
        const source = rh.getSource();
        if (isBlank(source)) {
            throw new Error("source cannot be blank");
        }
        console.log("vdom-create", source, data);
        const tabId = globalStore.get(atoms.staticTabId);
        if (data.target?.newblock) {
            const oref = await RpcApi.CreateBlockCommand(this, {
                tabid: tabId,
                blockdef: {
                    meta: {
                        view: "vdom",
                        "vdom:route": rh.getSource(),
                    },
                },
                magnified: data.target?.magnified,
                focused: true,
            });
            return oref;
        } else if (data.target?.toolbar?.toolbar) {
            const oldVDomBlockId = globalStore.get(this.model.vdomToolbarBlockId);
            console.log("vdom:toolbar", data.target.toolbar);
            globalStore.set(this.model.vdomToolbarTarget, data.target.toolbar);
            const oref = await RpcApi.CreateSubBlockCommand(this, {
                parentblockid: this.blockId,
                blockdef: {
                    meta: {
                        view: "vdom",
                        "vdom:route": rh.getSource(),
                    },
                },
            });
            const [_, newVDomBlockId] = splitORef(oref);
            if (!isBlank(oldVDomBlockId)) {
                // dispose of the old vdom block
                setTimeout(() => {
                    RpcApi.DeleteSubBlockCommand(this, { blockid: oldVDomBlockId });
                }, 500);
            }
            setTimeout(() => {
                RpcApi.SetMetaCommand(this, {
                    oref: makeORef("block", this.model.blockId),
                    meta: {
                        "term:vdomtoolbarblockid": newVDomBlockId,
                    },
                });
            }, 50);
            return oref;
        } else {
            // in the terminal
            // check if there is a current active vdom block
            const oldVDomBlockId = globalStore.get(this.model.vdomBlockId);
            const oref = await RpcApi.CreateSubBlockCommand(this, {
                parentblockid: this.blockId,
                blockdef: {
                    meta: {
                        view: "vdom",
                        "vdom:route": rh.getSource(),
                    },
                },
            });
            const [_, newVDomBlockId] = splitORef(oref);
            if (!isBlank(oldVDomBlockId)) {
                // dispose of the old vdom block
                setTimeout(() => {
                    RpcApi.DeleteSubBlockCommand(this, { blockid: oldVDomBlockId });
                }, 500);
            }
            setTimeout(() => {
                RpcApi.SetMetaCommand(this, {
                    oref: makeORef("block", this.model.blockId),
                    meta: {
                        "term:mode": "vdom",
                        "term:vdomblockid": newVDomBlockId,
                    },
                });
            }, 50);
            return oref;
        }
    }

    async handle_termgetscrollbacklines(
        rh: RpcResponseHelper,
        data: CommandTermGetScrollbackLinesData
    ): Promise<CommandTermGetScrollbackLinesRtnData> {
        const termWrap = this.model.termRef.current;
        if (!termWrap || !termWrap.terminal) {
            return {
                totallines: 0,
                linestart: data.linestart,
                lines: [],
                lastupdated: 0,
            };
        }

        const buffer = termWrap.terminal.buffer.active;
        const totalLines = buffer.length;
        const effectiveTotal = getEffectiveBufferLength(buffer);

        if (data.lastcommand) {
            const shellStatus = globalStore.get(termWrap.shellIntegrationStatusAtom);
            const validMarkers = termWrap.promptMarkers.filter(
                (m) => !m.isDisposed && m.line >= 0 && m.line < totalLines
            );

            let startBufferIndex = 0;
            let endBufferIndex = effectiveTotal;

            if (validMarkers.length > 0) {
                if (shellStatus === "running-command") {
                    // Command is currently executing: started at latest marker, extends to active cursor line
                    const currentCmdMarker = validMarkers[validMarkers.length - 1];
                    startBufferIndex = currentCmdMarker.line;
                    endBufferIndex = effectiveTotal;
                } else {
                    // Command finished: started at previous marker, ended at last prompt marker
                    if (validMarkers.length > 1) {
                        const cmdStartMarker = validMarkers[validMarkers.length - 2];
                        const currentPromptMarker = validMarkers[validMarkers.length - 1];
                        startBufferIndex = cmdStartMarker.line;
                        endBufferIndex = currentPromptMarker.line;
                    } else {
                        const cmdStartMarker = validMarkers[0];
                        startBufferIndex = cmdStartMarker.line;
                        endBufferIndex = effectiveTotal;
                    }
                }
            } else {
                // Fallback: If no markers exist, return the most recent active lines of the buffer
                const fallbackCount = Math.min(effectiveTotal, 100);
                startBufferIndex = Math.max(0, effectiveTotal - fallbackCount);
                endBufferIndex = effectiveTotal;
            }

            // Ensure valid bounds
            if (startBufferIndex >= endBufferIndex || startBufferIndex < 0) {
                const fallbackCount = Math.min(effectiveTotal, 50);
                startBufferIndex = Math.max(0, effectiveTotal - fallbackCount);
                endBufferIndex = effectiveTotal;
            }

            const lines = bufferLinesToText(buffer, startBufferIndex, endBufferIndex);

            let returnLines = lines;
            let returnStartLine = Math.max(0, effectiveTotal - endBufferIndex);
            if (lines.length > 5000) {
                returnLines = lines.slice(lines.length - 5000);
                returnStartLine = Math.max(0, effectiveTotal - endBufferIndex) + (lines.length - 5000);
            }

            return {
                totallines: effectiveTotal,
                linestart: returnStartLine,
                lines: returnLines,
                lastupdated: termWrap.lastUpdated,
            };
        }

        const startLine = Math.max(0, data.linestart);
        const endLine = data.lineend === 0 ? effectiveTotal : Math.min(effectiveTotal, data.lineend);

        const startBufferIndex = Math.max(0, effectiveTotal - endLine);
        const endBufferIndex = Math.max(0, effectiveTotal - startLine);
        const lines = bufferLinesToText(buffer, startBufferIndex, endBufferIndex);

        return {
            totallines: effectiveTotal,
            linestart: startLine,
            lines: lines,
            lastupdated: termWrap.lastUpdated,
        };
    }
}

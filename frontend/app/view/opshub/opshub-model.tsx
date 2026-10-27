// Copyright 2026, GuLiN Enterprise
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel, FullBlockProps } from "@/app/block/blocktypes";
import { TabModel } from "@/app/store/tab-model";
import { atom } from "jotai";
import { OpsHubView } from "./opshub";

export class OpsHubViewModel implements ViewModel {
    viewType: string;
    viewIcon: ReturnType<typeof atom<string>>;
    viewName: ReturnType<typeof atom<string>>;
    viewComponent: React.ComponentType<FullBlockProps>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "opshub";
        this.viewIcon = atom("server");
        this.viewName = atom("Ops & Automation");
        this.viewComponent = OpsHubView;
    }
}

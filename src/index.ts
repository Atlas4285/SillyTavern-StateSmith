import "./ui/settings/config-manager.css";
import "./ui/chat/state-panel.css";

import { initializeActiveConfigResolver } from "./application/active-config";
import { initializeStateCoordinator } from "./application/state-coordinator";
import { MODULE_NAME } from "./constants";
import { initializeConfigStore } from "./infrastructure/config-store";
import { initializeModelIntegration } from "./infrastructure/model-integration";
import { initializeConfigManager } from "./ui/settings/config-manager";
import { initializeStatePanel } from "./ui/chat/state-panel";

function onAppInitialized(): void {
    initializeConfigStore();
    initializeActiveConfigResolver();
    initializeStateCoordinator();
    initializeModelIntegration();
    initializeConfigManager();
    initializeStatePanel();
}

function initialize(): void {
    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.APP_INITIALIZED, onAppInitialized);
    console.log(`[${MODULE_NAME}] Extension loaded`);
}

initialize();

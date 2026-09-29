import { getConfig, getCurrentConfig } from "../infrastructure/config-store";
import { getChatState } from "../infrastructure/chat-state-store";
import { MODULE_NAME } from "../constants";
import type { StateSmithConfig } from "../domain/config";

export type ActiveConfigListener = (
    config: StateSmithConfig | undefined,
    previousConfig: StateSmithConfig | undefined,
) => void;

const listeners = new Set<ActiveConfigListener>();
let activeConfig: StateSmithConfig | undefined;
let hasResolvedConfig = false;
let isInitialized = false;

export function getActiveConfig(): StateSmithConfig | undefined {
    const { chatId } = SillyTavern.getContext();
    // A saved chat binding takes precedence over the global current config.
    if (chatId !== undefined && chatId !== null && chatId !== "") {
        const chatConfigName = getChatState()?.configName;
        const chatConfig = chatConfigName
            ? getConfig(chatConfigName)
            : undefined;
        if (chatConfig) {
            return chatConfig;
        }
    }

    return getCurrentConfig();
}

export function refreshActiveConfig(
    forceNotification = false,
): StateSmithConfig | undefined {
    const nextConfig = getActiveConfig();

    if (
        !forceNotification &&
        hasResolvedConfig &&
        nextConfig === activeConfig
    ) {
        return nextConfig;
    }

    const previousConfig = activeConfig;
    activeConfig = nextConfig;
    hasResolvedConfig = true;

    console.log(
        `[${MODULE_NAME}] Active configuration:`,
        activeConfig?.name ?? "none",
    );

    for (const listener of listeners) {
        listener(activeConfig, previousConfig);
    }

    return activeConfig;
}

export function subscribeActiveConfig(
    listener: ActiveConfigListener,
): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function initializeActiveConfigResolver(): void {
    if (isInitialized) {
        return;
    }

    isInitialized = true;
    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        refreshActiveConfig();
    });
    eventSource.on(eventTypes.SETTINGS_UPDATED, () => {
        refreshActiveConfig(true);
    });

    refreshActiveConfig();
}

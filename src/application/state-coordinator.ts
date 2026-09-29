import { getActiveConfig, subscribeActiveConfig } from "./active-config";
import type { StateSmithConfig } from "../domain/config";
import {
    applyStateUpdates,
    createState,
    reconcileState,
    type StateFieldUpdate,
    type StateSmithChatState,
} from "../domain/state";
import {
    deleteChatState,
    getChatState,
    saveChatState,
} from "../infrastructure/chat-state-store";
import {
    isExtensionEnabled,
    subscribeExtensionEnabled,
} from "../infrastructure/config-store";

export type StateListener = (
    state: StateSmithChatState | undefined,
    previousState: StateSmithChatState | undefined,
) => void;

const listeners = new Set<StateListener>();
let currentState: StateSmithChatState | undefined;
let isInitialized = false;

function hasOpenChat(): boolean {
    const { chatId } = SillyTavern.getContext();
    return chatId !== undefined && chatId !== null && chatId !== "";
}

function haveEqualStates(
    left: StateSmithChatState | undefined,
    right: StateSmithChatState | undefined,
): boolean {
    if (left === right) {
        return true;
    }

    if (!left || !right || left.configName !== right.configName) {
        return false;
    }

    const leftNames = Object.keys(left.values);
    const rightNames = Object.keys(right.values);

    if (leftNames.length !== rightNames.length) {
        return false;
    }

    return leftNames.every((name) =>
        Object.is(left.values[name], right.values[name]),
    );
}

function publishState(state: StateSmithChatState | undefined): void {
    // A new object with unchanged values should not trigger another UI refresh.
    if (haveEqualStates(state, currentState)) {
        return;
    }

    const previousState = currentState;
    currentState = state;

    for (const listener of listeners) {
        listener(currentState, previousState);
    }
}

export function getCurrentState(): StateSmithChatState | undefined {
    if (!isExtensionEnabled() || !hasOpenChat()) {
        return undefined;
    }

    const config = getActiveConfig();
    if (!config) {
        return undefined;
    }

    const storedState = getChatState();
    return storedState
        ? reconcileState(config, storedState)
        : createState(config);
}

export async function loadCurrentState(): Promise<
    StateSmithChatState | undefined
    > {
    if (!isExtensionEnabled() || !hasOpenChat()) {
        publishState(undefined);
        return undefined;
    }

    const config = getActiveConfig();
    if (!config) {
        publishState(undefined);
        return undefined;
    }

    const storedState = getChatState();
    const state = storedState
        ? reconcileState(config, storedState)
        : createState(config);

    // Save only when defaults or stored values need reconciliation.
    if (!haveEqualStates(state, storedState)) {
        await saveChatState(state);
    }

    publishState(state);
    return state;
}

export async function useConfigForCurrentChat(
    config: StateSmithConfig,
): Promise<void> {
    if (!isExtensionEnabled() || !hasOpenChat()) {
        return;
    }

    const storedState = getChatState();
    const state = storedState
        ? reconcileState(config, storedState)
        : createState(config);

    if (!haveEqualStates(state, storedState)) {
        await saveChatState(state);
    }

    publishState(state);
}

export async function updateCurrentState(
    updates: StateFieldUpdate[],
): Promise<StateSmithChatState | undefined> {
    const state = getCurrentState();
    if (!state) {
        return undefined;
    }

    const updatedState = applyStateUpdates(state, updates);

    if (!haveEqualStates(updatedState, state)) {
        await saveChatState(updatedState);
    }

    publishState(updatedState);
    return updatedState;
}

export async function resetCurrentState(): Promise<
    StateSmithChatState | undefined
    > {
    if (!isExtensionEnabled() || !hasOpenChat()) {
        return undefined;
    }

    const config = getActiveConfig();
    if (!config) {
        return undefined;
    }

    const state = createState(config);
    await saveChatState(state);
    publishState(state);
    return state;
}

export async function deleteCurrentState(): Promise<void> {
    if (!hasOpenChat()) {
        return;
    }

    if (getChatState()) {
        await deleteChatState();
    }

    publishState(undefined);
}

export function subscribeState(listener: StateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function initializeStateCoordinator(): void {
    if (isInitialized) {
        return;
    }

    isInitialized = true;
    const { eventSource, eventTypes } = SillyTavern.getContext();

    subscribeActiveConfig(() => {
        void loadCurrentState();
    });
    subscribeExtensionEnabled(() => {
        void loadCurrentState();
    });
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        void loadCurrentState();
    });
    eventSource.on(eventTypes.SETTINGS_UPDATED, () => {
        void loadCurrentState();
    });
    void loadCurrentState();
}

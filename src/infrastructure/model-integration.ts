import {
    getActiveConfig,
    subscribeActiveConfig,
} from "../application/active-config";
import {
    buildStateContextMessage,
    buildStateToolDescription,
    buildStateToolParameters,
} from "../application/model-context";
import {
    getCurrentState,
    subscribeState,
    updateCurrentState,
} from "../application/state-coordinator";
import {
    DEFAULT_STATE_PROMPT,
    DEFAULT_TOOL_DESCRIPTION,
    MODULE_NAME,
    STATE_PROMPT_I18N_KEY,
    STATE_TOOL_NAME,
    TOOL_DESCRIPTION_I18N_KEY,
} from "../constants";
import type { StateSmithConfig } from "../domain/config";
import type { FieldValue, StateFieldUpdate } from "../domain/state";
import { isExtensionEnabled, subscribeExtensionEnabled } from "./config-store";

type StateToolArguments = Record<string, FieldValue>;

const STATE_PROMPT_KEY = `${MODULE_NAME}_state`;
const PROMPT_POSITION_NONE = -1;
const PROMPT_POSITION_IN_CHAT = 1;
const PROMPT_ROLE_SYSTEM = 0;
const PROMPT_DEPTH = 0;

let isInitialized = false;
let hasWarnedAboutToolSupport = false;

function getLocalizedDefault(text: string, key: string): string {
    return SillyTavern.getContext().translate(text, key);
}

function getModelConfig(): StateSmithConfig | undefined {
    const config = getActiveConfig();
    // Empty configs must not contribute a prompt or a function tool.
    return isExtensionEnabled() && config?.fields.length ? config : undefined;
}

function refreshStatePrompt(): void {
    const { setExtensionPrompt } = SillyTavern.getContext();
    const config = getModelConfig();
    const state = config ? getCurrentState() : undefined;

    if (!config || !state) {
        // Clear any prompt left by the previous chat or configuration.
        setExtensionPrompt(
            STATE_PROMPT_KEY,
            "",
            PROMPT_POSITION_NONE,
            PROMPT_DEPTH,
            false,
            PROMPT_ROLE_SYSTEM,
        );
        return;
    }

    setExtensionPrompt(
        STATE_PROMPT_KEY,
        buildStateContextMessage(
            config,
            state,
            getLocalizedDefault(DEFAULT_STATE_PROMPT, STATE_PROMPT_I18N_KEY),
        ),
        PROMPT_POSITION_IN_CHAT,
        PROMPT_DEPTH,
        false,
        PROMPT_ROLE_SYSTEM,
    );
}

function toStateUpdates(
    values: Record<string, FieldValue>,
): StateFieldUpdate[] {
    return Object.keys(values).map((name) => ({
        name,
        value: values[name],
    }));
}

async function applyToolUpdates(
    arguments_: StateToolArguments,
): Promise<Record<string, unknown>> {
    if (!isExtensionEnabled()) {
        throw new Error("StateSmith is disabled.");
    }

    const updates = toStateUpdates(arguments_);
    const state = await updateCurrentState(updates);

    if (!state) {
        throw new Error("There is no active chat state to update.");
    }

    return {
        updatedFields: updates.map((update) => update.name),
        state: state.values,
    };
}

function refreshStateTool(): void {
    const { registerFunctionTool, unregisterFunctionTool } =
        SillyTavern.getContext();
    const config = getModelConfig();

    unregisterFunctionTool(STATE_TOOL_NAME);

    if (!config) {
        return;
    }

    registerFunctionTool({
        name: STATE_TOOL_NAME,
        displayName: "Update State",
        description: buildStateToolDescription(
            config,
            getLocalizedDefault(
                DEFAULT_TOOL_DESCRIPTION,
                TOOL_DESCRIPTION_I18N_KEY,
            ),
        ),
        parameters: buildStateToolParameters(config),
        action: applyToolUpdates,
    });
}

function reportToolSupport(): void {
    const context = SillyTavern.getContext();

    if (!getModelConfig() || context.isToolCallingSupported()) {
        hasWarnedAboutToolSupport = false;
        return;
    }

    if (hasWarnedAboutToolSupport) {
        return;
    }

    hasWarnedAboutToolSupport = true;
    console.warn(
        `[${MODULE_NAME}] The ${STATE_TOOL_NAME} tool is registered, but SillyTavern will not send tools with the current API settings. Enable function calling and use a supported Chat Completion model and prompt post-processing mode.`,
    );
}

function onGenerationStarted(): void {
    refreshStatePrompt();
    reportToolSupport();
}

function refreshModelIntegration(): void {
    refreshStateTool();
    refreshStatePrompt();
}

export function initializeModelIntegration(): void {
    if (isInitialized) {
        return;
    }

    isInitialized = true;
    const { eventSource, eventTypes } = SillyTavern.getContext();

    subscribeActiveConfig(refreshModelIntegration);
    subscribeState(refreshStatePrompt);
    subscribeExtensionEnabled(refreshModelIntegration);
    eventSource.on(eventTypes.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(eventTypes.MESSAGE_SENT, refreshStatePrompt);
    eventSource.on(eventTypes.CHAT_CHANGED, refreshStatePrompt);
    refreshModelIntegration();
    reportToolSupport();
}

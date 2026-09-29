import { MODULE_NAME } from "../constants";
import {
    validateConfigs,
    type ConfigValidationResult,
} from "../domain/config-validation";
import type { StateSmithConfig } from "../domain/config";

export interface StateSmithSettings {
    enabled?: boolean;
    configs: StateSmithConfig[];
    currentConfigName?: string;
}

type EnabledListener = (enabled: boolean) => void;
const enabledListeners = new Set<EnabledListener>();
let lastEnabled = true;

function notifyEnabledChange(): void {
    const enabled = isExtensionEnabled();
    if (enabled === lastEnabled) {
        return;
    }

    lastEnabled = enabled;
    for (const listener of enabledListeners) {
        listener(enabled);
    }
}

function getSettings(): StateSmithSettings {
    const { extensionSettings, saveSettingsDebounced } =
        SillyTavern.getContext();
    const storedSettings = extensionSettings[MODULE_NAME] as unknown;

    if (
        typeof storedSettings !== "object" ||
        storedSettings === null ||
        !Array.isArray((storedSettings as StateSmithSettings).configs)
    ) {
        const settings: StateSmithSettings = { enabled: true, configs: [] };
        extensionSettings[MODULE_NAME] = settings;
        saveSettingsDebounced();
        return settings;
    }

    return storedSettings as StateSmithSettings;
}

function saveConfigs(
    configs: unknown,
    currentConfigName = getSettings().currentConfigName,
): ConfigValidationResult<StateSmithConfig[]> {
    const validation = validateConfigs(configs);

    if (!validation.valid) {
        return validation;
    }

    const { extensionSettings, saveSettingsDebounced } =
        SillyTavern.getContext();
    const hasCurrentConfig = validation.value.some(
        (config) => config.name === currentConfigName,
    );
    extensionSettings[MODULE_NAME] = {
        ...getSettings(),
        configs: validation.value,
        currentConfigName: hasCurrentConfig ? currentConfigName : undefined,
    };
    saveSettingsDebounced();
    return validation;
}

export function initializeConfigStore(): void {
    getSettings();
    lastEnabled = isExtensionEnabled();
    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.SETTINGS_UPDATED, notifyEnabledChange);
}

export function isExtensionEnabled(): boolean {
    // Settings saved before the switch existed remain enabled by default.
    return getSettings().enabled !== false;
}

export function setExtensionEnabled(enabled: boolean): void {
    if (enabled === isExtensionEnabled()) {
        return;
    }

    const { extensionSettings, saveSettingsDebounced } =
        SillyTavern.getContext();
    extensionSettings[MODULE_NAME] = { ...getSettings(), enabled };
    saveSettingsDebounced();
    notifyEnabledChange();
}

export function subscribeExtensionEnabled(
    listener: EnabledListener,
): () => void {
    enabledListeners.add(listener);
    return () => enabledListeners.delete(listener);
}

export function getConfigs(): readonly StateSmithConfig[] {
    return getSettings().configs;
}

export function getConfig(name: string): StateSmithConfig | undefined {
    return getSettings().configs.find((config) => config.name === name);
}

export function getCurrentConfig(): StateSmithConfig | undefined {
    const name = getSettings().currentConfigName;
    return name ? getConfig(name) : undefined;
}

export function setCurrentConfigName(name: string): boolean {
    if (!getConfig(name)) {
        return false;
    }

    const { extensionSettings, saveSettingsDebounced } =
        SillyTavern.getContext();
    extensionSettings[MODULE_NAME] = {
        ...getSettings(),
        currentConfigName: name,
    };
    saveSettingsDebounced();
    return true;
}

export function addConfig(
    config: unknown,
): ConfigValidationResult<StateSmithConfig[]> {
    return saveConfigs([...getSettings().configs, config]);
}

export function updateConfig(
    currentName: string,
    config: unknown,
): ConfigValidationResult<StateSmithConfig[]> {
    const configs = [...getSettings().configs];
    const index = configs.findIndex((item) => item.name === currentName);

    if (index === -1) {
        return {
            valid: false,
            issues: [
                {
                    path: "$.name",
                    message: `Configuration '${currentName}' was not found.`,
                },
            ],
        };
    }

    configs[index] = config as StateSmithConfig;
    const currentConfigName =
        getSettings().currentConfigName === currentName
            ? (config as StateSmithConfig).name
            : getSettings().currentConfigName;
    return saveConfigs(configs, currentConfigName);
}

export function replaceConfigs(
    configs: unknown,
): ConfigValidationResult<StateSmithConfig[]> {
    return saveConfigs(configs);
}

export function deleteConfig(name: string): boolean {
    const settings = getSettings();
    const configs = settings.configs;
    const nextConfigs = configs.filter((config) => config.name !== name);

    if (nextConfigs.length === configs.length) {
        return false;
    }

    const { extensionSettings, saveSettingsDebounced } =
        SillyTavern.getContext();
    extensionSettings[MODULE_NAME] = {
        ...settings,
        configs: nextConfigs,
        currentConfigName:
            settings.currentConfigName === name
                ? undefined
                : settings.currentConfigName,
    };
    saveSettingsDebounced();
    return true;
}

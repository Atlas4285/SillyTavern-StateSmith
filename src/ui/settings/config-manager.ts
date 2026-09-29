import settingsHtml from "./config-manager.html";

import {
    getActiveConfig,
    refreshActiveConfig,
    subscribeActiveConfig,
} from "../../application/active-config";
import { useConfigForCurrentChat } from "../../application/state-coordinator";
import {
    DEFAULT_STATE_PROMPT,
    DEFAULT_TOOL_DESCRIPTION,
    MODULE_NAME,
    STATE_PROMPT_I18N_KEY,
    TOOL_DESCRIPTION_I18N_KEY,
} from "../../constants";
import {
    validateConfig,
    type ConfigValidationIssue,
} from "../../domain/config-validation";
import { CONFIG_SCHEMA_URL, type StateSmithConfig } from "../../domain/config";
import {
    addConfig,
    deleteConfig,
    getConfig,
    getConfigs,
    isExtensionEnabled,
    replaceConfigs,
    setCurrentConfigName,
    setExtensionEnabled,
    subscribeExtensionEnabled,
    updateConfig,
} from "../../infrastructure/config-store";
import {
    initializeConfigTransfer,
    refreshTransferAvailability,
} from "./config-transfer-ui";
import {
    getFieldEditorFields,
    initializeFieldEditor,
    setFieldEditorFields,
} from "./field-editor";

interface ConfigManagerElements {
    enabledInput: HTMLInputElement;
    activeConfigName: HTMLElement;
    configList: HTMLElement;
    setCurrentButton: HTMLButtonElement;
    newButton: HTMLButtonElement;
    duplicateButton: HTMLButtonElement;
    deleteButton: HTMLButtonElement;
    upButton: HTMLButtonElement;
    downButton: HTMLButtonElement;
    emptyState: HTMLElement;
    form: HTMLFormElement;
    nameInput: HTMLInputElement;
    descriptionInput: HTMLTextAreaElement;
    promptInput: HTMLTextAreaElement;
    promptUseDefault: HTMLInputElement;
    toolDescriptionInput: HTMLTextAreaElement;
    toolDescriptionUseDefault: HTMLInputElement;
    fieldCount: HTMLElement;
    feedback: HTMLElement;
    issues: HTMLUListElement;
    unsavedIndicator: HTMLElement;
    revertButton: HTMLButtonElement;
    saveButton: HTMLButtonElement;
}

let elements: ConfigManagerElements | undefined;
let selectedOriginalName: string | undefined;
let draft: StateSmithConfig | undefined;
let baseline: StateSmithConfig | undefined;
let hasUnsavedChanges = false;
let isInitialized = false;

function translate(text: string, key: string): string {
    return SillyTavern.getContext().translate(text, key);
}

function cloneConfig(config: StateSmithConfig): StateSmithConfig {
    return JSON.parse(JSON.stringify(config)) as StateSmithConfig;
}

function getRequiredElement<TElement extends Element>(
    selector: string,
): TElement | undefined {
    const element = document.querySelector<TElement>(selector);

    if (!element) {
        console.warn(
            `[${MODULE_NAME}] Settings element not found: ${selector}`,
        );
    }

    return element ?? undefined;
}

function collectElements(): ConfigManagerElements | undefined {
    const enabledInput = getRequiredElement<HTMLInputElement>(
        "#statesmith_enabled",
    );
    const activeConfigName = getRequiredElement<HTMLElement>(
        "#statesmith_active_config_name",
    );
    const configList = getRequiredElement<HTMLElement>(
        "#statesmith_config_list",
    );
    const setCurrentButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_set_current",
    );
    const newButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_new",
    );
    const duplicateButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_duplicate",
    );
    const deleteButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_delete",
    );
    const upButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_up",
    );
    const downButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_down",
    );
    const emptyState = getRequiredElement<HTMLElement>(
        "#statesmith_config_empty",
    );
    const form = getRequiredElement<HTMLFormElement>("#statesmith_config_form");
    const nameInput = getRequiredElement<HTMLInputElement>(
        "#statesmith_config_name",
    );
    const descriptionInput = getRequiredElement<HTMLTextAreaElement>(
        "#statesmith_config_description",
    );
    const promptInput = getRequiredElement<HTMLTextAreaElement>(
        "#statesmith_config_prompt",
    );
    const promptUseDefault = getRequiredElement<HTMLInputElement>(
        "#statesmith_prompt_use_default",
    );
    const toolDescriptionInput = getRequiredElement<HTMLTextAreaElement>(
        "#statesmith_tool_description",
    );
    const toolDescriptionUseDefault = getRequiredElement<HTMLInputElement>(
        "#statesmith_tool_description_use_default",
    );
    const fieldCount = getRequiredElement<HTMLElement>(
        "#statesmith_field_count",
    );
    const feedback = getRequiredElement<HTMLElement>(
        "#statesmith_config_feedback",
    );
    const issues = getRequiredElement<HTMLUListElement>(
        "#statesmith_config_issues",
    );
    const unsavedIndicator = getRequiredElement<HTMLElement>(
        "#statesmith_unsaved_indicator",
    );
    const revertButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_revert",
    );
    const saveButton = getRequiredElement<HTMLButtonElement>(
        "#statesmith_config_save",
    );

    if (
        !enabledInput ||
        !activeConfigName ||
        !configList ||
        !setCurrentButton ||
        !newButton ||
        !duplicateButton ||
        !deleteButton ||
        !upButton ||
        !downButton ||
        !emptyState ||
        !form ||
        !nameInput ||
        !descriptionInput ||
        !promptInput ||
        !promptUseDefault ||
        !toolDescriptionInput ||
        !toolDescriptionUseDefault ||
        !fieldCount ||
        !feedback ||
        !issues ||
        !unsavedIndicator ||
        !revertButton ||
        !saveButton
    ) {
        return undefined;
    }

    return {
        enabledInput,
        activeConfigName,
        configList,
        setCurrentButton,
        newButton,
        duplicateButton,
        deleteButton,
        upButton,
        downButton,
        emptyState,
        form,
        nameInput,
        descriptionInput,
        promptInput,
        promptUseDefault,
        toolDescriptionInput,
        toolDescriptionUseDefault,
        fieldCount,
        feedback,
        issues,
        unsavedIndicator,
        revertButton,
        saveButton,
    };
}

function getLocalizedPrompt(): string {
    return translate(DEFAULT_STATE_PROMPT, STATE_PROMPT_I18N_KEY);
}

function getLocalizedToolDescription(): string {
    return translate(DEFAULT_TOOL_DESCRIPTION, TOOL_DESCRIPTION_I18N_KEY);
}

function createUniqueName(baseName: string): string {
    const names = new Set(getConfigs().map((config) => config.name));
    const firstCandidate = baseName.slice(0, 100).trimEnd();

    if (!names.has(firstCandidate)) {
        return firstCandidate;
    }

    let suffix = 2;
    let suffixText = ` ${suffix}`;
    let candidate = `${baseName.slice(0, 100 - suffixText.length).trimEnd()}${suffixText}`;

    while (names.has(candidate)) {
        suffix += 1;
        suffixText = ` ${suffix}`;
        candidate = `${baseName.slice(0, 100 - suffixText.length).trimEnd()}${suffixText}`;
    }

    return candidate;
}

function createEmptyConfig(): StateSmithConfig {
    const name = translate(
        "New configuration",
        "statesmith.settings.new_configuration_name",
    );

    return {
        $schema: CONFIG_SCHEMA_URL,
        name: createUniqueName(name),
        fields: [],
    };
}

function clearFeedback(): void {
    if (!elements) {
        return;
    }

    elements.feedback.textContent = "";
    elements.feedback.classList.remove(
        "statesmith-config-feedback--success",
        "statesmith-config-feedback--error",
    );
    elements.issues.replaceChildren();
    elements.issues.hidden = true;
}

function setFeedback(message: string, isError = false): void {
    if (!elements) {
        return;
    }

    elements.feedback.textContent = message;
    elements.feedback.classList.toggle(
        "statesmith-config-feedback--error",
        isError,
    );
    elements.feedback.classList.toggle(
        "statesmith-config-feedback--success",
        !isError,
    );
}

function showIssues(issues: ConfigValidationIssue[]): void {
    if (!elements) {
        return;
    }

    elements.issues.replaceChildren();

    for (const issue of issues) {
        const item = document.createElement("li");
        item.textContent = `${issue.path}: ${issue.message}`;
        elements.issues.append(item);
    }

    elements.issues.hidden = issues.length === 0;
}

function renderActiveConfig(): void {
    if (!elements) {
        return;
    }

    const activeConfig = getActiveConfig();
    elements.activeConfigName.textContent =
        activeConfig?.name ?? translate("None", "statesmith.settings.none");
}

function renderConfigList(): void {
    if (!elements) {
        return;
    }

    const configs = getConfigs();
    const activeConfig = getActiveConfig();
    const scrollTop = elements.configList.scrollTop;
    elements.configList.replaceChildren();

    for (const config of configs) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "statesmith-config-item";
        button.dataset.configName = config.name;
        button.setAttribute(
            "aria-pressed",
            String(config.name === selectedOriginalName),
        );

        const name = document.createElement("span");
        name.className = "statesmith-config-item-name";
        name.textContent = config.name;
        name.title = config.name;
        button.append(name);

        if (config.name === activeConfig?.name) {
            button.setAttribute("aria-current", "true");
            const badge = document.createElement("span");
            badge.className = "statesmith-config-item-current";
            badge.textContent = translate(
                "Current",
                "statesmith.settings.current_badge",
            );
            button.append(badge);
        }

        elements.configList.append(button);
    }

    if (draft && !selectedOriginalName) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "statesmith-config-item";
        button.dataset.draft = "true";
        button.setAttribute("aria-pressed", "true");
        const name = document.createElement("span");
        name.className = "statesmith-config-item-name";
        name.textContent = `* ${draft.name}`;
        button.append(name);
        elements.configList.append(button);
    }

    if (elements.configList.childElementCount === 0) {
        const empty = document.createElement("span");
        empty.className = "statesmith-config-list-empty";
        empty.textContent = translate(
            "No configurations",
            "statesmith.settings.no_configurations",
        );
        elements.configList.append(empty);
    }

    elements.configList.scrollTop = scrollTop;
}

function updateConfigListSelection(): void {
    if (!elements) {
        return;
    }

    for (const button of elements.configList.querySelectorAll<HTMLButtonElement>(
        ".statesmith-config-item",
    )) {
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.configName === selectedOriginalName),
        );
    }
}

function updateTemplateControls(): void {
    if (!elements) {
        return;
    }

    if (elements.promptUseDefault.checked) {
        elements.promptInput.value = getLocalizedPrompt();
        elements.promptInput.disabled = true;
    } else {
        elements.promptInput.disabled = false;
    }

    if (elements.toolDescriptionUseDefault.checked) {
        elements.toolDescriptionInput.value = getLocalizedToolDescription();
        elements.toolDescriptionInput.disabled = true;
    } else {
        elements.toolDescriptionInput.disabled = false;
    }
}

function updateActionAvailability(): void {
    if (!elements) {
        return;
    }

    const hasDraft = draft !== undefined;
    const configIndex = getConfigs().findIndex(
        (config) => config.name === selectedOriginalName,
    );
    elements.duplicateButton.disabled = !selectedOriginalName;
    elements.setCurrentButton.disabled =
        !selectedOriginalName || hasUnsavedChanges;
    elements.deleteButton.disabled = !hasDraft;
    elements.upButton.disabled = configIndex <= 0;
    elements.downButton.disabled =
        configIndex < 0 || configIndex >= getConfigs().length - 1;
    elements.revertButton.disabled = !hasUnsavedChanges;
    elements.saveButton.disabled = !hasUnsavedChanges;
    elements.unsavedIndicator.hidden = !hasUnsavedChanges;
    refreshTransferAvailability();
}

function renderEditor(): void {
    if (!elements) {
        return;
    }

    clearFeedback();
    elements.emptyState.hidden = draft !== undefined;
    elements.form.hidden = draft === undefined;

    if (!draft) {
        setFieldEditorFields([]);
        updateActionAvailability();
        return;
    }

    elements.nameInput.value = draft.name;
    elements.descriptionInput.value = draft.description ?? "";
    elements.promptUseDefault.checked = draft.prompt === undefined;
    elements.promptInput.value = draft.prompt ?? getLocalizedPrompt();
    elements.toolDescriptionUseDefault.checked =
        draft.toolDescription === undefined;
    elements.toolDescriptionInput.value =
        draft.toolDescription ?? getLocalizedToolDescription();
    setFieldEditorFields(draft.fields);
    elements.fieldCount.textContent = String(draft.fields.length);
    updateTemplateControls();
    updateActionAvailability();
}

function setDraft(
    config: StateSmithConfig | undefined,
    originalName: string | undefined,
    isDirty: boolean,
    renderList = true,
): void {
    draft = config ? cloneConfig(config) : undefined;
    baseline = config ? cloneConfig(config) : undefined;
    selectedOriginalName = originalName;
    hasUnsavedChanges = isDirty;
    if (renderList) {
        renderConfigList();
    }
    renderEditor();
}

function markDirty(): void {
    if (!elements || !draft) {
        return;
    }

    hasUnsavedChanges = true;

    if (!selectedOriginalName) {
        const draftName = elements.configList.querySelector<HTMLElement>(
            "[data-draft=\"true\"] .statesmith-config-item-name",
        );

        if (draftName) {
            draftName.textContent = `* ${elements.nameInput.value}`;
        }
    }

    clearFeedback();
    updateActionAvailability();
}

function confirmDiscardChanges(): boolean {
    if (!hasUnsavedChanges) {
        return true;
    }

    return window.confirm(
        translate(
            "Discard unsaved changes?",
            "statesmith.settings.confirm_discard",
        ),
    );
}

function readFormConfig(): StateSmithConfig | undefined {
    if (!elements || !draft) {
        return undefined;
    }

    const config: StateSmithConfig = {
        ...draft,
        name: elements.nameInput.value.trim(),
        fields: getFieldEditorFields(),
    };
    const description = elements.descriptionInput.value.trim();

    if (description.length > 0) {
        config.description = description;
    } else {
        delete config.description;
    }

    if (elements.promptUseDefault.checked) {
        delete config.prompt;
    } else {
        config.prompt = elements.promptInput.value;
    }

    if (elements.toolDescriptionUseDefault.checked) {
        delete config.toolDescription;
    } else {
        config.toolDescription = elements.toolDescriptionInput.value;
    }

    return config;
}

function selectConfig(name: string): void {
    const config = getConfig(name);

    if (!config) {
        return;
    }

    setDraft(config, config.name, false, false);
    updateConfigListSelection();
}

function saveDraft(): void {
    if (!elements || !draft) {
        return;
    }

    if (!elements.form.reportValidity()) {
        return;
    }

    clearFeedback();
    const config = readFormConfig();

    if (!config) {
        return;
    }

    const validation = validateConfig(config);

    if (!validation.valid) {
        setFeedback(
            translate(
                "The configuration contains invalid values.",
                "statesmith.settings.validation_failed",
            ),
            true,
        );
        showIssues(validation.issues);
        return;
    }

    const result = selectedOriginalName
        ? updateConfig(selectedOriginalName, config)
        : addConfig(config);

    if (!result.valid) {
        setFeedback(
            translate(
                "The configuration could not be saved.",
                "statesmith.settings.save_failed",
            ),
            true,
        );
        showIssues(result.issues);
        return;
    }

    refreshActiveConfig(true);
    const storedConfig = getConfig(config.name) ?? config;
    setDraft(storedConfig, config.name, false);
    setFeedback(translate("Configuration saved.", "statesmith.settings.saved"));
}

function createConfig(): void {
    if (!confirmDiscardChanges()) {
        return;
    }

    setDraft(createEmptyConfig(), undefined, true);
    elements?.nameInput.focus();
    elements?.nameInput.select();
}

function duplicateSelectedConfig(): void {
    if (!selectedOriginalName || !confirmDiscardChanges()) {
        return;
    }

    const source = getConfig(selectedOriginalName);

    if (!source) {
        return;
    }

    const copySuffix = translate("copy", "statesmith.settings.copy_suffix");
    const copiedConfig = cloneConfig(source);
    copiedConfig.name = createUniqueName(`${source.name} ${copySuffix}`);
    const result = addConfig(copiedConfig);

    if (!result.valid) {
        setFeedback(
            translate(
                "The configuration could not be saved.",
                "statesmith.settings.save_failed",
            ),
            true,
        );
        showIssues(result.issues);
        return;
    }

    refreshActiveConfig(true);
    setDraft(getConfig(copiedConfig.name), copiedConfig.name, false);
    setFeedback(
        translate(
            "Configuration copied and saved.",
            "statesmith.settings.copied",
        ),
    );
}

async function switchCurrentConfig(): Promise<void> {
    if (!elements) {
        return;
    }

    if (hasUnsavedChanges) {
        setFeedback(
            translate(
                "Save or revert your changes before changing the current configuration.",
                "statesmith.settings.save_before_switch",
            ),
            true,
        );
        return;
    }

    const name = selectedOriginalName;
    if (!name) {
        return;
    }
    const config = getConfig(name);

    if (!config) {
        return;
    }

    // Bind the open chat before changing the fallback for new chats.
    try {
        await useConfigForCurrentChat(config);
    } catch {
        setFeedback(
            translate(
                "Could not switch the current configuration.",
                "statesmith.settings.switch_failed",
            ),
            true,
        );
        return;
    }

    if (!setCurrentConfigName(name)) {
        setFeedback(
            translate(
                "Could not switch the current configuration.",
                "statesmith.settings.switch_failed",
            ),
            true,
        );
        return;
    }

    refreshActiveConfig(true);
    setFeedback(
        translate(
            "Current configuration switched.",
            "statesmith.settings.current_switched",
        ),
    );
}

function deleteSelectedConfig(): void {
    if (!draft) {
        return;
    }

    const message = translate(
        "Delete this configuration? This action cannot be undone.",
        "statesmith.settings.confirm_delete",
    );

    if (!window.confirm(message)) {
        return;
    }

    if (selectedOriginalName) {
        deleteConfig(selectedOriginalName);
        refreshActiveConfig(true);
    }

    const nextConfig = getConfigs()[0];
    setDraft(nextConfig, nextConfig?.name, false);
}

function revertDraft(): void {
    if (!baseline) {
        return;
    }

    setDraft(baseline, selectedOriginalName, !selectedOriginalName);
}

function moveSelectedConfig(offset: -1 | 1): void {
    if (!elements || !selectedOriginalName || !confirmDiscardChanges()) {
        return;
    }

    const name = selectedOriginalName;
    const configs = [...getConfigs()];
    const index = configs.findIndex((config) => config.name === name);
    const nextIndex = index + offset;

    if (index < 0 || nextIndex < 0 || nextIndex >= configs.length) {
        return;
    }

    const current = configs[index];
    configs[index] = configs[nextIndex];
    configs[nextIndex] = current;
    const result = replaceConfigs(configs);

    if (!result.valid) {
        setFeedback(
            translate(
                "Could not reorder the configurations.",
                "statesmith.settings.reorder_failed",
            ),
            true,
        );
        showIssues(result.issues);
        return;
    }

    refreshActiveConfig(true);
    setDraft(getConfig(name), name, false);
}

function bindEvents(): void {
    if (!elements) {
        return;
    }

    elements.enabledInput.addEventListener("change", () => {
        setExtensionEnabled(elements?.enabledInput.checked ?? true);
    });
    elements.configList.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
            return;
        }

        const button = event.target.closest<HTMLButtonElement>(
            ".statesmith-config-item",
        );
        const name = button?.dataset.configName;

        if (!name || name === selectedOriginalName) {
            return;
        }

        if (hasUnsavedChanges) {
            setFeedback(
                translate(
                    "Save or revert your changes before editing another configuration.",
                    "statesmith.settings.save_before_select",
                ),
                true,
            );
            return;
        }

        selectConfig(name);
    });
    let lastListPointerType = "";
    elements.configList.addEventListener("pointerdown", (event) => {
        lastListPointerType = event.pointerType;
    });
    elements.configList.addEventListener("dblclick", (event) => {
        if (
            lastListPointerType !== "mouse" ||
            !(event.target instanceof Element)
        ) {
            return;
        }

        const button = event.target.closest<HTMLButtonElement>(
            ".statesmith-config-item",
        );

        if (
            !button?.dataset.configName ||
            button.dataset.configName !== selectedOriginalName
        ) {
            return;
        }

        void switchCurrentConfig();
    });
    elements.setCurrentButton.addEventListener("click", () => {
        void switchCurrentConfig();
    });
    elements.newButton.addEventListener("click", createConfig);
    elements.duplicateButton.addEventListener("click", duplicateSelectedConfig);
    elements.deleteButton.addEventListener("click", deleteSelectedConfig);
    elements.upButton.addEventListener("click", () => moveSelectedConfig(-1));
    elements.downButton.addEventListener("click", () => moveSelectedConfig(1));
    elements.revertButton.addEventListener("click", revertDraft);
    elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        saveDraft();
    });
    elements.form.addEventListener("input", markDirty);
    elements.promptUseDefault.addEventListener("change", () => {
        updateTemplateControls();
        markDirty();
    });
    elements.toolDescriptionUseDefault.addEventListener("change", () => {
        updateTemplateControls();
        markDirty();
    });
}

function selectInitialConfig(): void {
    const activeConfig = getActiveConfig();
    const initialConfig = activeConfig ?? getConfigs()[0];
    setDraft(initialConfig, initialConfig?.name, false);
}

export function initializeConfigManager(): void {
    if (isInitialized) {
        return;
    }

    const container = document.querySelector<HTMLElement>(
        "#extensions_settings2",
    );

    if (!container) {
        console.warn(
            `[${MODULE_NAME}] Extensions settings container not found`,
        );
        return;
    }

    if (!document.querySelector("#statesmith_settings")) {
        container.insertAdjacentHTML("beforeend", settingsHtml);
    }

    elements = collectElements();

    if (!elements) {
        return;
    }

    if (
        !initializeFieldEditor(() => {
            if (!elements || !draft) {
                return;
            }

            draft.fields = getFieldEditorFields();
            elements.fieldCount.textContent = String(draft.fields.length);
            markDirty();
        })
    ) {
        return;
    }

    if (
        !initializeConfigTransfer({
            getSelectedName: () => selectedOriginalName,
            confirmDiscard: confirmDiscardChanges,
            onImported: (imported) => {
                refreshActiveConfig(true);
                const nextConfig = getConfig(imported.name);
                setDraft(nextConfig, nextConfig?.name, false);
            },
        })
    ) {
        return;
    }

    isInitialized = true;
    bindEvents();
    subscribeExtensionEnabled((enabled) => {
        if (elements) {
            elements.enabledInput.checked = enabled;
        }
    });
    subscribeActiveConfig(() => {
        renderActiveConfig();
        renderConfigList();
    });

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.SETTINGS_UPDATED, () => {
        if (elements) {
            elements.enabledInput.checked = isExtensionEnabled();
        }
        if (!hasUnsavedChanges) {
            const selectedConfig = selectedOriginalName
                ? getConfig(selectedOriginalName)
                : undefined;
            const nextConfig =
                selectedConfig ?? getActiveConfig() ?? getConfigs()[0];
            setDraft(nextConfig, nextConfig?.name, false);
        }
    });

    renderActiveConfig();
    elements.enabledInput.checked = isExtensionEnabled();
    selectInitialConfig();
}

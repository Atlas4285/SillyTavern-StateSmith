import panelHtml from "./state-panel.html";

import {
    getActiveConfig,
    subscribeActiveConfig,
} from "../../application/active-config";
import {
    getCurrentState,
    subscribeState,
    updateCurrentState,
} from "../../application/state-coordinator";
import type { FieldDefinition } from "../../domain/field-definition";
import type { FieldValue } from "../../domain/state";
import { MODULE_NAME } from "../../constants";
import {
    isExtensionEnabled,
    subscribeExtensionEnabled,
} from "../../infrastructure/config-store";

interface PanelElements {
    root: HTMLElement;
    toggle: HTMLButtonElement;
    edit: HTMLButtonElement;
    editIcon: HTMLElement;
    title: HTMLElement;
    configName: HTMLElement;
    icon: HTMLElement;
    content: HTMLElement;
    empty: HTMLElement;
    feedback: HTMLElement;
    fields: HTMLDListElement;
}

let elements: PanelElements | undefined;
let isInitialized = false;
let isCollapsed = false;
let isEditing = false;
let editingChatId: string | undefined;
let editingConfigName: string | undefined;

function translate(text: string, key: string): string {
    return SillyTavern.getContext().translate(text, key);
}

function collectElements(): PanelElements | undefined {
    const root = document.querySelector<HTMLElement>("#statesmith_chat_panel");
    const toggle = document.querySelector<HTMLButtonElement>(
        "#statesmith_chat_panel_toggle",
    );
    const edit = document.querySelector<HTMLButtonElement>(
        "#statesmith_chat_panel_edit",
    );
    const editIcon = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_edit_icon",
    );
    const title = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_title",
    );
    const configName = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_config",
    );
    const icon = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_icon",
    );
    const content = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_content",
    );
    const empty = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_empty",
    );
    const feedback = document.querySelector<HTMLElement>(
        "#statesmith_chat_panel_feedback",
    );
    const fields = document.querySelector<HTMLDListElement>(
        "#statesmith_chat_panel_fields",
    );

    if (
        !root ||
        !toggle ||
        !edit ||
        !editIcon ||
        !title ||
        !configName ||
        !icon ||
        !content ||
        !empty ||
        !feedback ||
        !fields
    ) {
        return undefined;
    }

    return {
        root,
        toggle,
        edit,
        editIcon,
        title,
        configName,
        icon,
        content,
        empty,
        feedback,
        fields,
    };
}

function setCollapsed(collapsed: boolean): void {
    if (!elements) {
        return;
    }

    isCollapsed = collapsed;
    elements.content.hidden = collapsed;
    elements.toggle.setAttribute("aria-expanded", String(!collapsed));
    elements.toggle.title = collapsed
        ? translate("Expand state panel", "statesmith.chat.expand")
        : translate("Collapse state panel", "statesmith.chat.collapse");
    elements.icon.classList.toggle("fa-chevron-up", collapsed);
    elements.icon.classList.toggle("fa-chevron-down", !collapsed);
}

function createBadge(value: string, isOn = false): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "statesmith-chat-panel-badge";
    badge.classList.toggle("statesmith-chat-panel-badge--on", isOn);
    badge.textContent = value;
    badge.title = value;
    return badge;
}

function createEditor(field: FieldDefinition, value: FieldValue): HTMLElement {
    let editor: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    switch (field.type) {
        case "number":
        case "progress": {
            const input = document.createElement("input");
            input.type = "number";
            input.step = "any";
            input.min = String(field.config.min);
            input.max = String(field.config.max);
            input.required = true;
            input.value = String(value);
            editor = input;
            break;
        }

        case "text": {
            const textarea = document.createElement("textarea");
            textarea.rows = 1;
            textarea.maxLength = field.config.maxLength;
            textarea.value = String(value);
            editor = textarea;
            break;
        }

        case "toggle": {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = value === true;
            editor = input;
            break;
        }

        case "tag":
        case "select": {
            const select = document.createElement("select");
            for (const optionValue of field.config.options) {
                const option = document.createElement("option");
                option.value = optionValue;
                option.textContent = optionValue;
                select.append(option);
            }
            select.value = String(value);
            editor = select;
            break;
        }
    }

    editor.className = "statesmith-chat-panel-editor";
    editor.dataset.fieldName = field.name;
    editor.setAttribute("aria-label", field.label || field.name);
    return editor;
}

function createValue(field: FieldDefinition, value: FieldValue): HTMLElement {
    const container = document.createElement("dd");

    if (isEditing) {
        container.append(createEditor(field, value));
        return container;
    }

    switch (field.type) {
        case "number":
            container.textContent = String(value);
            container.title = String(value);
            break;

        case "progress": {
            const wrapper = document.createElement("div");
            wrapper.className = "statesmith-chat-panel-progress";

            const text = document.createElement("span");
            text.textContent = `${value} / ${field.config.max}`;
            text.title = text.textContent;

            const bar = document.createElement("progress");
            const range = field.config.max - field.config.min;
            const percentage =
                range > 0
                    ? ((Number(value) - field.config.min) / range) * 100
                    : 100;
            bar.max = 100;
            bar.value = Math.max(0, Math.min(100, percentage));
            bar.setAttribute(
                "aria-label",
                `${field.label || field.name}: ${value} (${field.config.min}–${field.config.max})`,
            );

            wrapper.append(bar, text);
            container.append(wrapper);
            break;
        }

        case "text": {
            const text = document.createElement("span");
            text.className = "statesmith-chat-panel-text";
            text.textContent =
                value === ""
                    ? translate("Empty", "statesmith.chat.empty_text")
                    : String(value);
            container.title = text.textContent;
            container.append(text);
            break;
        }

        case "toggle":
            container.append(
                createBadge(
                    value === true
                        ? translate("Enabled", "statesmith.chat.enabled")
                        : translate("Disabled", "statesmith.chat.disabled"),
                    value === true,
                ),
            );
            break;

        case "tag":
        case "select":
            container.append(createBadge(String(value)));
            break;
    }

    return container;
}

function createFieldRow(
    field: FieldDefinition,
    value: FieldValue,
): HTMLElement {
    const row = document.createElement("div");
    row.className = "statesmith-chat-panel-field";
    row.classList.toggle(
        "statesmith-chat-panel-field--text-editing",
        isEditing && field.type === "text",
    );

    const label = document.createElement("dt");
    label.textContent = field.label || field.name;
    label.title = field.description || label.textContent;

    row.append(label, createValue(field, value));
    return row;
}

function renderPanel(): void {
    if (!elements) {
        return;
    }

    const { chatId } = SillyTavern.getContext();
    const hasChat = chatId !== undefined && chatId !== null && chatId !== "";
    elements.root.hidden = !isExtensionEnabled() || !hasChat;

    if (!isExtensionEnabled() || !hasChat) {
        isEditing = false;
        return;
    }

    const config = getActiveConfig();
    const state = getCurrentState();
    // Never carry edit mode into another chat or configuration.
    if (
        isEditing &&
        (editingChatId !== String(chatId) || editingConfigName !== config?.name)
    ) {
        isEditing = false;
    }

    const canEdit = Boolean(config && state && config.fields.length > 0);
    if (!canEdit) {
        isEditing = false;
    }
    elements.edit.disabled = !canEdit;
    elements.edit.setAttribute("aria-pressed", String(isEditing));
    elements.edit.title = isEditing
        ? translate("Finish editing", "statesmith.chat.finish_editing")
        : translate("Edit state", "statesmith.chat.edit");
    elements.edit.setAttribute("aria-label", elements.edit.title);
    elements.editIcon.classList.toggle("fa-pen", !isEditing);
    elements.editIcon.classList.toggle("fa-check", isEditing);
    elements.title.textContent = translate("State", "statesmith.chat.title");
    elements.configName.textContent =
        config?.name ?? translate("None", "statesmith.settings.none");

    if (!config || !state || config.fields.length === 0) {
        elements.fields.replaceChildren();
        elements.fields.hidden = true;
        elements.empty.hidden = false;
        elements.empty.textContent = config
            ? translate(
                "This configuration has no fields.",
                "statesmith.chat.no_fields",
            )
            : translate(
                "No current configuration. Select one in extension settings.",
                "statesmith.chat.no_config",
            );
        return;
    }

    elements.empty.hidden = true;
    elements.fields.hidden = false;
    elements.fields.replaceChildren(
        ...config.fields.map((field) =>
            createFieldRow(field, state.values[field.name]),
        ),
    );
}

function showFeedback(message: string): void {
    if (!elements) {
        return;
    }

    elements.feedback.textContent = message;
    elements.feedback.hidden = message === "";
}

async function onFieldChange(event: Event): Promise<void> {
    const target = event.target;
    if (
        !isEditing ||
        !(
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        )
    ) {
        return;
    }

    const fieldName = target.dataset.fieldName;
    const field = getActiveConfig()?.fields.find(
        (item) => item.name === fieldName,
    );
    if (!field) {
        return;
    }

    let value: FieldValue;
    switch (field.type) {
        case "number":
        case "progress":
            if (
                !(target instanceof HTMLInputElement) ||
                !target.reportValidity()
            ) {
                return;
            }
            value = target.valueAsNumber;
            if (!Number.isFinite(value)) {
                return;
            }
            break;

        case "text":
            if (
                !(target instanceof HTMLTextAreaElement) ||
                !target.reportValidity()
            ) {
                return;
            }
            value = target.value;
            break;

        case "toggle":
            if (!(target instanceof HTMLInputElement)) {
                return;
            }
            value = target.checked;
            break;

        case "tag":
        case "select":
            if (!(target instanceof HTMLSelectElement)) {
                return;
            }
            value = target.value;
            break;
    }

    try {
        await updateCurrentState([{ name: field.name, value }]);
        showFeedback("");
    } catch (error) {
        console.error(`[${MODULE_NAME}] Could not update chat state`, error);
        showFeedback(
            translate(
                "Could not save state change.",
                "statesmith.chat.save_failed",
            ),
        );
    }
}

export function initializeStatePanel(): void {
    if (isInitialized) {
        return;
    }

    const form = document.querySelector<HTMLElement>("#form_sheld");
    if (!form) {
        console.warn(`[${MODULE_NAME}] Chat input container not found`);
        return;
    }

    if (!document.querySelector("#statesmith_chat_panel")) {
        form.insertAdjacentHTML("beforebegin", panelHtml);
    }

    elements = collectElements();
    if (!elements) {
        console.warn(`[${MODULE_NAME}] State panel elements not found`);
        return;
    }

    isInitialized = true;
    setCollapsed(window.matchMedia("(max-width: 700px)").matches);
    elements.toggle.addEventListener("click", () => setCollapsed(!isCollapsed));
    elements.edit.addEventListener("click", () => {
        const panelElements = elements;
        if (!panelElements || panelElements.edit.disabled) {
            return;
        }
        if (isEditing) {
            const editors = panelElements.fields.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >(".statesmith-chat-panel-editor");
            for (const editor of editors) {
                if (!editor.reportValidity()) {
                    return;
                }
            }
        }
        isEditing = !isEditing;
        if (isEditing) {
            editingChatId = String(SillyTavern.getContext().chatId);
            editingConfigName = getActiveConfig()?.name;
            setCollapsed(false);
        }
        showFeedback("");
        renderPanel();
    });
    elements.fields.addEventListener("change", (event) => {
        void onFieldChange(event);
    });
    subscribeActiveConfig(renderPanel);
    subscribeState(renderPanel);
    subscribeExtensionEnabled(renderPanel);

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.CHAT_CHANGED, renderPanel);
    renderPanel();
}

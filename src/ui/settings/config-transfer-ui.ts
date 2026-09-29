import type { ConfigValidationIssue } from "../../domain/config-validation";
import type { StateSmithConfig } from "../../domain/config";
import {
    exportConfigJson,
    importConfigJson,
} from "../../application/config-transfer";
import {
    getConfig,
    getConfigs,
    replaceConfigs,
} from "../../infrastructure/config-store";

interface TransferElements {
    exportSelected: HTMLButtonElement;
    importButton: HTMLButtonElement;
    importFile: HTMLInputElement;
    feedback: HTMLElement;
    issues: HTMLUListElement;
}

interface TransferHooks {
    getSelectedName(): string | undefined;
    confirmDiscard(): boolean;
    onImported(imported: StateSmithConfig): void;
}

let elements: TransferElements | undefined;
let hooks: TransferHooks | undefined;

function translate(text: string, key: string): string {
    return SillyTavern.getContext().translate(text, key);
}

function formatMessage(
    text: string,
    key: string,
    values: Record<string, string>,
): string {
    let message = translate(text, key);

    for (const name of Object.keys(values)) {
        message = message.split(`{${name}}`).join(values[name]);
    }

    return message;
}

function collectElements(): TransferElements | undefined {
    const exportSelected = document.querySelector<HTMLButtonElement>(
        "#statesmith_export_selected",
    );
    const importButton = document.querySelector<HTMLButtonElement>(
        "#statesmith_import_json",
    );
    const importFile = document.querySelector<HTMLInputElement>(
        "#statesmith_import_file",
    );
    const feedback = document.querySelector<HTMLElement>(
        "#statesmith_transfer_feedback",
    );
    const issues = document.querySelector<HTMLUListElement>(
        "#statesmith_transfer_issues",
    );

    if (
        !exportSelected ||
        !importButton ||
        !importFile ||
        !feedback ||
        !issues
    ) {
        return undefined;
    }

    return {
        exportSelected,
        importButton,
        importFile,
        feedback,
        issues,
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

function downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSelectedConfig(): void {
    const name = hooks?.getSelectedName();
    const config = name ? getConfig(name) : undefined;

    if (!config) {
        return;
    }

    const filename =
        config.name.replace(/[^a-zA-Z0-9_一-鿿-]+/g, "_").slice(0, 80) ||
        "configuration";
    downloadJson(exportConfigJson(config), `statesmith-${filename}.json`);
}

async function importSelectedFile(): Promise<void> {
    if (!elements || !hooks) {
        return;
    }

    const file = elements.importFile.files?.[0];
    elements.importFile.value = "";

    if (!file) {
        return;
    }

    clearFeedback();
    elements.importButton.disabled = true;

    try {
        let json: string;

        try {
            json = await file.text();
        } catch {
            setFeedback(
                translate(
                    "Could not read the import file.",
                    "statesmith.settings.import_read_failed",
                ),
                true,
            );
            return;
        }

        const parsed = importConfigJson(json);

        if (!parsed.success) {
            setFeedback(
                translate(
                    "The import file does not contain a valid configuration.",
                    "statesmith.settings.import_invalid",
                ),
                true,
            );
            showIssues(parsed.issues);
            return;
        }

        const current = [...getConfigs()];
        const existingIndex = current.findIndex(
            (config) => config.name === parsed.config.name,
        );

        if (
            existingIndex !== -1 &&
            !window.confirm(
                formatMessage(
                    "A configuration named \"{name}\" already exists. Overwrite it?",
                    "statesmith.settings.confirm_import_overwrite",
                    { name: parsed.config.name },
                ),
            )
        ) {
            return;
        }

        if (!hooks.confirmDiscard()) {
            return;
        }

        // An import affects exactly one config; keep all others untouched.
        if (existingIndex === -1) {
            current.push(parsed.config);
        } else {
            current[existingIndex] = parsed.config;
        }

        const saved = replaceConfigs(current);

        if (!saved.valid) {
            setFeedback(
                translate(
                    "Could not import the configuration.",
                    "statesmith.settings.import_failed",
                ),
                true,
            );
            showIssues(saved.issues);
            return;
        }

        hooks.onImported(parsed.config);
        setFeedback(
            translate(
                "Configuration imported.",
                "statesmith.settings.import_success",
            ),
        );
    } finally {
        elements.importButton.disabled = false;
    }
}

export function refreshTransferAvailability(): void {
    if (!elements) {
        return;
    }

    elements.exportSelected.disabled = !hooks?.getSelectedName();
}

export function initializeConfigTransfer(hooks_: TransferHooks): boolean {
    elements = collectElements();

    if (!elements) {
        return false;
    }

    hooks = hooks_;
    elements.exportSelected.addEventListener("click", exportSelectedConfig);
    elements.importButton.addEventListener("click", () => {
        elements?.importFile.click();
    });
    elements.importFile.addEventListener("change", () => {
        void importSelectedFile();
    });
    refreshTransferAvailability();
    return true;
}

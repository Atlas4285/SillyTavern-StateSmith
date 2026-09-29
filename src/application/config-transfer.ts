import {
    validateConfig,
    type ConfigValidationIssue,
} from "../domain/config-validation";
import type { StateSmithConfig } from "../domain/config";

export type ConfigImportResult =
    | { success: true; config: StateSmithConfig }
    | { success: false; issues: ConfigValidationIssue[] };

export function importConfigJson(json: string): ConfigImportResult {
    let value: unknown;

    try {
        value = JSON.parse(json) as unknown;
    } catch {
        return {
            success: false,
            issues: [{ path: "$", message: "Invalid JSON." }],
        };
    }

    const validation = validateConfig(value);

    if (validation.valid === false) {
        return { success: false, issues: validation.issues };
    }

    return { success: true, config: validation.value };
}

export function exportConfigJson(config: StateSmithConfig): string {
    return JSON.stringify(config, null, 2);
}

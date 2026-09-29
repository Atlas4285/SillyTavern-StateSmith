import type { StateSmithConfig } from "./config";
import type { FieldDefinition } from "./field-definition";

export type FieldValue = number | string | boolean;
export type StateValues = Record<string, FieldValue>;

export interface StateSmithChatState {
    configName: string;
    values: StateValues;
}

export interface StateFieldUpdate {
    name: string;
    value: FieldValue;
}

function createDefaultValues(config: StateSmithConfig): StateValues {
    const values: StateValues = {};

    for (const field of config.fields) {
        values[field.name] = field.config.defaultValue;
    }

    return values;
}

function isValidFieldValue(
    field: FieldDefinition,
    value: unknown,
): value is FieldValue {
    switch (field.type) {
        case "number":
        case "progress":
            return (
                typeof value === "number" &&
                Number.isFinite(value) &&
                value >= field.config.min &&
                value <= field.config.max
            );

        case "text":
            return (
                typeof value === "string" &&
                value.length <= field.config.maxLength
            );

        case "toggle":
            return typeof value === "boolean";

        case "tag":
        case "select":
            return (
                typeof value === "string" &&
                field.config.options.indexOf(value) !== -1
            );
    }
}

export function createState(config: StateSmithConfig): StateSmithChatState {
    return {
        configName: config.name,
        values: createDefaultValues(config),
    };
}

export function reconcileState(
    config: StateSmithConfig,
    state: StateSmithChatState,
): StateSmithChatState {
    if (state.configName !== config.name) {
        return createState(config);
    }

    // Keep saved values only while they still satisfy the edited field definitions.
    const values = createDefaultValues(config);

    for (const field of config.fields) {
        const currentValue: unknown = state.values[field.name];

        if (isValidFieldValue(field, currentValue)) {
            values[field.name] = currentValue;
        }
    }

    return {
        configName: config.name,
        values,
    };
}

export function applyStateUpdates(
    state: StateSmithChatState,
    updates: StateFieldUpdate[],
): StateSmithChatState {
    const values = { ...state.values };

    for (const update of updates) {
        values[update.name] = update.value;
    }

    return { ...state, values };
}

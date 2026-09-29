import type { StateSmithConfig } from "../domain/config";
import type { FieldDefinition } from "../domain/field-definition";
import type { StateSmithChatState } from "../domain/state";
import { STATE_TOOL_NAME } from "../constants";

export type JsonSchema = Record<string, unknown>;

function buildFieldDescription(field: FieldDefinition): string {
    return `${field.label || field.name}: ${field.description}`;
}

function buildFieldSchema(field: FieldDefinition): JsonSchema {
    const description = buildFieldDescription(field);

    switch (field.type) {
        case "number":
        case "progress":
            return {
                type: "number",
                description,
                minimum: field.config.min,
                maximum: field.config.max,
            };

        case "text":
            return {
                type: "string",
                description,
                maxLength: field.config.maxLength,
            };

        case "toggle":
            return {
                type: "boolean",
                description,
            };

        case "tag":
        case "select":
            return {
                type: "string",
                description,
                enum: [...field.config.options],
            };
    }
}

export function buildStateToolDescription(
    config: StateSmithConfig,
    defaultDescription: string,
): string {
    const fields = config.fields
        .map(
            (field) =>
                `${field.name} (${field.type}): ${field.label ? `${field.label} - ` : ""}${field.description}`,
        )
        .join("; ");
    let description = config.toolDescription ?? defaultDescription;

    description = replacePlaceholder(description, "fields", fields);

    return description;
}

function replacePlaceholder(
    template: string,
    name: string,
    value: string,
): string {
    return template.split(`{{${name}}}`).join(value);
}

export function buildStateToolParameters(config: StateSmithConfig): JsonSchema {
    const properties: Record<string, JsonSchema> = {};

    for (const field of config.fields) {
        properties[field.name] = buildFieldSchema(field);
    }

    return {
        type: "object",
        properties,
        // Every field is optional so one call can update only changed values.
        required: [],
        additionalProperties: false,
    };
}

export function buildStateContextMessage(
    config: StateSmithConfig,
    state: StateSmithChatState,
    defaultPrompt: string,
): string {
    let prompt = config.prompt ?? defaultPrompt;

    prompt = replacePlaceholder(
        prompt,
        "state",
        JSON.stringify(state.values, null, 2),
    );
    prompt = replacePlaceholder(prompt, "toolName", STATE_TOOL_NAME);

    return prompt;
}

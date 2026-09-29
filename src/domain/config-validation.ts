import { CONFIG_SCHEMA_URL, type StateSmithConfig } from "./config";

export interface ConfigValidationIssue {
    path: string;
    message: string;
}

export type ConfigValidationResult<T> =
    | { valid: true; value: T }
    | { valid: false; issues: ConfigValidationIssue[] };

type UnknownObject = Record<string, unknown>;

function isObject(value: unknown): value is UnknownObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateProperties(
    value: UnknownObject,
    allowedProperties: string[],
    path: string,
    issues: ConfigValidationIssue[],
): void {
    for (const property of Object.keys(value)) {
        if (allowedProperties.indexOf(property) === -1) {
            issues.push({
                path: `${path}.${property}`,
                message: "Unknown property.",
            });
        }
    }
}

function validateString(
    value: unknown,
    path: string,
    minLength: number,
    maxLength: number,
    issues: ConfigValidationIssue[],
): value is string {
    if (typeof value !== "string") {
        issues.push({ path, message: "Expected a string." });
        return false;
    }

    if (value.length < minLength || value.length > maxLength) {
        issues.push({
            path,
            message: `Expected ${minLength}-${maxLength} characters.`,
        });
        return false;
    }

    return true;
}

function validateNumericConfig(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a numeric configuration." });
        return;
    }

    validateProperties(value, ["defaultValue", "min", "max"], path, issues);

    const properties = ["defaultValue", "min", "max"];
    for (const property of properties) {
        const propertyValue = value[property];
        if (
            typeof propertyValue !== "number" ||
            !Number.isFinite(propertyValue)
        ) {
            issues.push({
                path: `${path}.${property}`,
                message: "Expected a finite number.",
            });
        }
    }

    if (
        typeof value.min === "number" &&
        typeof value.max === "number" &&
        value.min > value.max
    ) {
        issues.push({ path, message: "min must not be greater than max." });
    }

    if (
        typeof value.defaultValue === "number" &&
        typeof value.min === "number" &&
        typeof value.max === "number" &&
        (value.defaultValue < value.min || value.defaultValue > value.max)
    ) {
        issues.push({
            path: `${path}.defaultValue`,
            message: "Default value must be between min and max.",
        });
    }
}

function validateTextConfig(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a text configuration." });
        return;
    }

    validateProperties(value, ["defaultValue", "maxLength"], path, issues);
    const defaultValue = value.defaultValue;
    const hasDefaultValue = validateString(
        defaultValue,
        `${path}.defaultValue`,
        0,
        10000,
        issues,
    );

    if (
        typeof value.maxLength !== "number" ||
        !Number.isInteger(value.maxLength) ||
        value.maxLength < 1 ||
        value.maxLength > 10000
    ) {
        issues.push({
            path: `${path}.maxLength`,
            message: "Expected an integer between 1 and 10000.",
        });
        return;
    }

    if (hasDefaultValue && defaultValue.length > value.maxLength) {
        issues.push({
            path: `${path}.defaultValue`,
            message: "Default value exceeds maxLength.",
        });
    }
}

function validateToggleConfig(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a toggle configuration." });
        return;
    }

    validateProperties(value, ["defaultValue"], path, issues);

    if (typeof value.defaultValue !== "boolean") {
        issues.push({
            path: `${path}.defaultValue`,
            message: "Expected a boolean.",
        });
    }
}

function validateChoiceConfig(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a choice configuration." });
        return;
    }

    validateProperties(value, ["defaultValue", "options"], path, issues);
    const defaultValue = value.defaultValue;
    const hasDefaultValue = validateString(
        defaultValue,
        `${path}.defaultValue`,
        0,
        100,
        issues,
    );

    if (!Array.isArray(value.options) || value.options.length === 0) {
        issues.push({
            path: `${path}.options`,
            message: "Expected at least one option.",
        });
        return;
    }

    const options = new Set<string>();
    for (let index = 0; index < value.options.length; index += 1) {
        const option = value.options[index];
        if (
            validateString(option, `${path}.options[${index}]`, 1, 100, issues)
        ) {
            if (options.has(option)) {
                issues.push({
                    path: `${path}.options[${index}]`,
                    message: "Options must be unique.",
                });
            }
            options.add(option);
        }
    }

    if (hasDefaultValue && !options.has(defaultValue)) {
        issues.push({
            path: `${path}.defaultValue`,
            message: "Default value must be one of the options.",
        });
    }
}

function validateField(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a field object." });
        return;
    }

    validateProperties(
        value,
        ["name", "label", "description", "type", "config"],
        path,
        issues,
    );

    if (validateString(value.name, `${path}.name`, 1, 64, issues)) {
        if (!/^[a-z一-鿿][a-z0-9_一-鿿]*$/.test(value.name)) {
            issues.push({
                path: `${path}.name`,
                message: "Expected lowercase snake_case or Chinese characters.",
            });
        }
    }

    validateString(value.label, `${path}.label`, 0, 100, issues);
    validateString(value.description, `${path}.description`, 1, 500, issues);

    switch (value.type) {
        case "number":
        case "progress":
            validateNumericConfig(value.config, `${path}.config`, issues);
            break;

        case "text":
            validateTextConfig(value.config, `${path}.config`, issues);
            break;

        case "toggle":
            validateToggleConfig(value.config, `${path}.config`, issues);
            break;

        case "tag":
        case "select":
            validateChoiceConfig(value.config, `${path}.config`, issues);
            break;

        default:
            issues.push({
                path: `${path}.type`,
                message: "Unknown field type.",
            });
    }
}

function validateConfigAt(
    value: unknown,
    path: string,
    issues: ConfigValidationIssue[],
): void {
    if (!isObject(value)) {
        issues.push({ path, message: "Expected a configuration object." });
        return;
    }

    validateProperties(
        value,
        [
            "$schema",
            "name",
            "description",
            "prompt",
            "toolDescription",
            "fields",
        ],
        path,
        issues,
    );

    if (value.$schema !== CONFIG_SCHEMA_URL) {
        issues.push({
            path: `${path}.$schema`,
            message: `Expected ${CONFIG_SCHEMA_URL}.`,
        });
    }

    validateString(value.name, `${path}.name`, 1, 100, issues);

    if (value.description !== undefined) {
        validateString(
            value.description,
            `${path}.description`,
            0,
            1000,
            issues,
        );
    }

    if (value.prompt !== undefined) {
        validateString(value.prompt, `${path}.prompt`, 1, 10000, issues);
    }

    if (value.toolDescription !== undefined) {
        validateString(
            value.toolDescription,
            `${path}.toolDescription`,
            1,
            4000,
            issues,
        );
    }

    if (!Array.isArray(value.fields)) {
        issues.push({ path: `${path}.fields`, message: "Expected an array." });
        return;
    }

    const fieldNames = new Set<string>();
    for (let index = 0; index < value.fields.length; index += 1) {
        const field = value.fields[index];
        validateField(field, `${path}.fields[${index}]`, issues);

        if (isObject(field) && typeof field.name === "string") {
            if (fieldNames.has(field.name)) {
                issues.push({
                    path: `${path}.fields[${index}].name`,
                    message:
                        "Field names must be unique within a configuration.",
                });
            }
            fieldNames.add(field.name);
        }
    }
}

export function validateConfig(
    value: unknown,
): ConfigValidationResult<StateSmithConfig> {
    const issues: ConfigValidationIssue[] = [];
    validateConfigAt(value, "$", issues);

    if (issues.length > 0) {
        return { valid: false, issues };
    }

    return { valid: true, value: value as StateSmithConfig };
}

export function validateConfigs(
    value: unknown,
): ConfigValidationResult<StateSmithConfig[]> {
    if (!Array.isArray(value)) {
        return {
            valid: false,
            issues: [{ path: "$", message: "Expected a configuration array." }],
        };
    }

    const issues: ConfigValidationIssue[] = [];
    const configNames = new Set<string>();

    for (let index = 0; index < value.length; index += 1) {
        const config = value[index];
        validateConfigAt(config, `$[${index}]`, issues);

        if (isObject(config) && typeof config.name === "string") {
            if (configNames.has(config.name)) {
                issues.push({
                    path: `$[${index}].name`,
                    message: "Configuration names must be unique.",
                });
            }
            configNames.add(config.name);
        }
    }

    if (issues.length > 0) {
        return { valid: false, issues };
    }

    return { valid: true, value: value as StateSmithConfig[] };
}

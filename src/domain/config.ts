import type { FieldDefinition } from "./field-definition";

export const CONFIG_SCHEMA_URL =
    "https://raw.githubusercontent.com/Atlas4285/SillyTavern-StateSmith/main/schema/statesmith-config.schema.json" as const;

export interface StateSmithConfig {
    $schema: typeof CONFIG_SCHEMA_URL;
    name: string;
    description?: string;
    prompt?: string;
    toolDescription?: string;
    fields: FieldDefinition[];
}

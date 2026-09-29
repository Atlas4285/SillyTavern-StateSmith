export type FieldType =
    "number" | "progress" | "text" | "toggle" | "tag" | "select";

export interface NumericFieldConfig {
    defaultValue: number;
    min: number;
    max: number;
}

export interface TextFieldConfig {
    defaultValue: string;
    maxLength: number;
}

export interface ToggleFieldConfig {
    defaultValue: boolean;
}

export interface ChoiceFieldConfig {
    defaultValue: string;
    options: string[];
}

interface BaseFieldDefinition<TType extends FieldType, TConfig> {
    name: string;
    label: string;
    description: string;
    type: TType;
    config: TConfig;
}

export type NumberFieldDefinition = BaseFieldDefinition<
    "number",
    NumericFieldConfig
>;

export type ProgressFieldDefinition = BaseFieldDefinition<
    "progress",
    NumericFieldConfig
>;

export type TextFieldDefinition = BaseFieldDefinition<"text", TextFieldConfig>;

export type ToggleFieldDefinition = BaseFieldDefinition<
    "toggle",
    ToggleFieldConfig
>;

export type TagFieldDefinition = BaseFieldDefinition<"tag", ChoiceFieldConfig>;

export type SelectFieldDefinition = BaseFieldDefinition<
    "select",
    ChoiceFieldConfig
>;

export type FieldDefinition =
    | NumberFieldDefinition
    | ProgressFieldDefinition
    | TextFieldDefinition
    | ToggleFieldDefinition
    | TagFieldDefinition
    | SelectFieldDefinition;

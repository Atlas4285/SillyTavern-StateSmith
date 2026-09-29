export const MODULE_NAME = "sillytavern_statesmith";

export const STATE_TOOL_NAME = "update_state";

export const DEFAULT_STATE_PROMPT = [
    "The following JSON contains the current tracked state for this chat:",
    "{{state}}",
    "Treat these values as authoritative. When conversation events are about to change one or more values, call the {{toolName}} tool to update them, submitting only the fields that are about to change.",
].join("\n");

export const DEFAULT_TOOL_DESCRIPTION = [
    "This tool updates the tracked state for the current chat.",
    "Use it to update the affected fields when events in the conversation are about to change one or more state fields.",
    "You may update multiple fields in a single call.",
    "Available fields: {{fields}}.",
].join(" ");

export const STATE_PROMPT_I18N_KEY = "statesmith.model.default_prompt";
export const TOOL_DESCRIPTION_I18N_KEY =
    "statesmith.model.default_tool_description";

# SillyTavern StateSmith

**English** | [简体中文](README.zh-CN.md)

StateSmith is a third-party [SillyTavern](https://github.com/SillyTavern/SillyTavern) extension for tracking the current state of a chat. Define fields in the extension settings, view and edit their values in the chat UI, and let a model update them through a function tool when the conversation changes.

State updates use function calling, not tags or regular expressions in the model's text response.

## Features

- Configure six field types: number, progress bar, text, toggle, tag, and dropdown.
- Keep one current state snapshot per chat. Saved chats retain their own values and configuration choice.
- Show a compact state panel in the chat UI, with direct editing and automatic saving.
- Send the current state to the model and register one dynamically described `update_state` tool. A single tool call can update several fields.
- Export or import one configuration as JSON, with confirmation before overwriting a configuration of the same name.
- Turn off the panel, model prompt, and tool with a global enable switch without deleting saved data.
- Use an English interface with Simplified Chinese localization.

## Installation

### Install through SillyTavern

1. Open SillyTavern's **Extensions** panel and select **Install Extension**.
2. Enter the repository URL:

    ```text
    https://github.com/Atlas4285/SillyTavern-StateSmith
    ```

3. Complete the installation and reload SillyTavern if the extension does not appear immediately.

Only install third-party extensions from sources you trust.

### Manual installation

Clone the repository into SillyTavern's third-party extensions directory:

```bash
cd /path/to/SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Atlas4285/SillyTavern-StateSmith.git
```

If the checkout does not contain a built `dist/index.js`, build it first:

```bash
cd SillyTavern-StateSmith
npm install
npm run build
```

Then reload SillyTavern.

## Getting started

1. Open **Extensions → State Smith** and leave **Enable State Smith** on.
2. Click **New**, add fields, and save the configuration. Each field needs a unique `name`, a description for the model, and a type-specific default value. The display label may be empty; the field name is shown instead.
3. Select a saved configuration in the list for editing, then click **Set as current** to make it the **current configuration**. On desktop, you can also double-click the configuration.
4. Open a chat. The state panel appears above the message input. Use its edit button to change values yourself; changes are saved to the chat automatically. The other button collapses or expands the panel.
5. With a function-calling-capable SillyTavern connection and model, StateSmith also sends the current state on generation. The model can call `update_state` when values need to change.

The global current configuration is the fallback for a chat without its own saved configuration. When switching to a chat that already has one, that chat's configuration takes precedence. Setting another configuration as current also binds it to the open chat.

## Field types

| Type         | Configuration               | Value                                  |
| ------------ | --------------------------- | -------------------------------------- |
| Number       | Default, minimum, maximum   | A number within the configured range   |
| Progress bar | Default, minimum, maximum   | A number displayed with a progress bar |
| Text         | Default, maximum length     | A string                               |
| Toggle       | Default on/off value        | A boolean                              |
| Tag          | Default and list of options | One string from the options            |
| Dropdown     | Default and list of options | One string from the options            |

Tag and dropdown fields each hold one value; they are not multi-select fields. Changing a field definition preserves a saved value only if it still matches the new type and constraints. Otherwise, that field returns to its default.

## Configuration JSON

The settings UI exports and imports **one configuration per file**. Importing a configuration with an existing name asks before overwriting it. Importing or exporting does not include the current values of any chat.

A minimal example with two fields:

```json
{
    "$schema": "https://raw.githubusercontent.com/Atlas4285/SillyTavern-StateSmith/main/schema/statesmith-config.schema.json",
    "name": "Adventure",
    "fields": [
        {
            "name": "health",
            "label": "Health",
            "description": "The character's current health.",
            "type": "progress",
            "config": { "defaultValue": 100, "min": 0, "max": 100 }
        },
        {
            "name": "mood",
            "label": "",
            "description": "The character's current mood.",
            "type": "select",
            "config": { "defaultValue": "calm", "options": ["calm", "tense"] }
        }
    ]
}
```

`$schema` points to the [configuration schema](schema/statesmith-config.schema.json) for JSON editor validation. It is not a field value or a chat-state version.

## Model integration and data

The default state prompt and tool description are localized. You can override either in a configuration:

- State prompt: `{{state}}` inserts the current values as JSON; `{{toolName}}` inserts the function tool name.
- Tool description: `{{fields}}` inserts the configured field names, types, labels, and descriptions.

The tool's parameters are generated directly from the fields. The model can submit only changed fields, including multiple fields in one call. If the extension is disabled, no configuration is current, or the current configuration has no fields, StateSmith adds no state prompt or tool. Tool calls require function-calling support in the selected SillyTavern API and model; StateSmith cannot make an unsupported connection use tools.

Configurations and the global enable switch are saved in SillyTavern extension settings. Current values and the chat's configuration choice are saved in that chat's metadata as a single latest snapshot, not as a history of updates. Configuration JSON exports do not back up chat state.

## Development

This extension is written in TypeScript and bundled with Webpack. From the extension directory:

```bash
npm install
npm run dev               # rebuild on source changes
npm run build             # production bundle in dist/
npm run lint              # ESLint
npx tsc --noEmit          # TypeScript check
```

The watcher rebuilds the bundle but does not hot-reload SillyTavern; refresh the browser page after a change.

### Project structure

```text
src/
├── index.ts               Extension initialization
├── application/           Active configuration, state coordination, model context
├── domain/                Field and state types, validation
├── infrastructure/        SillyTavern settings, chat metadata, tool integration
└── ui/
    ├── chat/              Chat state panel
    └── settings/          Configuration and field editors
schema/                    Configuration JSON Schema
i18n/                      Simplified Chinese UI strings
dist/                      Built extension bundle
```

The production entry point in `manifest.json` is `dist/index.js`.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

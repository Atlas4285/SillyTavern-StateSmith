import type { FieldDefinition, FieldType } from "../../domain/field-definition";

interface FieldEditorElements {
    list: HTMLSelectElement;
    newButton: HTMLButtonElement;
    duplicateButton: HTMLButtonElement;
    deleteButton: HTMLButtonElement;
    upButton: HTMLButtonElement;
    downButton: HTMLButtonElement;
    emptyState: HTMLElement;
    editor: HTMLElement;
    nameInput: HTMLInputElement;
    typeInput: HTMLSelectElement;
    labelInput: HTMLInputElement;
    descriptionInput: HTMLTextAreaElement;
    numericConfig: HTMLElement;
    numericDefaultInput: HTMLInputElement;
    numericMinInput: HTMLInputElement;
    numericMaxInput: HTMLInputElement;
    textConfig: HTMLElement;
    textDefaultInput: HTMLTextAreaElement;
    textMaxLengthInput: HTMLInputElement;
    toggleConfig: HTMLElement;
    toggleDefaultInput: HTMLInputElement;
    choiceConfig: HTMLElement;
    choiceOptions: HTMLElement;
    choiceIssues: HTMLElement;
    choiceAddButton: HTMLButtonElement;
}

let elements: FieldEditorElements | undefined;
let fields: FieldDefinition[] = [];
let selectedIndex = -1;
let onChange: (() => void) | undefined;
// Preserve the chosen default option while its text is being edited.
let choiceDefaultIndices = new WeakMap<FieldDefinition, number>();

function translate(text: string, key: string): string {
    return SillyTavern.getContext().translate(text, key);
}

function getElement<TElement extends Element>(
    selector: string,
): TElement | undefined {
    return document.querySelector<TElement>(selector) ?? undefined;
}

function collectElements(): FieldEditorElements | undefined {
    const collected = {
        list: getElement<HTMLSelectElement>("#statesmith_field_list"),
        newButton: getElement<HTMLButtonElement>("#statesmith_field_new"),
        duplicateButton: getElement<HTMLButtonElement>(
            "#statesmith_field_duplicate",
        ),
        deleteButton: getElement<HTMLButtonElement>("#statesmith_field_delete"),
        upButton: getElement<HTMLButtonElement>("#statesmith_field_up"),
        downButton: getElement<HTMLButtonElement>("#statesmith_field_down"),
        emptyState: getElement<HTMLElement>("#statesmith_field_empty"),
        editor: getElement<HTMLElement>("#statesmith_field_editor"),
        nameInput: getElement<HTMLInputElement>("#statesmith_field_name"),
        typeInput: getElement<HTMLSelectElement>("#statesmith_field_type"),
        labelInput: getElement<HTMLInputElement>("#statesmith_field_label"),
        descriptionInput: getElement<HTMLTextAreaElement>(
            "#statesmith_field_description",
        ),
        numericConfig: getElement<HTMLElement>("#statesmith_numeric_config"),
        numericDefaultInput: getElement<HTMLInputElement>(
            "#statesmith_numeric_default",
        ),
        numericMinInput: getElement<HTMLInputElement>(
            "#statesmith_numeric_min",
        ),
        numericMaxInput: getElement<HTMLInputElement>(
            "#statesmith_numeric_max",
        ),
        textConfig: getElement<HTMLElement>("#statesmith_text_config"),
        textDefaultInput: getElement<HTMLTextAreaElement>(
            "#statesmith_text_default",
        ),
        textMaxLengthInput: getElement<HTMLInputElement>(
            "#statesmith_text_max_length",
        ),
        toggleConfig: getElement<HTMLElement>("#statesmith_toggle_config"),
        toggleDefaultInput: getElement<HTMLInputElement>(
            "#statesmith_toggle_default",
        ),
        choiceConfig: getElement<HTMLElement>("#statesmith_choice_config"),
        choiceOptions: getElement<HTMLElement>("#statesmith_choice_options"),
        choiceIssues: getElement<HTMLElement>("#statesmith_choice_issues"),
        choiceAddButton: getElement<HTMLButtonElement>(
            "#statesmith_choice_add",
        ),
    };

    if (
        !collected.list ||
        !collected.newButton ||
        !collected.duplicateButton ||
        !collected.deleteButton ||
        !collected.upButton ||
        !collected.downButton ||
        !collected.emptyState ||
        !collected.editor ||
        !collected.nameInput ||
        !collected.typeInput ||
        !collected.labelInput ||
        !collected.descriptionInput ||
        !collected.numericConfig ||
        !collected.numericDefaultInput ||
        !collected.numericMinInput ||
        !collected.numericMaxInput ||
        !collected.textConfig ||
        !collected.textDefaultInput ||
        !collected.textMaxLengthInput ||
        !collected.toggleConfig ||
        !collected.toggleDefaultInput ||
        !collected.choiceConfig ||
        !collected.choiceOptions ||
        !collected.choiceIssues ||
        !collected.choiceAddButton
    ) {
        return undefined;
    }

    return collected as FieldEditorElements;
}

function cloneFields(value: readonly FieldDefinition[]): FieldDefinition[] {
    return JSON.parse(JSON.stringify(value)) as FieldDefinition[];
}

function getSelectedField(): FieldDefinition | undefined {
    return fields[selectedIndex];
}

function getTypeLabel(type: FieldType): string {
    const labels: Record<FieldType, [string, string]> = {
        number: ["Number", "statesmith.settings.field_type_number"],
        progress: ["Progress", "statesmith.settings.field_type_progress"],
        text: ["Text", "statesmith.settings.field_type_text"],
        toggle: ["Toggle", "statesmith.settings.field_type_toggle"],
        tag: ["Tag", "statesmith.settings.field_type_tag"],
        select: ["Select", "statesmith.settings.field_type_select"],
    };
    const [fallback, key] = labels[type];
    return translate(fallback, key);
}

function createUniqueFieldName(baseName: string): string {
    const names = new Set(fields.map((field) => field.name));

    if (!names.has(baseName)) {
        return baseName;
    }

    let suffix = 2;
    let candidate = `${baseName}_${suffix}`;

    while (names.has(candidate)) {
        suffix += 1;
        candidate = `${baseName}_${suffix}`;
    }

    return candidate;
}

function createField(type: FieldType = "number"): FieldDefinition {
    const common = {
        name: createUniqueFieldName(
            translate("new_field", "statesmith.settings.new_field"),
        ),
        label: "",
        description: translate(
            "Describe what this field tracks and when it changes.",
            "statesmith.settings.new_field_description",
        ),
    };

    return changeFieldType(common, type);
}

function changeFieldType(
    field: Pick<FieldDefinition, "name" | "label" | "description">,
    type: FieldType,
): FieldDefinition {
    switch (type) {
        case "number":
        case "progress":
            return {
                ...field,
                type,
                config: { defaultValue: 0, min: 0, max: 100 },
            };

        case "text":
            return {
                ...field,
                type,
                config: { defaultValue: "", maxLength: 1000 },
            };

        case "toggle":
            return {
                ...field,
                type,
                config: { defaultValue: false },
            };

        case "tag":
        case "select": {
            const option = translate("Option", "statesmith.settings.option");
            return {
                ...field,
                type,
                config: { defaultValue: option, options: [option] },
            };
        }
    }
}

function setContainerActive(container: HTMLElement, active: boolean): void {
    container.hidden = !active;

    for (const control of container.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
    >("button, input, select, textarea")) {
        control.disabled = !active;
    }
}

function updateActionAvailability(): void {
    if (!elements) {
        return;
    }

    const hasSelection = selectedIndex >= 0 && selectedIndex < fields.length;
    elements.duplicateButton.disabled = !hasSelection;
    elements.deleteButton.disabled = !hasSelection;
    elements.upButton.disabled = !hasSelection || selectedIndex === 0;
    elements.downButton.disabled =
        !hasSelection || selectedIndex === fields.length - 1;
}

function renderList(): void {
    if (!elements) {
        return;
    }

    elements.list.replaceChildren();

    for (let index = 0; index < fields.length; index += 1) {
        const field = fields[index];
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${field.label || field.name} (${getTypeLabel(field.type)})`;
        elements.list.append(option);
    }

    if (selectedIndex >= 0 && selectedIndex < fields.length) {
        elements.list.value = String(selectedIndex);
    }

    updateActionAvailability();
}

function validateFieldName(): void {
    if (!elements) {
        return;
    }

    const duplicate = fields.some(
        (field, index) =>
            index !== selectedIndex && field.name === elements?.nameInput.value,
    );
    elements.nameInput.setCustomValidity(
        duplicate
            ? translate(
                "Field names must be unique.",
                "statesmith.settings.field_name_duplicate",
            )
            : "",
    );
}

function validateNumericConfig(): void {
    if (!elements) {
        return;
    }

    const min = elements.numericMinInput.valueAsNumber;
    const max = elements.numericMaxInput.valueAsNumber;
    const defaultValue = elements.numericDefaultInput.valueAsNumber;
    const invalidRange =
        Number.isFinite(min) && Number.isFinite(max) && min > max;
    const invalidDefault =
        Number.isFinite(defaultValue) &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        (defaultValue < min || defaultValue > max);

    elements.numericMinInput.setCustomValidity(
        invalidRange
            ? translate(
                "Minimum must not be greater than maximum.",
                "statesmith.settings.invalid_numeric_range",
            )
            : "",
    );
    elements.numericDefaultInput.setCustomValidity(
        invalidDefault
            ? translate(
                "Default value must be within the configured range.",
                "statesmith.settings.invalid_numeric_default",
            )
            : "",
    );
}

function validateTextConfig(): void {
    if (!elements) {
        return;
    }

    const maxLength = elements.textMaxLengthInput.valueAsNumber;
    const invalid =
        Number.isInteger(maxLength) &&
        elements.textDefaultInput.value.length > maxLength;
    elements.textDefaultInput.setCustomValidity(
        invalid
            ? translate(
                "Default value exceeds the maximum length.",
                "statesmith.settings.invalid_text_default",
            )
            : "",
    );
}

function getChoiceDefaultIndex(field: FieldDefinition): number {
    if (field.type !== "tag" && field.type !== "select") {
        return -1;
    }

    const savedIndex = choiceDefaultIndices.get(field);

    if (
        savedIndex !== undefined &&
        savedIndex >= 0 &&
        savedIndex < field.config.options.length
    ) {
        return savedIndex;
    }

    const matchingIndex = field.config.options.indexOf(
        field.config.defaultValue,
    );
    const index =
        matchingIndex >= 0
            ? matchingIndex
            : field.config.options.length > 0
                ? 0
                : -1;
    choiceDefaultIndices.set(field, index);
    return index;
}

function validateChoiceOptions(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field || (field.type !== "tag" && field.type !== "select")) {
        return;
    }

    const inputs = elements.choiceOptions.querySelectorAll<HTMLInputElement>(
        ".statesmith-choice-value",
    );
    const seen = new Set<string>();
    let firstIssue = "";

    for (let index = 0; index < inputs.length; index += 1) {
        const value = field.config.options[index]?.trim() ?? "";
        let issue = "";

        if (!value) {
            issue = translate(
                "Option cannot be empty.",
                "statesmith.settings.option_required",
            );
        } else if (value.length > 100) {
            issue = translate(
                "Each option must contain at most 100 characters.",
                "statesmith.settings.option_too_long",
            );
        } else if (seen.has(value)) {
            issue = translate(
                "Options must be unique.",
                "statesmith.settings.options_duplicate",
            );
        }

        inputs[index].setCustomValidity(issue);
        inputs[index].setAttribute("aria-invalid", String(Boolean(issue)));
        firstIssue ||= issue;
        seen.add(value);
    }

    if (field.config.options.length === 0) {
        firstIssue = translate(
            "Add at least one option.",
            "statesmith.settings.options_required",
        );
    }

    elements.choiceIssues.textContent = firstIssue;
    elements.choiceIssues.hidden = !firstIssue;
}

function renderChoiceOptions(field: FieldDefinition): void {
    if (!elements || (field.type !== "tag" && field.type !== "select")) {
        return;
    }

    const defaultIndex = getChoiceDefaultIndex(field);
    field.config.defaultValue = field.config.options[defaultIndex] ?? "";
    const rows: HTMLElement[] = [];

    for (let index = 0; index < field.config.options.length; index += 1) {
        const row = document.createElement("div");
        row.className = "statesmith-choice-row";
        row.dataset.optionIndex = String(index);

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "statesmith_choice_default";
        radio.className = "statesmith-choice-default";
        radio.checked = index === defaultIndex;
        radio.title = translate(
            "Set as default",
            "statesmith.settings.set_as_default",
        );
        radio.setAttribute(
            "aria-label",
            `${translate("Default value", "statesmith.settings.default_value")} ${index + 1}`,
        );

        const input = document.createElement("input");
        input.type = "text";
        input.className = "text_pole statesmith-choice-value";
        input.value = field.config.options[index];
        input.maxLength = 100;
        input.required = true;
        input.setAttribute(
            "aria-label",
            `${translate("Option", "statesmith.settings.option")} ${index + 1}`,
        );

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "menu_button statesmith-choice-remove";
        removeButton.title = translate(
            "Remove option",
            "statesmith.settings.remove_option",
        );
        removeButton.setAttribute(
            "aria-label",
            `${removeButton.title} ${index + 1}`,
        );
        const removeIcon = document.createElement("i");
        removeIcon.className = "fa-solid fa-xmark";
        removeIcon.setAttribute("aria-hidden", "true");
        removeButton.append(removeIcon);

        row.append(radio, input, removeButton);
        rows.push(row);
    }

    elements.choiceOptions.replaceChildren(...rows);
    validateChoiceOptions();
}

function renderSelectedField(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();
    elements.emptyState.hidden = field !== undefined;
    elements.editor.hidden = field === undefined;

    for (const control of elements.editor.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea")) {
        control.disabled = field === undefined;
    }

    if (!field) {
        setContainerActive(elements.numericConfig, false);
        setContainerActive(elements.textConfig, false);
        setContainerActive(elements.toggleConfig, false);
        setContainerActive(elements.choiceConfig, false);
        updateActionAvailability();
        return;
    }

    elements.nameInput.value = field.name;
    elements.typeInput.value = field.type;
    elements.labelInput.value = field.label;
    elements.descriptionInput.value = field.description;
    validateFieldName();

    const isNumeric = field.type === "number" || field.type === "progress";
    const isText = field.type === "text";
    const isToggle = field.type === "toggle";
    const isChoice = field.type === "tag" || field.type === "select";
    setContainerActive(elements.numericConfig, isNumeric);
    setContainerActive(elements.textConfig, isText);
    setContainerActive(elements.toggleConfig, isToggle);
    setContainerActive(elements.choiceConfig, isChoice);

    if (isNumeric && (field.type === "number" || field.type === "progress")) {
        elements.numericDefaultInput.value = String(field.config.defaultValue);
        elements.numericMinInput.value = String(field.config.min);
        elements.numericMaxInput.value = String(field.config.max);
        validateNumericConfig();
    } else if (field.type === "text") {
        elements.textDefaultInput.value = field.config.defaultValue;
        elements.textMaxLengthInput.value = String(field.config.maxLength);
        validateTextConfig();
    } else if (field.type === "toggle") {
        elements.toggleDefaultInput.checked = field.config.defaultValue;
    } else if (field.type === "tag" || field.type === "select") {
        renderChoiceOptions(field);
    }

    updateActionAvailability();
}

function notifyChanged(renderFieldList = false): void {
    if (renderFieldList) {
        renderList();
    } else {
        updateActionAvailability();
    }

    onChange?.();
}

function updateCommonField(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.name = elements.nameInput.value;
    field.label = elements.labelInput.value;
    field.description = elements.descriptionInput.value;
    validateFieldName();
    notifyChanged(true);
}

function updateNumericField(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field || (field.type !== "number" && field.type !== "progress")) {
        return;
    }

    field.config.defaultValue = elements.numericDefaultInput.valueAsNumber;
    field.config.min = elements.numericMinInput.valueAsNumber;
    field.config.max = elements.numericMaxInput.valueAsNumber;
    validateNumericConfig();
    notifyChanged();
}

function updateTextField(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field || field.type !== "text") {
        return;
    }

    field.config.defaultValue = elements.textDefaultInput.value;
    field.config.maxLength = elements.textMaxLengthInput.valueAsNumber;
    validateTextConfig();
    notifyChanged();
}

function updateToggleField(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field || field.type !== "toggle") {
        return;
    }

    field.config.defaultValue = elements.toggleDefaultInput.checked;
    notifyChanged();
}

function getChoiceRowIndex(target: HTMLElement): number {
    const row = target.closest<HTMLElement>(".statesmith-choice-row");
    return row ? Number(row.dataset.optionIndex) : -1;
}

function updateChoiceOption(input: HTMLInputElement): void {
    const field = getSelectedField();
    const index = getChoiceRowIndex(input);

    if (
        !field ||
        (field.type !== "tag" && field.type !== "select") ||
        index < 0 ||
        index >= field.config.options.length
    ) {
        return;
    }

    field.config.options[index] = input.value;

    if (index === getChoiceDefaultIndex(field)) {
        field.config.defaultValue = input.value;
    }

    validateChoiceOptions();
    notifyChanged();
}

function selectChoiceDefault(radio: HTMLInputElement): void {
    const field = getSelectedField();
    const index = getChoiceRowIndex(radio);

    if (
        !field ||
        (field.type !== "tag" && field.type !== "select") ||
        index < 0 ||
        index >= field.config.options.length
    ) {
        return;
    }

    choiceDefaultIndices.set(field, index);
    field.config.defaultValue = field.config.options[index];
    notifyChanged();
}

function addChoiceOption(): void {
    const field = getSelectedField();

    if (!field || (field.type !== "tag" && field.type !== "select")) {
        return;
    }

    const hadOptions = field.config.options.length > 0;
    field.config.options.push("");

    if (!hadOptions) {
        choiceDefaultIndices.set(field, 0);
        field.config.defaultValue = "";
    }

    renderChoiceOptions(field);
    notifyChanged();
    elements?.choiceOptions
        .querySelector<HTMLInputElement>(
            ".statesmith-choice-row:last-child .statesmith-choice-value",
        )
        ?.focus();
}

function removeChoiceOption(button: HTMLButtonElement): void {
    const field = getSelectedField();
    const index = getChoiceRowIndex(button);

    if (
        !field ||
        (field.type !== "tag" && field.type !== "select") ||
        index < 0 ||
        index >= field.config.options.length
    ) {
        return;
    }

    const previousDefaultIndex = getChoiceDefaultIndex(field);
    field.config.options.splice(index, 1);
    const nextDefaultIndex =
        field.config.options.length === 0
            ? -1
            : index === previousDefaultIndex
                ? 0
                : index < previousDefaultIndex
                    ? previousDefaultIndex - 1
                    : previousDefaultIndex;
    choiceDefaultIndices.set(field, nextDefaultIndex);
    field.config.defaultValue = field.config.options[nextDefaultIndex] ?? "";
    renderChoiceOptions(field);
    notifyChanged();

    const nextInput =
        elements?.choiceOptions.querySelectorAll<HTMLInputElement>(
            ".statesmith-choice-value",
        )[Math.min(index, field.config.options.length - 1)];
    (nextInput ?? elements?.choiceAddButton)?.focus();
}

function changeSelectedType(): void {
    if (!elements) {
        return;
    }

    const field = getSelectedField();

    if (!field) {
        return;
    }

    fields[selectedIndex] = changeFieldType(
        field,
        elements.typeInput.value as FieldType,
    );
    renderList();
    renderSelectedField();
    notifyChanged();
}

function addField(): void {
    fields.push(createField());
    selectedIndex = fields.length - 1;
    renderList();
    renderSelectedField();
    notifyChanged();
    elements?.nameInput.focus();
    elements?.nameInput.select();
}

function duplicateField(): void {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    const copy = cloneFields([field])[0];
    copy.name = createUniqueFieldName(`${field.name}_copy`);
    if (copy.label) {
        copy.label = `${copy.label} ${translate("copy", "statesmith.settings.copy_suffix")}`;
    }
    fields.splice(selectedIndex + 1, 0, copy);
    selectedIndex += 1;
    renderList();
    renderSelectedField();
    notifyChanged();
}

function deleteField(): void {
    if (!getSelectedField()) {
        return;
    }

    fields.splice(selectedIndex, 1);
    selectedIndex = Math.min(selectedIndex, fields.length - 1);
    renderList();
    renderSelectedField();
    notifyChanged();
}

function moveField(offset: -1 | 1): void {
    const targetIndex = selectedIndex + offset;

    if (selectedIndex < 0 || targetIndex < 0 || targetIndex >= fields.length) {
        return;
    }

    const current = fields[selectedIndex];
    fields[selectedIndex] = fields[targetIndex];
    fields[targetIndex] = current;
    selectedIndex = targetIndex;
    renderList();
    renderSelectedField();
    notifyChanged();
}

function bindEvents(): void {
    if (!elements) {
        return;
    }

    elements.list.addEventListener("change", () => {
        selectedIndex = Number(elements?.list.value ?? -1);
        renderSelectedField();
    });
    elements.newButton.addEventListener("click", addField);
    elements.duplicateButton.addEventListener("click", duplicateField);
    elements.deleteButton.addEventListener("click", deleteField);
    elements.upButton.addEventListener("click", () => moveField(-1));
    elements.downButton.addEventListener("click", () => moveField(1));
    elements.nameInput.addEventListener("input", updateCommonField);
    elements.labelInput.addEventListener("input", updateCommonField);
    elements.descriptionInput.addEventListener("input", updateCommonField);
    elements.typeInput.addEventListener("change", changeSelectedType);
    elements.numericDefaultInput.addEventListener("input", updateNumericField);
    elements.numericMinInput.addEventListener("input", updateNumericField);
    elements.numericMaxInput.addEventListener("input", updateNumericField);
    elements.textDefaultInput.addEventListener("input", updateTextField);
    elements.textMaxLengthInput.addEventListener("input", updateTextField);
    elements.toggleDefaultInput.addEventListener("change", updateToggleField);
    elements.choiceAddButton.addEventListener("click", addChoiceOption);
    elements.choiceOptions.addEventListener("input", (event) => {
        const target = event.target;

        if (
            target instanceof HTMLInputElement &&
            target.classList.contains("statesmith-choice-value")
        ) {
            updateChoiceOption(target);
        }
    });
    elements.choiceOptions.addEventListener("focusout", (event) => {
        const target = event.target;

        if (
            target instanceof HTMLInputElement &&
            target.classList.contains("statesmith-choice-value")
        ) {
            const trimmed = target.value.trim();

            if (target.value !== trimmed) {
                target.value = trimmed;
                updateChoiceOption(target);
            }
        }
    });
    elements.choiceOptions.addEventListener("change", (event) => {
        const target = event.target;

        if (
            target instanceof HTMLInputElement &&
            target.classList.contains("statesmith-choice-default")
        ) {
            selectChoiceDefault(target);
        }
    });
    elements.choiceOptions.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const button = target.closest<HTMLButtonElement>(
            ".statesmith-choice-remove",
        );

        if (button) {
            removeChoiceOption(button);
        }
    });
}

export function initializeFieldEditor(changeHandler: () => void): boolean {
    elements = collectElements();

    if (!elements) {
        return false;
    }

    onChange = changeHandler;
    bindEvents();
    renderList();
    renderSelectedField();
    return true;
}

export function setFieldEditorFields(value: readonly FieldDefinition[]): void {
    fields = cloneFields(value);
    choiceDefaultIndices = new WeakMap<FieldDefinition, number>();
    selectedIndex = fields.length > 0 ? 0 : -1;
    renderList();
    renderSelectedField();
}

export function getFieldEditorFields(): FieldDefinition[] {
    const copy = cloneFields(fields);

    for (let index = 0; index < fields.length; index += 1) {
        const source = fields[index];
        const target = copy[index];

        if (
            (source.type !== "tag" && source.type !== "select") ||
            (target.type !== "tag" && target.type !== "select")
        ) {
            continue;
        }

        target.config.options = source.config.options.map((option) =>
            option.trim(),
        );
        target.config.defaultValue =
            target.config.options[getChoiceDefaultIndex(source)] ?? "";
    }

    return copy;
}

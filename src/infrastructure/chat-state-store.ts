import { MODULE_NAME } from "../constants";
import type { StateSmithChatState } from "../domain/state";

export function getChatState(): StateSmithChatState | undefined {
    const { chatMetadata } = SillyTavern.getContext();
    return chatMetadata[MODULE_NAME] as StateSmithChatState | undefined;
}

export async function saveChatState(state: StateSmithChatState): Promise<void> {
    const { chatMetadata, saveMetadata } = SillyTavern.getContext();
    chatMetadata[MODULE_NAME] = state;
    await saveMetadata();
}

export async function deleteChatState(): Promise<void> {
    const { chatMetadata, saveMetadata } = SillyTavern.getContext();
    delete chatMetadata[MODULE_NAME];
    await saveMetadata();
}

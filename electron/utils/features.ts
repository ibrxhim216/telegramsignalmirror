/**
 * Build-level feature flag.
 *
 * The desktop app has ONE codebase but ships as two products:
 *   - Customer build  ("Telegram Signal Mirror"): .env has no ADVANCED_FEATURES and no Anthropic key.
 *   - Advanced build  ("TSM Advanced", personal):  .env.advanced sets ADVANCED_FEATURES=true + keys.
 *
 * Everything that sends messages to Claude, or changes execution to the two-entry model, must
 * check this flag. In a customer build the flag is absent, so those paths are unreachable even
 * if a saved channel config still has splitEntryMode=true.
 */
export function isAdvancedBuild(): boolean {
  return process.env.ADVANCED_FEATURES === 'true'
}

/** True only when the channel opted into split entry AND this build allows it. */
export function splitEntryEnabled(config: { advancedSettings?: { splitEntryMode?: boolean } } | null | undefined): boolean {
  return isAdvancedBuild() && !!config?.advancedSettings?.splitEntryMode
}

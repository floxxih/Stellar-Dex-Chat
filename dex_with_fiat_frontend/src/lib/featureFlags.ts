export const FEATURE_FLAGS = {
  enableConversionReminders:
    process.env.NEXT_PUBLIC_FLAG_CONVERSION_REMINDERS !== 'false',
  enableAdminReconciliation:
    process.env.NEXT_PUBLIC_FLAG_ADMIN_RECONCILIATION !== 'false',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function getFeatureFlag(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

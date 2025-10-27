// Stubbed helpers to avoid any dependency on Stripe/subscription tables
export async function waitForStripeRecords(): Promise<boolean> { return true; }
export async function getUserActivePlan(): Promise<'pro_monthly'> { return 'pro_monthly'; }
export function maxPhotosForPlan(): number { return 10; }
export function validatePhotoLimit(photosCount: number): { isValid: boolean; maxAllowed: number; errorMessage?: string } {
  const maxAllowed = 10;
  if (photosCount > maxAllowed) {
    return { isValid: false, maxAllowed, errorMessage: `Se permiten hasta ${maxAllowed} fotos. Has seleccionado ${photosCount}.` };
  }
  return { isValid: true, maxAllowed };
}
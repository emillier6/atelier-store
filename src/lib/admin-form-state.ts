/**
 * What the admin forms pass through useActionState. Outside the admin action
 * files because a "use server" module may only export async functions.
 *
 * `values` echoes the submission so the form can refill itself after an
 * error (React resets a form once its action returns); `fieldErrors` holds
 * one message per field name, shown under that field; `saved` is a short
 * notice for a successful save that stays on the page.
 */
export type AdminFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: string;
};

export const emptyAdminState: AdminFormState = { error: null };

/** One message for "fix the fields below", so forms read the same. */
export const FIELD_ERRORS_MESSAGE = "Check the highlighted fields.";

/** Every string field of a submission, for `values`. Files are skipped. */
export function submittedValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

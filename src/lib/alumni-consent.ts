/**
 * Versioned consent text shown on the alumni submission form. Changing
 * the wording in a way that changes what a submitter is agreeing to
 * means adding ALUMNI_CONSENT_V2 and updating the form to use it,
 * never editing this string in place - AlumniEntry.consentVersion
 * records which version a given submitter actually saw and agreed to.
 */
export const ALUMNI_CONSENT_VERSION = "v1";

export const ALUMNI_CONSENT_V1 =
  "I agree that the Department of Mathematics, Obafemi Awolowo University, may store the details I provide here and show my name, level, graduation year, organisation, role, city, country, industry, photo and LinkedIn link on the public alumni page once the department has checked my entry. My email address is kept private and is never shown publicly. I can ask the department to correct or remove my entry at any time. See the privacy notice for more detail.";

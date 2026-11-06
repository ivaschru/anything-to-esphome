/** The catalog distinguishes hardware evidence from a flashable release.
 * Matching stock/HW identifies a candidate, not permission to install it.
 * The backend repeats admission independently before creating any image.
 */
import {failure} from "./i18n.mjs";

export function requireLiteProfile(catalog, identity) {
  const matches = catalog.filter(profile => profile.model === identity.model
    && profile.stock_versions?.includes(identity.stock_version)
    && profile.hardware_versions?.includes(identity.hardware)
    && profile.id.startsWith("lite"));
  if (matches.length !== 1) {
    throw failure("identity_unsupported");
  }
  const profile = matches[0];
  if (profile.installer !== "beta" || !profile.firmware) {
    throw failure(profile.note_key || "profile_unavailable");
  }
  return profile;
}

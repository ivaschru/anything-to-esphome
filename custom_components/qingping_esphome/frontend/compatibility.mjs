/** The catalog distinguishes hardware evidence from a flashable release.
 * Matching stock/HW identifies a candidate, not permission to install it.
 * The backend repeats admission independently before creating any image.
 */
export function requireLiteProfile(catalog, identity) {
  const matches = catalog.filter(profile => profile.model === identity.model
    && profile.stock_versions?.includes(identity.stock_version)
    && profile.hardware_versions?.includes(identity.hardware)
    && profile.id.startsWith("lite"));
  if (matches.length !== 1) {
    throw new Error("Эта аппаратная/заводская версия ещё не поддержана мастером. Настройки не менялись");
  }
  const profile = matches[0];
  if (profile.installer !== "beta" || !profile.firmware) {
    throw new Error(profile.note + ". Настройки не менялись");
  }
  return profile;
}

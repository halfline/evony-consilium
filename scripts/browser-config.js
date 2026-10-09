// Browser OAuth and Picker settings are public once the site is deployed.
// Their source values stay in the environment instead of tracked files.
export function browserConfigModule(env = process.env) {
  const config = {
    clientId: env.GOOGLE_CLIENT_ID || "",
    apiKey: env.GOOGLE_PICKER_API_KEY || "",
    appId: env.GOOGLE_CLOUD_PROJECT_NUMBER || "",
  };
  return `export const googleConfig = ${JSON.stringify(config, null, 2)};\n`;
}

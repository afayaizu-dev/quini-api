// La versión desplegada sale del tag de git (APP_VERSION, inyectado en la imagen por deploy.yml);
// sin tag (local, tests) se usa la de package.json.
export function resolveAppVersion(appVersion: string | undefined, packageVersion: string): string {
    return appVersion ? appVersion.replace(/^v/, "") : packageVersion;
}

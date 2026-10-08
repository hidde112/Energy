function requireStatus(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
}

function finalPath(response: Response) {
  try {
    return new URL(response.url).pathname;
  } catch {
    return "";
  }
}

export async function assertDeploymentPage(response: Response): Promise<void> {
  requireStatus(response, "ENERGYDEX deployment");
  if (finalPath(response) === "/setup") {
    throw new Error("ENERGYDEX deployment redirected to setup.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("ENERGYDEX deployment did not return HTML.");
  }
  const body = await response.text();
  if (!body.includes("ENERGYDEX")) {
    throw new Error(
      "ENERGYDEX deployment did not return the application shell.",
    );
  }
}

export async function assertPwaManifest(response: Response): Promise<void> {
  requireStatus(response, "PWA manifest");
  const contentType = response.headers.get("content-type") ?? "";
  if (
    finalPath(response) === "/setup" ||
    (!contentType.includes("application/manifest+json") &&
      !contentType.includes("application/json"))
  ) {
    throw new Error("PWA manifest returned an invalid response.");
  }
  let manifest: unknown;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error("PWA manifest returned invalid JSON.", { cause: error });
  }
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("name" in manifest) ||
    manifest.name !== "ENERGYDEX" ||
    !("start_url" in manifest) ||
    manifest.start_url !== "/" ||
    !("display" in manifest) ||
    manifest.display !== "standalone"
  ) {
    throw new Error("PWA manifest is missing the ENERGYDEX install contract.");
  }
}

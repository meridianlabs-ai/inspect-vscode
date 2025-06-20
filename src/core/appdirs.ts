// https://stackoverflow.com/questions/19275776/node-js-how-to-get-the-os-platforms-user-data-folder

import path from "node:path";
import fs from "node:fs";
import process from "node:process";

export function appDataDir(appName: string, subdir?: string, roaming = false) {
  return appDir(appName, userDataDir, subdir, roaming);
}

export function appConfigDir(
  appName: string,
  subdir?: string,
  roaming = false
) {
  return appDir(appName, userConfigDir, subdir, roaming);
}

export function appCacheDir(appName: string, subdir?: string) {
  return appDir(appName, userCacheDir, subdir);
}

export function appRuntimeDir(appName: string, subdir?: string) {
  return appDir(appName, userRuntimeDir, subdir);
}

function appDir(
  appName: string,
  sourceFn: (appName: string, roaming?: boolean) => string,
  subdir?: string,
  roaming?: boolean
) {
  const dir = sourceFn(appName, roaming);
  const fullDir = subdir ? path.join(dir, subdir) : dir;
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }
  return fullDir;
}

export function userDataDir(appName: string, roaming = false) {
  switch (process.platform) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "win32":
      return windowsUserDataDir(appName, roaming);
    case "linux":
    default:
      return xdgUserDataDir(appName);
  }
}

export function userConfigDir(appName: string, roaming = false) {
  switch (process.platform) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "win32":
      return windowsUserDataDir(appName, roaming);
    case "linux":
    default:
      return xdgUserConfigDir(appName);
  }
}

export function userCacheDir(appName: string) {
  switch (process.platform) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "win32":
      return windowsUserDataDir(appName);
    case "linux":
    default:
      return xdgUserCacheDir(appName);
  }
}

export function userRuntimeDir(appName: string) {
  switch (process.platform) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "win32":
      return windowsUserCacheDir(appName);
    case "linux":
    default:
      return xdgUserRuntimeDir(appName);
  }
}

function darwinUserDataDir(appName: string) {
  return path.join(
    process.env.HOME || "",
    "Library",
    "Application Support",
    appName
  );
}

function darwinUserCacheDir(appName: string) {
  return path.join(
    process.env.HOME || "",
    "Library",
    "Caches",
    "TemporaryItems",
    appName
  );
}

function xdgUserDataDir(appName: string) {
  const dataHome =
    process.env.XDG_DATA_HOME ||
    path.join(process.env.HOME || "", ".local", "share");
  return path.join(dataHome, appName);
}

function xdgUserConfigDir(appName: string) {
  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "", ".config");
  return path.join(configHome, appName);
}

function xdgUserCacheDir(appName: string) {
  const cacheHome =
    process.env.XDG_CACHE_HOME || path.join(process.env.HOME || "", ".cache");
  return path.join(cacheHome, appName);
}

function xdgUserRuntimeDir(appName: string) {
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir) {
    return path.join(runtimeDir, appName);
  } else {
    return xdgUserDataDir(appName);
  }
}

function windowsUserDataDir(appName: string, roaming = false) {
  const dir = (roaming ? process.env.APPDATA : process.env.LOCALAPPDATA) || "";
  return path.join(dir, appName);
}

function windowsUserCacheDir(appName: string) {
  const dir = process.env.LOCALAPPDATA || "";
  return path.join(dir, "Temp", appName, appName);
}

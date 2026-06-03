import { FEATURES } from './config';

const DEFAULT_FLAGS: Record<string, boolean> = {
  enable_new_drag: true,
  enable_queue_scheduler: false,
  enable_telemetry: true,
  // Include all config-level feature flags as defaults
  ...Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, v])),
};

export function isEnabled(flag: string): boolean {
  try {
    const stored = window.localStorage.getItem("ss:feature_flags");
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, boolean>;
      if (flag in parsed) return !!parsed[flag];
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_FLAGS[flag] ?? false;
}

export function setFlag(flag: string, value: boolean) {
  try {
    const stored = window.localStorage.getItem("ss:feature_flags");
    const parsed = stored ? JSON.parse(stored) as Record<string, boolean> : {};
    parsed[flag] = value;
    window.localStorage.setItem("ss:feature_flags", JSON.stringify(parsed));
  } catch (e) {
    // ignore
  }
}

export default { isEnabled, setFlag };

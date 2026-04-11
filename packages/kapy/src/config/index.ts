export { DEFAULT_ENV_PREFIX, defaults, getDefaultConfig } from "./defaults.js";
export { loadConfig, parseEnvConfig } from "./loader.js";
export { deepMergeConfigs } from "./loader-merge.js";
export type {
	ConfigField,
	ConfigSchema,
	ConfigSource,
	GlobalConfig,
	MergedConfig,
	ProjectConfig,
} from "./schema.js";
export { ConfigSourcePriority } from "./schema.js";

export { defaults, getDefaultConfig, DEFAULT_ENV_PREFIX } from "./defaults.js";
export { loadConfig, parseEnvConfig } from "./loader.js";
export { deepMergeConfigs } from "./loader-merge.js";
export type {
	ConfigField,
	ConfigSchema,
	MergedConfig,
	ConfigSource,
	ProjectConfig,
	GlobalConfig,
} from "./schema.js";
export { ConfigSourcePriority } from "./schema.js";
export { defaults, getDefaultConfig, DEFAULT_ENV_PREFIX } from "./defaults.js";
export { loadConfig, parseEnvConfig, deepMergeConfigs } from "./loader.js";
export type {
	ConfigField,
	ConfigSchema,
	MergedConfig,
	ConfigSource,
	ProjectConfig,
	GlobalConfig,
} from "./schema.js";
export { ConfigSourcePriority } from "./schema.js";
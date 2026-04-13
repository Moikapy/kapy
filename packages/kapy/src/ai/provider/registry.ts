import type { ModelInfo, ProviderConfig } from "./types.js";

/**
 * Provider registry — registration, lookup, and model management.
 * Extensions register providers via api.registerProvider().
 */
export class ProviderRegistry {
	private providers = new Map<string, ProviderConfig>();
	private models = new Map<string, ModelInfo[]>(); // providerId -> models
	private defaultModelId: string | null = null;

	/** Register a provider configuration */
	register(config: ProviderConfig): void {
		if (this.providers.has(config.id)) return; // first wins
		this.providers.set(config.id, config);
		if (!this.models.has(config.id)) {
			this.models.set(config.id, []);
		}
		// Register pre-configured models
		if (config.models) {
			for (const model of config.models) {
				this.addModel(config.id, model);
			}
		}
	}

	/** Get a provider by ID */
	get(id: string): ProviderConfig | undefined {
		return this.providers.get(id);
	}

	/** Check if a provider exists */
	has(id: string): boolean {
		return this.providers.has(id);
	}

	/** Remove a provider and its models */
	unregister(id: string): void {
		this.providers.delete(id);
		this.models.delete(id);
		if (this.defaultModelId) {
			// Check if default model belonged to this provider
			const defaultModel = this.getModel(this.defaultModelId);
			if (defaultModel?.provider === id) {
				this.defaultModelId = null;
			}
		}
	}

	/** Get all provider configs */
	all(): ProviderConfig[] {
		return [...this.providers.values()];
	}

	/** Add a model to a provider */
	addModel(providerId: string, model: ModelInfo): void {
		const models = this.models.get(providerId);
		if (models) {
			// Don't add duplicates
			if (!models.some((m) => m.id === model.id)) {
				models.push(model);
			}
		}
	}

	/** Get all models for a provider */
	getModels(providerId: string): ModelInfo[] {
		return this.models.get(providerId) ?? [];
	}

	/** Get all models from all providers */
	getAllModels(): ModelInfo[] {
		const result: ModelInfo[] = [];
		for (const modelList of this.models.values()) {
			result.push(...modelList);
		}
		return result;
	}

	/** Find a model by ID across all providers */
	getModel(modelId: string): ModelInfo | undefined {
		for (const modelList of this.models.values()) {
			const found = modelList.find((m) => m.id === modelId);
			if (found) return found;
		}
		return undefined;
	}

	/** Set the default model */
	setDefaultModel(modelId: string): void {
		const model = this.getModel(modelId);
		if (!model) {
			throw new Error(`Cannot set unknown model "${modelId}" as default`);
		}
		this.defaultModelId = modelId;
	}

	/** Get the default model */
	getDefaultModel(): ModelInfo | undefined {
		if (!this.defaultModelId) return undefined;
		return this.getModel(this.defaultModelId);
	}

	/** Number of registered providers */
	get providerCount(): number {
		return this.providers.size;
	}

	/** Total number of models */
	get modelCount(): number {
		let count = 0;
		for (const modelList of this.models.values()) {
			count += modelList.length;
		}
		return count;
	}
}

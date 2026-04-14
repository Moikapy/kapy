/**
 * Model selector dialog — pick LLM model and provider.
 * 1:1 with OpenCode's ModelDialog.
 */

import { createSignal, For, Show } from "solid-js";
import { useTheme } from "../context/theme.jsx";

interface ModelOption {
	id: string;
	name: string;
	provider: string;
}

const DEFAULT_MODELS: ModelOption[] = [
	{ id: "ollama:qwen3:32b", name: "Qwen3 32B", provider: "Ollama" },
	{ id: "ollama:devstral:24b", name: "Devstral 24B", provider: "Ollama" },
	{ id: "openai:gpt-4o", name: "GPT-4o", provider: "OpenAI" },
	{ id: "anthropic:claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "Anthropic" },
];

interface ModelDialogProps {
	models?: ModelOption[];
	onSelect?: (modelId: string) => void;
}

export function ModelDialog(props: ModelDialogProps) {
	const { theme } = useTheme();
	const models = () => props.models ?? DEFAULT_MODELS;
	const [selected, setSelected] = createSignal(0);

	const handleSelect = () => {
		const model = models()[selected()];
		props.onSelect?.(model.id);
	};

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={theme().accent}
			backgroundColor={theme().backgroundPanel}
			padding={1}
			width={45}
			maxHeight={15}
		>
			<box flexDirection="column" gap={1}>
				<text fg={theme().accent}>
					<b>Select Model</b>
				</text>
				<For each={models()}>
					{(model, i) => (
						<box flexDirection="row" gap={1}>
							<text
								fg={i() === selected() ? theme().accent : theme().textMuted}
							>
								{i() === selected() ? "▸" : " "}
							</text>
							<text fg={i() === selected() ? theme().text : theme().textMuted}>
								{model.name}
							</text>
							<Show when={i() === selected()}>
								<text fg={theme().textMuted}>
									({model.provider})
								</text>
							</Show>
						</box>
					)}
				</For>
			</box>
		</box>
	);
}
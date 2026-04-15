import type { JSX } from "solid-js";

interface StatusFooterProps {
	model: () => string;
}

export function StatusFooter(props: StatusFooterProps): JSX.Element {
	return (
		<box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
			<text fg="#565f89">~/kapy</text>
			<text fg="#565f89">⊙ ollama · {props.model()}</text>
		</box>
	);
}
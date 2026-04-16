import type { JSX } from "solid-js";

interface StatusFooterProps {
	model: () => string;
	thinkingLevel: () => string;
}

export function StatusFooter(props: StatusFooterProps): JSX.Element {
	const thinkLabel = () => {
		const level = props.thinkingLevel();
		if (level === "off") return "";
		return ` (${level})`;
	};

	return (
		<box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
			<text fg="#565f89">~/kapy{thinkLabel()}</text>
			<text fg="#565f89">{props.model()}</text>
		</box>
	);
}
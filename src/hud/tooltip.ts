/**
 * The HUD's one tooltip. Any element inside the HUD with a `data-hud-tooltip` attribute gets
 * it: shown after the pointer has rested on the element for a second, always above it, in one
 * fixed font size. Use `data-hud-tooltip` for every tooltip in the HUD, never Foundry's
 * `data-tooltip` (which has its own delay, direction and font).
 */
const ATTRIBUTE = 'data-hud-tooltip';
const SELECTOR = `[${ATTRIBUTE}]`;
const DELAY_MS = 1000;
const GAP_PX = 6;
const MARGIN_PX = 4;

export function installTooltips(root: HTMLElement): () => void {
	const tip = document.createElement('div');
	tip.className = 'nimble-hud-tooltip';
	tip.setAttribute('role', 'tooltip');
	root.appendChild(tip);

	let current: HTMLElement | null = null;
	let timer: number | undefined;

	function hide(): void {
		window.clearTimeout(timer);
		tip.classList.remove('visible');
	}

	function show(target: HTMLElement): void {
		const text = target.getAttribute(ATTRIBUTE);
		if (!text || !target.isConnected || !target.matches(':hover')) return;

		tip.textContent = text;
		tip.classList.add('visible');

		const rect = target.getBoundingClientRect();
		const width = tip.offsetWidth;
		const height = tip.offsetHeight;
		const left = rect.left + rect.width / 2 - width / 2;
		tip.style.left = `${Math.min(Math.max(MARGIN_PX, left), window.innerWidth - width - MARGIN_PX)}px`;
		tip.style.top = `${Math.max(MARGIN_PX, rect.top - height - GAP_PX)}px`;
	}

	function onPointerOver(event: PointerEvent): void {
		const target = (event.target as Element | null)?.closest<HTMLElement>(SELECTOR) ?? null;
		if (target === current) return;
		hide();
		current = target;
		if (target) timer = window.setTimeout(() => show(target), DELAY_MS);
	}

	function onPointerOut(event: PointerEvent): void {
		const next = event.relatedTarget as Element | null;
		if (current && next && current.contains(next)) return;
		hide();
		current = null;
	}

	root.addEventListener('pointerover', onPointerOver);
	root.addEventListener('pointerout', onPointerOut);
	// Clicking or scrolling dismisses the tooltip until the pointer enters another element.
	root.addEventListener('pointerdown', hide);
	root.addEventListener('wheel', hide, { passive: true });

	return () => {
		hide();
		root.removeEventListener('pointerover', onPointerOver);
		root.removeEventListener('pointerout', onPointerOut);
		root.removeEventListener('pointerdown', hide);
		root.removeEventListener('wheel', hide);
		tip.remove();
	};
}

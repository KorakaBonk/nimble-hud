<script lang="ts">
	/** Renders item HTML through Foundry's enricher (so @UUID links and rolls work). */
	let { html }: { html: string } = $props();

	const enriched = $derived(
		foundry.applications.ux.TextEditor.implementation
			.enrichHTML(html)
			.catch(() => html) as Promise<string>,
	);
</script>

{#await enriched then rendered}
	{@html rendered}
{/await}

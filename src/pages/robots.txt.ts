import type { APIContext } from 'astro'

export const prerender = true

export function GET({ site }: APIContext): Response {
	if (!site) {
		return new Response(
			`User-agent: *\nDisallow: \n`,
			{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
		)
	}

	const lines = [
		'User-agent: *',
		'Disallow:',
		`Sitemap: ${new URL('sitemap-index.xml', site)}`,
	]

	return new Response(lines.join('\n'), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
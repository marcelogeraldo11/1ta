/* eslint-env node */
/* global console, process, fetch */
/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import TurndownService from 'turndown'
import RSSParser from 'rss-parser'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUT_DIR = path.resolve(__dirname, '../src/content/blog')

/**
 * Fetch and parse the WordPress news listing page, extract article links, and
 * generate Markdown posts in src/content/blog.
 */
async function main() {
	const baseUrl = 'https://www.1ta.cl'
	const feedUrl = `${baseUrl}/noticias/feed/`
	console.log('Leyendo feed:', feedUrl)

	const parser = new RSSParser({ timeout: 20000 })
	const feed = await parser.parseURL(feedUrl)
	const items = feed.items || []
	console.log(`Encontrados ${items.length} items en RSS`)
	let sources = items.map((item) => ({
		title: item.title || 'Sin título',
		contentHTML: item['content:encoded'] || item.content || '',
		dateISO: item.isoDate || item.pubDate || new Date().toISOString(),
		link: item.link || item.guid || '',
		slug: '',
		coverImageUrl: extractFirstImageUrl(
			item['content:encoded'] || item.content || ''
		),
	}))
	if (sources.length === 0) {
		const apiUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=20&_embed=wp:featuredmedia`
		console.log('RSS vacío, intento API WP:', apiUrl)
		const apiRes = await fetch(apiUrl, {
			headers: { Accept: 'application/json' },
		})
		if (apiRes.ok) {
			const posts = await apiRes.json()
			sources = (posts || []).map((p) => ({
				title: p?.title?.rendered || 'Sin título',
				contentHTML: p?.content?.rendered || '',
				dateISO: p?.date || new Date().toISOString(),
				link: p?.link || '',
				slug: p?.slug || '',
				coverImageUrl:
					p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
					extractFirstImageUrl(p?.content?.rendered || ''),
			}))
			console.log(`API devolvió ${sources.length} posts`)
		} else {
			console.warn('Fallo API:', apiRes.status)
		}
	}

	// Ensure out dir
	fs.mkdirSync(OUT_DIR, { recursive: true })

	const turndown = new TurndownService({ headingStyle: 'atx' })

	for (const src of sources.slice(0, 20)) {
		// limitar por seguridad
		try {
			const url = src.link
			console.log('Procesando:', url)
			const title = src.title || 'Sin título'
			const isoDate = src.dateISO || new Date().toISOString()

			let htmlContent = src.contentHTML || ''
			if (!htmlContent && url) {
				const r = await fetch(url)
				if (r.ok) {
					htmlContent = await r.text()
				}
			}

			const markdownBody = turndown.turndown(htmlContent)
			const slug = src.slug || makeSlug(title)
			const filename = path.join(OUT_DIR, `${slug}.md`)
			const coverUrl = src.coverImageUrl || extractFirstImageUrl(htmlContent)
			if (fs.existsSync(filename)) {
				const existing = fs.readFileSync(filename, 'utf8')
				const hasCover = /\ncoverImageUrl:\s*/.test(existing)
				if (coverUrl && !hasCover) {
					const updated = addCoverToFrontmatter(existing, coverUrl)
					fs.writeFileSync(filename, updated, 'utf8')
					console.log('Updated coverImageUrl:', filename)
				} else {
					console.log('Skip (exists):', filename)
				}
				continue
			}
			const firstNonEmpty = markdownBody.split('\n').find((l) => l.trim()) || ''
			const coverLine = coverUrl ? `coverImageUrl: ${yamlEscape(coverUrl)}\n` : ''
			const frontmatter = `---
` +
				`title: ${yamlEscape(title)}
` +
				`description: ${yamlEscape(firstNonEmpty.slice(0, 150))}
` +
				`pubDate: ${new Date(isoDate).toISOString()}
` +
				`${coverLine}---

`

			fs.writeFileSync(filename, frontmatter + markdownBody, 'utf8')
			console.log('Created:', filename)
		} catch (e) {
			console.error('Error processing item', src?.link, e)
		}
	}

	console.log('Done.')
}

function makeSlug(title) {
	return (
		(title || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-')
			.slice(0, 80) || `noticia-${Date.now()}`
	)
}

function yamlEscape(val) {
	if (!val) {
		return "''"
	}
	const v = String(val).replace(/"/g, '\\"')
	// wrap in quotes to be safe with colons
	return `"${v}"`
}

function extractFirstImageUrl(html) {
	if (!html) {
		return ''
	}
	const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i)
	return m?.[1] || ''
}

function addCoverToFrontmatter(fileContent, coverUrl) {
	const start = fileContent.indexOf('---')
	if (start !== 0) {
		return fileContent // not expected format
	}
	const end = fileContent.indexOf('\n---', start + 3)
	if (end === -1) {
		return fileContent
	}
	const front = fileContent.slice(0, end)
	const rest = fileContent.slice(end)
	if (/\ncoverImageUrl:\s*/.test(front)) {
		return fileContent
	}
	const injected = `${front}\ncoverImageUrl: ${yamlEscape(coverUrl)}`
	return injected + rest
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})

import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import partytown from '@astrojs/partytown'
import icon from 'astro-icon'
import rehypeFigureTitle from 'rehype-figure-title'
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis'
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs'
import remarkModifiedTime from './src/plugins/remark-modified-time.mjs'

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE_URL || 'http://localhost:5174',
	base: '/',
	integrations: [
		mdx(),
		sitemap({
			// Excluir rutas no deseadas del sitemap
			filter: (page) => {
				try {
					const p = typeof page === 'string' ? page : String(page)
					return !p.includes('/404') && !p.endsWith('/rss.xml')
				} catch {
					return true
				}
			},
		}),
		icon(),
		partytown({
			config: {
				forward: ['dataLayer.push'],
			},
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
	server: {
		port: 5174,
	},
	markdown: {
		remarkPlugins: [remarkReadingTime, remarkModifiedTime],
		rehypePlugins: [rehypeFigureTitle, rehypeAccessibleEmojis],
	},
})

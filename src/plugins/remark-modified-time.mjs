import { execSync } from 'node:child_process'

export default function remarkModifiedTime() {
	return (_tree, file) => {
		try {
			const mtime = execSync(
				`git log -1 --format=%ad --date=iso-strict -- "${file.path}"`,
				{ encoding: 'utf8' }
			)
			file.data.astro.frontmatter ??= {}
			file.data.astro.frontmatter.lastModified = mtime.trim()
		} catch {
			// Ignorar si el archivo no está en Git o no hay commits.
		}
	}
}

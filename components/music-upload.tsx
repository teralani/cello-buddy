"use client"

import { ChangeEvent, DragEvent, useRef, useState } from "react"

export default function MusicUpload() {
	const inputRef = useRef<HTMLInputElement>(null)
	const [file, setFile] = useState<File | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [error, setError] = useState("")

	const selectFile = (selectedFile?: File) => {
		if (!selectedFile) return
		if (!selectedFile.name.toLowerCase().endsWith(".mxl")) {
			setFile(null)
			setError("Please choose a valid .mxl file.")
			return
		}
		setError("")
		setFile(selectedFile)
	}

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		selectFile(event.target.files?.[0])
	}

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setIsDragging(false)
		selectFile(event.dataTransfer.files?.[0])
	}

	return (
		<main className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-12">
			<section className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
				<div className="mb-8">
					<p className="mb-2 text-sm font-medium text-primary">Cello Buddy</p>
					<h1 className="text-2xl font-semibold tracking-tight">Upload your sheet music</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Add a MusicXML compressed file to start practicing.
					</p>
				</div>

				<div
					role="button"
					tabIndex={0}
					onClick={() => inputRef.current?.click()}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") inputRef.current?.click()
					}}
					onDragOver={(event) => {
						event.preventDefault()
						setIsDragging(true)
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={handleDrop}
					className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
						isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/60"
					}`}
				>
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
						↑
					</div>
					<p className="font-medium">Drop your .mxl file here</p>
					<p className="mt-1 text-sm text-muted-foreground">or click to browse from your device</p>
					<p className="mt-4 text-xs text-muted-foreground">Supported format: .mxl</p>
					<input ref={inputRef} type="file" accept=".mxl,application/vnd.recordare.musicxml" onChange={handleChange} className="sr-only" />
				</div>

				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}

				{file && (
					<div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">{file.name}</p>
							<p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
						</div>
						<button type="button" onClick={() => setFile(null)} className="ml-4 text-sm text-muted-foreground hover:text-foreground">
							Remove
						</button>
					</div>
				)}

				<button
					type="button"
					disabled={!file}
					className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Continue
				</button>
			</section>
		</main>
	)
}

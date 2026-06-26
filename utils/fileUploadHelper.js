const fs = require("fs");
const path = require("path");

/**
 * Saves a base64 encoded string as a physical file on disk in a subfolder inside the uploads directory.
 * Handles both data URLs (e.g., data:image/png;base64,...) and raw base64.
 * Prepend timestamp and random suffix to avoid naming collisions.
 *
 * @param {string} base64Str - The base64 encoded file string.
 * @param {string} subFolder - Optional subfolder inside uploads (e.g. 'customer', 'chat').
 * @param {string} defaultName - Optional original name of the file to preserve name.
 * @returns {string|null} The relative URL path of the saved file (e.g. '/uploads/...'), or null if empty.
 */
function saveBase64File(base64Str, subFolder = "", defaultName = null) {
	if (!base64Str) return null;

	// If it's already a relative path or URL (not base64), return it as is
	if (
		base64Str.startsWith("/") ||
		base64Str.startsWith("http://") ||
		base64Str.startsWith("https://")
	) {
		let cleanPath = base64Str;
		const hosts = [
			process.env.APP_URL,
			"http://127.0.0.1:5000",
			"http://localhost:5000",
			"http://localhost:3000",
			"http://127.0.0.1:3000"
		].filter(Boolean);

		for (const h of hosts) {
			if (cleanPath.startsWith(h)) {
				cleanPath = cleanPath.slice(h.length);
				break;
			}
		}
		return cleanPath;
	}

	// Extract base64 content and extension/mime
	const match = base64Str.match(/^data:([^;]+);base64,(.+)$/);
	let mimeType = null;
	let base64Data = base64Str;

	if (match) {
		mimeType = match[1];
		base64Data = match[2];
	}

	// Resolve extension from mimeType
	let ext = "bin";
	if (mimeType) {
		const parts = mimeType.split("/");
		if (parts.length > 1) {
			ext = parts[1];
			if (ext === "jpeg") ext = "jpg";
		}
	} else if (defaultName) {
		// If no mimeType but we have a defaultName, extract extension from it
		const extMatch = defaultName.match(/\.([^.]+)$/);
		if (extMatch) {
			ext = extMatch[1];
		}
	}

	const fileBuffer = Buffer.from(base64Data, "base64");

	// Resolve uploads folder path (relative to backend root)
	const uploadDir = subFolder
		? path.join(__dirname, "..", "uploads", subFolder)
		: path.join(__dirname, "..", "uploads");

	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir, { recursive: true });
	}

	const timestamp = Date.now();
	const randomSuffix = Math.floor(Math.random() * 1000);

	// Format naming convention to be unique
	let filename;
	if (defaultName) {
		const sanitizedName = defaultName.replace(/[^a-zA-Z0-9.-]/g, "_");
		filename = `${timestamp}-${randomSuffix}-${sanitizedName}`;
	} else {
		const filePrefix = subFolder || "file";
		filename = `${filePrefix}-${timestamp}-${randomSuffix}.${ext}`;
	}

	const filePath = path.join(uploadDir, filename);
	fs.writeFileSync(filePath, fileBuffer);

	console.log(
		`[FileUploadHelper] File saved to disk successfully: ${filePath}`,
	);

	const relativeUrl = subFolder
		? `/uploads/${subFolder}/${filename}`
		: `/uploads/${filename}`;

	return relativeUrl;
}

module.exports = {
	saveBase64File,
};

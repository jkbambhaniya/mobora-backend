/**
 * Generate a slug from a string.
 * @param {string} text - The input string to slugify
 * @returns {string} The slugified string
 */
function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

module.exports = {
  slugify
};

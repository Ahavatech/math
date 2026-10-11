/**
 * Serializes a JSON-LD object for embedding via dangerouslySetInnerHTML
 * in a <script type="application/ld+json"> tag. JSON.stringify alone
 * does not escape "<", so an admin-entered string field (e.g. a news
 * post or event title) containing "</script><script>..." could break
 * out of the tag and execute as a new <script> element. Escaping "<" to
 * its unicode escape neutralises that without changing the parsed JSON
 * value (JSON parsers treat < identically to a literal "<").
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

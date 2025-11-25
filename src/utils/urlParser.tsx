import React from 'react';

/**
 * Regular expression to match "Link Text (URL)" pattern.
 * Captures optional prefix ("see:", "info:", etc.), link text, and URL separately.
 * Pattern: looks for text followed by URL in parentheses, capturing the colon/prefix separately
 * Example: "For info, see: Phoenix Overview (https://...)"
 *   - Matches from "see:" onward
 *   - Captures "see: " as prefix and "Phoenix Overview" as link text
 */
const LINK_TEXT_URL_REGEX = /(\b(?:see|info|read|check)\s*:\s+)([^(]+?)\s*\((https?:\/\/[^)]+)\)/gi;

/**
 * Regular expression to match standalone URLs.
 * Used as fallback for URLs not in the "Link Text (URL)" pattern.
 */
const STANDALONE_URL_REGEX = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/g;

/**
 * Parses text and converts URLs into clickable links.
 * Prioritizes "Link Text (URL)" pattern, hiding the raw URL and displaying only the link text.
 * Falls back to showing standalone URLs as clickable links.
 *
 * @param text - The text containing potential URLs
 * @returns Array of React elements with clickable links
 */
export function parseTextWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // First pass: Handle "Link Text (URL)" patterns
  const linkTextMatches: Array<{ start: number; end: number; linkText: string; url: string; prefix: string }> = [];
  let match: RegExpExecArray | null;

  const linkTextRegex = new RegExp(LINK_TEXT_URL_REGEX);
  while ((match = linkTextRegex.exec(text)) !== null) {
    const [fullMatch, prefixCapture, linkText, url] = match;
    // Store the captured prefix (e.g., "see: " or "info: ")
    const prefix = prefixCapture || '';

    linkTextMatches.push({
      start: match.index,
      end: match.index + fullMatch.length,
      linkText: linkText.trim(),
      url: url,
      prefix: prefix
    });
  }

  // Process text segments and insert links
  linkTextMatches.forEach((linkMatch) => {
    // Add text before this link
    if (linkMatch.start > lastIndex) {
      const beforeText = text.substring(lastIndex, linkMatch.start);
      parts.push(beforeText);
    }

    // Add the prefix if it exists (e.g., "see: " or "info: ")
    if (linkMatch.prefix) {
      parts.push(linkMatch.prefix);
    }

    // Add the link with clean text (hiding the raw URL)
    const href = linkMatch.url.startsWith('http') ? linkMatch.url : `https://${linkMatch.url}`;
    parts.push(
      <a
        key={`link-${linkMatch.start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline transition-colors"
      >
        {linkMatch.linkText}
      </a>
    );

    lastIndex = linkMatch.end;
  });

  // Add remaining text after the last link
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);

    // Second pass: Handle standalone URLs in remaining text
    const standaloneParts: React.ReactNode[] = [];
    let standaloneLastIndex = 0;
    const standaloneRegex = new RegExp(STANDALONE_URL_REGEX);

    while ((match = standaloneRegex.exec(remainingText)) !== null) {
      const url = match[0];
      const matchIndex = match.index;

      // Add text before the URL
      if (matchIndex > standaloneLastIndex) {
        standaloneParts.push(remainingText.substring(standaloneLastIndex, matchIndex));
      }

      // Add the URL as a clickable link
      const href = url.startsWith('http') ? url : `https://${url}`;
      standaloneParts.push(
        <a
          key={`standalone-${lastIndex + matchIndex}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline transition-colors"
        >
          {url}
        </a>
      );

      standaloneLastIndex = standaloneRegex.lastIndex;
    }

    // Add remaining text after standalone URLs
    if (standaloneLastIndex < remainingText.length) {
      standaloneParts.push(remainingText.substring(standaloneLastIndex));
    }

    parts.push(...(standaloneParts.length > 0 ? standaloneParts : [remainingText]));
  }

  // If no processing occurred, return the original text
  return parts.length === 0 ? [text] : parts;
}

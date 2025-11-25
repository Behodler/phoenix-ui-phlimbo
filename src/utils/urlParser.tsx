import React from 'react';

/**
 * Regular expression to match URLs in text.
 * Matches http://, https://, and www. URLs
 */
const URL_REGEX = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/g;

/**
 * Parses text and converts URLs into clickable links.
 * Returns an array of React elements mixing text and anchor tags.
 *
 * @param text - The text containing potential URLs
 * @returns Array of React elements with clickable links
 */
export function parseTextWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset the regex's lastIndex to ensure we start from the beginning
  const regex = new RegExp(URL_REGEX);

  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const matchIndex = match.index;

    // Add text before the URL
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Add the URL as a clickable link
    const href = url.startsWith('http') ? url : `https://${url}`;
    parts.push(
      <a
        key={matchIndex}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline transition-colors"
      >
        {url}
      </a>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no URLs were found, return the original text
  return parts.length === 0 ? [text] : parts;
}

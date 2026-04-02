/**
 * Utility functions for Alphaclone
 */

// Simple utility function for conditional class names
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Robustly extracts and cleans JSON from an AI's response.
 * Handles markdown code blocks, leading/trailing whitespace, and common AI artifacts.
 */
export function cleanAIJSONResponse(raw: string): string {
    if (!raw) return '';
    
    let cleaned = raw.trim();
    
    // Attempt to extract content within markdown code blocks if present
    // Matches ```json ... ``` or ``` ... ```
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const match = codeBlockRegex.exec(cleaned);
    
    if (match && match[1]) {
        cleaned = match[1].trim();
    }
    
    // Find the first '{' and last '}' to handle text before/after the JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
}
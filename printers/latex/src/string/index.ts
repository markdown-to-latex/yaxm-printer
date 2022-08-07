export function removeStringUnnecessaryLineBreaks(text: string): string {
    return text
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+/g, '')
        .replace(/\n{2,}$/g, '\n');
}

// --- api

export * from './escapes';

/**
 * VBScript Detection and Parsing Utilities
 */

/**
 * Detects if content is likely VBScript based on keywords and patterns
 */
export function isVBScript(content: string): boolean {
    if (!content || content.length < 10) return false;

    const lines = content.split('\n').slice(0, 100); // Check first 100 lines
    let vbsScore = 0;

    const vbsKeywords = [
        /\b(?:Dim|Set|Const)\s+\w+/i,
        /\b(?:Function|Sub)\s+\w+/i,
        /\bEnd\s+(?:Function|Sub|If|With|Select)\b/i,
        /\bWScript\./i,
        /\bCreateObject\s*\(/i,
        /\bMsgBox\s*\(/i,
        /\bOption\s+Explicit\b/i,
        /\bOn\s+Error\s+Resume\s+Next\b/i,
        /\bIf\s+.*\s+Then\b/i,
        /\bElseIf\b/i,
        /\bFor\s+Each\b/i,
        /\bNext\b/i,
        /\bDo\s+(?:While|Until)\b/i,
        /\bLoop\b/i,
        /\bSelect\s+Case\b/i,
        /\bCase\s+/i,
        /\bWith\s+/i,
        /\bClass\s+\w+/i,
        /\bProperty\s+(?:Get|Let|Set)\b/i,
        /\bRedim\b/i,
        /\bErase\b/i,
        /\bIsEmpty\b/i,
        /\bIsNull\b/i,
        /\bIsObject\b/i,
        /\bCStr\b/i,
        /\bCInt\b/i,
        /\bCLng\b/i,
    ];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("'")) continue; // Skip empty and comments

        for (const pattern of vbsKeywords) {
            if (pattern.test(trimmed)) {
                vbsScore++;
                break; // Count once per line
            }
        }
    }

    // If we found 3 or more VBS keywords, it's likely VBScript
    return vbsScore >= 3;
}

/**
 * Parse VBScript outline (functions, subs, variables, classes)
 */
export interface VBSOutlineNode {
    name: string;
    line: number;
    type: 'function' | 'variable' | 'class' | 'call';
}

export function parseVBSOutline(content: string): VBSOutlineNode[] {
    const lines = content.split('\n');
    const nodes: VBSOutlineNode[] = [];

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("'")) return; // Skip empty and comments

        // VBScript Functions and Subs
        const funcMatch = trimmed.match(/^(?:Public\s+|Private\s+)?(?:Function|Sub)\s+([a-zA-Z_]\w*)/i);
        if (funcMatch) {
            nodes.push({ name: funcMatch[1], line: i + 1, type: 'function' });
            return;
        }

        // VBScript Variables (Dim, Set, Const)
        const varMatch = trimmed.match(/^(?:Dim|Set|Const)\s+([a-zA-Z_]\w*)/i);
        if (varMatch) {
            nodes.push({ name: varMatch[1], line: i + 1, type: 'variable' });
            return;
        }

        // VBScript Classes
        const classMatch = trimmed.match(/^Class\s+([a-zA-Z_]\w*)/i);
        if (classMatch) {
            nodes.push({ name: classMatch[1], line: i + 1, type: 'class' });
            return;
        }

        // VBScript Function/Sub Calls (basic detection)
        const callMatch = trimmed.match(/^(?:Call\s+)?([a-zA-Z_]\w*)\s*\(/i);
        if (callMatch && !funcMatch) {
            nodes.push({ name: callMatch[1], line: i + 1, type: 'call' });
        }
    });

    return nodes;
}

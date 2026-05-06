// Extended CyberChef-inspired operations
// This file contains additional operations to complement cyber-ops.ts

/**
 * ROT13 Cipher
 */
export const rot13 = (input: string): string => {
    return input.replace(/[a-zA-Z]/g, (char) => {
        const code = char.charCodeAt(0);
        const isUpperCase = code >= 65 && code <= 90;
        const base = isUpperCase ? 65 : 97;
        return String.fromCharCode(((code - base + 13) % 26) + base);
    });
};

/**
 * ROT47 Cipher
 */
export const rot47 = (input: string): string => {
    return input.replace(/[!-~]/g, (char) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(33 + ((code + 14) % 94));
    });
};

/**
 * Reverse String
 */
export const reverseString = (input: string): string => {
    return input.split('').reverse().join('');
};

/**
 * To Morse Code
 */
export const toMorseCode = (input: string): string => {
    const morseMap: Record<string, string> = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
        '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
        '8': '---..', '9': '----.', ' ': '/'
    };
    
    return input.toUpperCase().split('').map(char => morseMap[char] || char).join(' ');
};

/**
 * From Morse Code
 */
export const fromMorseCode = (input: string): string => {
    const morseMap: Record<string, string> = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
        '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
        '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
        '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
        '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
        '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
        '---..': '8', '----.': '9', '/': ' '
    };
    
    return input.split(' ').map(code => morseMap[code] || code).join('');
};

/**
 * To Binary
 */
export const toBinary = (input: string): string => {
    return input.split('').map(char => 
        char.charCodeAt(0).toString(2).padStart(8, '0')
    ).join(' ');
};

/**
 * From Binary
 */
export const fromBinary = (input: string): string => {
    try {
        return input.split(/\s+/).map(bin => 
            String.fromCharCode(parseInt(bin, 2))
        ).join('');
    } catch (e) {
        return `[ERROR: Invalid Binary] - ${e.message}`;
    }
};

/**
 * To Octal
 */
export const toOctal = (input: string): string => {
    return input.split('').map(char => 
        char.charCodeAt(0).toString(8).padStart(3, '0')
    ).join(' ');
};

/**
 * From Octal
 */
export const fromOctal = (input: string): string => {
    try {
        return input.split(/\s+/).map(oct => 
            String.fromCharCode(parseInt(oct, 8))
        ).join('');
    } catch (e) {
        return `[ERROR: Invalid Octal] - ${e.message}`;
    }
};

/**
 * To Decimal
 */
export const toDecimal = (input: string): string => {
    return input.split('').map(char => char.charCodeAt(0)).join(' ');
};

/**
 * From Decimal
 */
export const fromDecimal = (input: string): string => {
    try {
        return input.split(/\s+/).map(dec => 
            String.fromCharCode(parseInt(dec, 10))
        ).join('');
    } catch (e) {
        return `[ERROR: Invalid Decimal] - ${e.message}`;
    }
};

/**
 * To Charcode
 */
export const toCharcode = (input: string, args?: { base?: number }): string => {
    const base = args?.base || 10;
    return input.split('').map(char => char.charCodeAt(0).toString(base)).join(' ');
};

/**
 * From Charcode
 */
export const fromCharcode = (input: string, args?: { base?: number }): string => {
    try {
        const base = args?.base || 10;
        return input.split(/\s+/).map(code => 
            String.fromCharCode(parseInt(code, base))
        ).join('');
    } catch (e) {
        return `[ERROR: Invalid Charcode] - ${e.message}`;
    }
};

/**
 * Escape String
 */
export const escapeString = (input: string): string => {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");
};

/**
 * Unescape String
 */
export const unescapeString = (input: string): string => {
    try {
        return input
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
    } catch (e) {
        return `[ERROR: Unescape Failed] - ${e.message}`;
    }
};

/**
 * Count Occurrences
 */
export const countOccurrences = (input: string, args?: { search?: string }): string => {
    const search = args?.search || '';
    if (!search) return 'No search string provided';
    
    const regex = new RegExp(search, 'g');
    const matches = input.match(regex);
    return `Found ${matches ? matches.length : 0} occurrence(s) of "${search}"`;
};

/**
 * Find and Replace
 */
export const findReplace = (input: string, args?: { find?: string; replace?: string; regex?: boolean }): string => {
    try {
        const find = args?.find || '';
        const replace = args?.replace || '';
        const useRegex = args?.regex || false;
        
        if (!find) return input;
        
        if (useRegex) {
            const regex = new RegExp(find, 'g');
            return input.replace(regex, replace);
        } else {
            return input.split(find).join(replace);
        }
    } catch (e) {
        return `[ERROR: Find/Replace Failed] - ${e.message}`;
    }
};

/**
 * Split String
 */
export const splitString = (input: string, args?: { delimiter?: string }): string => {
    const delimiter = args?.delimiter || '\n';
    return input.split(delimiter).join('\n');
};

/**
 * Join String
 */
export const joinString = (input: string, args?: { delimiter?: string }): string => {
    const delimiter = args?.delimiter || '';
    return input.split('\n').join(delimiter);
};

/**
 * Unique Lines
 */
export const uniqueLines = (input: string): string => {
    const lines = input.split('\n');
    return [...new Set(lines)].join('\n');
};

/**
 * Sort Lines
 */
export const sortLines = (input: string, args?: { reverse?: boolean }): string => {
    const lines = input.split('\n');
    lines.sort();
    if (args?.reverse) lines.reverse();
    return lines.join('\n');
};

/**
 * Filter Lines
 */
export const filterLines = (input: string, args?: { pattern?: string; invert?: boolean }): string => {
    try {
        const pattern = args?.pattern || '';
        const invert = args?.invert || false;
        
        if (!pattern) return input;
        
        const regex = new RegExp(pattern);
        const lines = input.split('\n');
        
        return lines.filter(line => invert ? !regex.test(line) : regex.test(line)).join('\n');
    } catch (e) {
        return `[ERROR: Filter Failed] - ${e.message}`;
    }
};

/**
 * Head (first N lines)
 */
export const head = (input: string, args?: { lines?: number }): string => {
    const n = args?.lines || 10;
    return input.split('\n').slice(0, n).join('\n');
};

/**
 * Tail (last N lines)
 */
export const tail = (input: string, args?: { lines?: number }): string => {
    const n = args?.lines || 10;
    const lines = input.split('\n');
    return lines.slice(Math.max(0, lines.length - n)).join('\n');
};

/**
 * Add Line Numbers
 */
export const addLineNumbers = (input: string): string => {
    return input.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n');
};

/**
 * Remove Line Numbers
 */
export const removeLineNumbers = (input: string): string => {
    return input.split('\n').map(line => line.replace(/^\d+:\s*/, '')).join('\n');
};

/**
 * To Snake Case
 */
export const toSnakeCase = (input: string): string => {
    return input
        .replace(/([A-Z])/g, '_$1')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .toLowerCase()
        .replace(/^_/, '');
};

/**
 * To Camel Case
 */
export const toCamelCase = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[_-\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
};

/**
 * To Kebab Case
 */
export const toKebabCase = (input: string): string => {
    return input
        .replace(/([A-Z])/g, '-$1')
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-')
        .toLowerCase()
        .replace(/^-/, '');
};

/**
 * To Pascal Case
 */
export const toPascalCase = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[_-\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
        .replace(/^(.)/, (char) => char.toUpperCase());
};

/**
 * Swap Case
 */
export const swapCase = (input: string): string => {
    return input.split('').map(char => {
        if (char === char.toUpperCase()) return char.toLowerCase();
        return char.toUpperCase();
    }).join('');
};

/**
 * To Title Case
 */
export const toTitleCase = (input: string): string => {
    return input.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Pad Lines
 */
export const padLines = (input: string, args?: { width?: number; char?: string; align?: 'left' | 'right' | 'center' }): string => {
    const width = args?.width || 80;
    const padChar = args?.char || ' ';
    const align = args?.align || 'left';
    
    return input.split('\n').map(line => {
        if (line.length >= width) return line;
        const padding = width - line.length;
        
        switch (align) {
            case 'right':
                return padChar.repeat(padding) + line;
            case 'center':
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                return padChar.repeat(leftPad) + line + padChar.repeat(rightPad);
            default:
                return line + padChar.repeat(padding);
        }
    }).join('\n');
};

/**
 * Generate UUID
 */
export const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Generate Random String
 */
export const generateRandomString = (args?: { length?: number; charset?: string }): string => {
    const length = args?.length || 16;
    const charset = args?.charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
};

/**
 * CRC32 Checksum
 */
export const crc32 = (input: string): string => {
    const makeCRCTable = () => {
        let c;
        const crcTable = [];
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    };

    const crcTable = makeCRCTable();
    let crc = 0 ^ (-1);

    for (let i = 0; i < input.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ input.charCodeAt(i)) & 0xFF];
    }

    return ((crc ^ (-1)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

/**
 * Adler32 Checksum
 */
export const adler32 = (input: string): string => {
    const MOD_ADLER = 65521;
    let a = 1, b = 0;

    for (let i = 0; i < input.length; i++) {
        a = (a + input.charCodeAt(i)) % MOD_ADLER;
        b = (b + a) % MOD_ADLER;
    }

    return ((b << 16) | a).toString(16).toUpperCase().padStart(8, '0');
};

/**
 * Fletcher Checksum (16-bit)
 */
export const fletcher16 = (input: string): string => {
    let sum1 = 0, sum2 = 0;

    for (let i = 0; i < input.length; i++) {
        sum1 = (sum1 + input.charCodeAt(i)) % 255;
        sum2 = (sum2 + sum1) % 255;
    }

    return ((sum2 << 8) | sum1).toString(16).toUpperCase().padStart(4, '0');
};

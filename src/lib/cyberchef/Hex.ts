/**
 * Hexadecimal encoding/decoding functions
 * Based on CyberChef implementation
 */

export const TO_HEX_DELIM_OPTIONS = [
    "Space", "Percent", "Comma", "Semi-colon", "Colon",
    "Line feed", "CRLF", "0x", "0x with comma", "\\x", "None"
];

export const FROM_HEX_DELIM_OPTIONS = ["Auto", ...TO_HEX_DELIM_OPTIONS];

function charRep(option: string): string {
    const map: Record<string, string> = {
        "Space": " ",
        "Percent": "%",
        "Comma": ",",
        "Semi-colon": ";",
        "Colon": ":",
        "Line feed": "\n",
        "CRLF": "\r\n",
        "0x": "0x",
        "\\x": "\\x",
        "None": ""
    };
    return map[option] || option;
}

export function toHex(
    input: string | Uint8Array,
    delim: string = "Space",
    padding: number = 2
): string {
    if (!input) return "";
    
    let data: Uint8Array;
    if (typeof input === "string") {
        data = new TextEncoder().encode(input);
    } else {
        data = input;
    }
    
    const delimStr = charRep(delim);
    const prepend = (delim === "0x" || delim === "\\x" || delim === "Percent");
    let output = "";
    
    for (let i = 0; i < data.length; i++) {
        const hex = data[i].toString(16).padStart(padding, "0");
        
        if (prepend) {
            output += delimStr + hex;
        } else {
            output += hex;
            if (i < data.length - 1 && delimStr) {
                output += delimStr;
            }
        }
    }
    
    return output;
}

export function fromHex(input: string, delim: string = "Auto"): string {
    if (!input) return "";
    
    let data = input.trim();
    let chunks: string[] = [];
    
    if (delim === "Auto") {
        // Auto-detect delimiter
        if (data.includes("\\x")) {
            chunks = data.split("\\x").filter(Boolean);
        } else if (data.includes("0x")) {
            chunks = data.split(/[,;\s]+/).map(c => c.replace(/^0x/i, "")).filter(Boolean);
        } else if (data.includes(" ")) {
            chunks = data.split(/\s+/).filter(Boolean);
        } else if (data.includes(",")) {
            chunks = data.split(",").filter(Boolean);
        } else if (data.includes(":")) {
            chunks = data.split(":").filter(Boolean);
        } else if (data.includes(";")) {
            chunks = data.split(";").filter(Boolean);
        } else {
            // Continuous hex string
            data = data.replace(/[^0-9A-Fa-f]/g, "");
            chunks = data.match(/.{1,2}/g) || [];
        }
    } else {
        const delimStr = charRep(delim);
        if (delim === "None") {
            chunks = data.match(/.{1,2}/g) || [];
        } else if (delim === "\\x") {
            chunks = data.split("\\x").filter(Boolean);
        } else if (delim === "0x" || delim === "0x with comma") {
            chunks = data.split(/[,\s]+/).map(c => c.replace(/^0x/i, "")).filter(Boolean);
        } else {
            chunks = data.split(delimStr).filter(Boolean);
        }
    }
    
    // Process in smaller chunks to avoid stack overflow
    const CHUNK_SIZE = 10000;
    const bytes = new Uint8Array(chunks.length);
    
    for (let i = 0; i < chunks.length; i++) {
        const cleaned = chunks[i].trim().replace(/^0x/i, "");
        const byte = parseInt(cleaned, 16);
        bytes[i] = isNaN(byte) ? 0 : byte;
    }
    
    // Decode in chunks to avoid stack overflow with String.fromCharCode
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        // Fallback: decode in chunks to avoid stack overflow
        let result = '';
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.slice(i, Math.min(i + CHUNK_SIZE, bytes.length));
            result += String.fromCharCode(...chunk);
        }
        return result;
    }
}

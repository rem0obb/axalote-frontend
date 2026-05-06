/**
 * Base64 encoding/decoding functions
 * Based on CyberChef implementation
 */

export const ALPHABET_OPTIONS = [
    { name: "Standard (RFC 4648): A-Za-z0-9+/=", value: "A-Za-z0-9+/=" },
    { name: "URL safe (RFC 4648 §5): A-Za-z0-9-_", value: "A-Za-z0-9-_" },
    { name: "Filename safe: A-Za-z0-9+-=", value: "A-Za-z0-9+\\-=" },
    { name: "itoa64: ./0-9A-Za-z=", value: "./0-9A-Za-z=" },
];

function expandAlphRange(alphStr: string): string[] {
    const result: string[] = [];
    let i = 0;
    
    while (i < alphStr.length) {
        if (i < alphStr.length - 2 && alphStr[i + 1] === '-') {
            const start = alphStr.charCodeAt(i);
            const end = alphStr.charCodeAt(i + 2);
            for (let code = start; code <= end; code++) {
                result.push(String.fromCharCode(code));
            }
            i += 3;
        } else {
            if (alphStr[i] !== '\\') {
                result.push(alphStr[i]);
            } else if (i < alphStr.length - 1) {
                result.push(alphStr[i + 1]);
                i++;
            }
            i++;
        }
    }
    
    return result;
}

export function toBase64(input: string | Uint8Array, alphabet: string = "A-Za-z0-9+/="): string {
    if (!input) return "";
    
    let data: Uint8Array;
    if (typeof input === "string") {
        data = new TextEncoder().encode(input);
    } else {
        data = input;
    }
    
    const alphArray = expandAlphRange(alphabet);
    const alphStr = alphArray.join("");
    
    if (alphStr.length !== 64 && alphStr.length !== 65) {
        throw new Error(`Invalid Base64 alphabet length (${alphStr.length})`);
    }
    
    let output = "";
    let i = 0;
    
    while (i < data.length) {
        const chr1 = data[i++];
        const chr2 = data[i++];
        const chr3 = data[i++];
        
        const enc1 = chr1 >> 2;
        const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        let enc4 = chr3 & 63;
        
        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        
        output += alphStr.charAt(enc1) + alphStr.charAt(enc2) +
            alphStr.charAt(enc3) + alphStr.charAt(enc4);
    }
    
    return output;
}

export function fromBase64(
    input: string,
    alphabet: string = "A-Za-z0-9+/=",
    removeNonAlphChars: boolean = true
): string {
    if (!input) return "";
    
    const alphArray = expandAlphRange(alphabet);
    const alphStr = alphArray.join("");
    
    if (alphStr.length !== 64 && alphStr.length !== 65) {
        throw new Error(`Invalid Base64 alphabet length (${alphStr.length})`);
    }
    
    let data = input;
    if (removeNonAlphChars) {
        const re = new RegExp(`[^${alphStr.replace(/[[\]\\\-^$]/g, "\\$&")}]`, "g");
        data = data.replace(re, "");
    }
    
    const output: number[] = [];
    let i = 0;
    
    while (i < data.length) {
        const enc1 = alphStr.indexOf(data.charAt(i++) || "");
        const enc2 = alphStr.indexOf(data.charAt(i++) || "");
        const enc3 = alphStr.indexOf(data.charAt(i++) || "");
        const enc4 = alphStr.indexOf(data.charAt(i++) || "");
        
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        
        if (chr1 >= 0 && chr1 < 256) {
            output.push(chr1);
        }
        if (chr2 >= 0 && chr2 < 256 && enc3 !== 64) {
            output.push(chr2);
        }
        if (chr3 >= 0 && chr3 < 256 && enc4 !== 64) {
            output.push(chr3);
        }
    }
    
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(output));
    } catch {
        return String.fromCharCode(...output);
    }
}

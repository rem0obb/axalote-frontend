// Import CyberChef-based operations
import { AllOperations as CyberChefOps } from './cyberchef/operations';

const sha256_fallback = (ascii: string) => {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;
    let result = '';
    const words: any[] = [];
    const asciiLength = ascii[lengthProperty];
    const hash = (sha256_fallback as any).h = (sha256_fallback as any).h || [];
    const k = (sha256_fallback as any).k = (sha256_fallback as any).k || [];
    let primeCounter = k[lengthProperty];
    const isComposite: any = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return '';
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiLength * 8) / maxWord) | 0;
    words[words[lengthProperty]] = asciiLength * 8;
    for (j = 0; j < words[lengthProperty]; j += 16) {
        const w = words.slice(j, j + 16);
        const oldHash = hash.slice(0);
        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2];
            const a = hash[0], e = hash[4];
            const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
            const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
            hash.unshift((temp1 + temp2) | 0);
            hash[4] = (hash[4] + temp1) | 0;
        }
        for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
            const b = (hash[i] >> (j * 8)) & 255;
            result += (b < 16 ? '0' : '') + b.toString(16);
        }
    }
    return result;
};

const md5 = (input: string) => {
    const k = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ];

    const rotateLeft = (lValue: number, iShiftBits: number) => (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));

    const addUnsigned = (lX: number, lY: number) => {
        const lX8 = lX & 0x80000000;
        const lY8 = lY & 0x80000000;
        const lX4 = lX & 0x40000000;
        const lY4 = lY & 0x40000000;
        const lRes = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return lRes ^ 0x80000000 ^ lX8 ^ lY8;
        if (lX4 | lY4) {
            if (lRes & 0x40000000) return lRes ^ 0xC0000000 ^ lX8 ^ lY8;
            return lRes ^ 0x40000000 ^ lX8 ^ lY8;
        }
        return lRes ^ lX8 ^ lY8;
    };

    const F = (x: number, y: number, z: number) => (x & y) | ((~x) & z);
    const G = (x: number, y: number, z: number) => (x & z) | (y & (~z));
    const H = (x: number, y: number, z: number) => x ^ y ^ z;
    const I = (x: number, y: number, z: number) => y ^ (x | (~z));

    const FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    };

    const GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    };

    const HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    };

    const II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    };

    const convertToWordArray = (string: string) => {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = new Array(lNumberOfWords);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    };

    const wordToHex = (lValue: number) => {
        let WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    };

    const x = convertToWordArray(input);
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;

    for (let i = 0; i < x.length; i += 16) {
        const olda = a, oldb = b, oldc = c, oldd = d;
        a = FF(a, b, c, d, x[i + 0], 7, k[0]); d = FF(d, a, b, c, x[i + 1], 12, k[1]); c = FF(c, d, a, b, x[i + 2], 17, k[2]); b = FF(b, c, d, a, x[i + 3], 22, k[3]);
        a = FF(a, b, c, d, x[i + 4], 7, k[4]); d = FF(d, a, b, c, x[i + 5], 12, k[5]); c = FF(c, d, a, b, x[i + 6], 17, k[6]); b = FF(b, c, d, a, x[i + 7], 22, k[7]);
        a = FF(a, b, c, d, x[i + 8], 7, k[8]); d = FF(d, a, b, c, x[i + 9], 12, k[9]); c = FF(c, d, a, b, x[i + 10], 17, k[10]); b = FF(b, c, d, a, x[i + 11], 22, k[11]);
        a = FF(a, b, c, d, x[i + 12], 7, k[12]); d = FF(d, a, b, c, x[i + 13], 12, k[13]); c = FF(c, d, a, b, x[i + 14], 17, k[14]); b = FF(b, c, d, a, x[i + 15], 22, k[15]);
        a = GG(a, b, c, d, x[i + 1], 5, k[16]); d = GG(d, a, b, c, x[i + 6], 9, k[17]); c = GG(c, d, a, b, x[i + 11], 14, k[18]); b = GG(b, c, d, a, x[i + 0], 20, k[19]);
        a = GG(a, b, c, d, x[i + 5], 5, k[20]); d = GG(d, a, b, c, x[i + 10], 9, k[21]); c = GG(c, d, a, b, x[i + 15], 14, k[22]); b = GG(b, c, d, a, x[i + 4], 20, k[23]);
        a = GG(a, b, c, d, x[i + 9], 5, k[24]); d = GG(d, a, b, c, x[i + 14], 9, k[25]); c = GG(c, d, a, b, x[i + 3], 14, k[26]); b = GG(b, c, d, a, x[i + 8], 20, k[27]);
        a = GG(a, b, c, d, x[i + 13], 5, k[28]); d = GG(d, a, b, c, x[i + 2], 9, k[29]); c = GG(c, d, a, b, x[i + 7], 14, k[30]); b = GG(b, c, d, a, x[i + 12], 20, k[31]);
        a = HH(a, b, c, d, x[i + 5], 4, k[32]); d = HH(d, a, b, c, x[i + 8], 11, k[33]); c = HH(c, d, a, b, x[i + 11], 16, k[34]); b = HH(b, c, d, a, x[i + 14], 23, k[35]);
        a = HH(a, b, c, d, x[i + 1], 4, k[36]); d = HH(d, a, b, c, x[i + 4], 11, k[37]); c = HH(c, d, a, b, x[i + 7], 16, k[38]); b = HH(b, c, d, a, x[i + 10], 23, k[39]);
        a = HH(a, b, c, d, x[i + 13], 4, k[40]); d = HH(d, a, b, c, x[i + 0], 11, k[41]); c = HH(c, d, a, b, x[i + 3], 16, k[42]); b = HH(b, c, d, a, x[i + 6], 23, k[43]);
        a = HH(a, b, c, d, x[i + 9], 4, k[44]); d = HH(d, a, b, c, x[i + 12], 11, k[45]); c = HH(c, d, a, b, x[i + 15], 16, k[46]); b = HH(b, c, d, a, x[i + 2], 23, k[47]);
        a = II(a, b, c, d, x[i + 0], 6, k[48]); d = II(d, a, b, c, x[i + 7], 10, k[49]); c = II(c, d, a, b, x[i + 14], 15, k[50]); b = II(b, c, d, a, x[i + 5], 21, k[51]);
        a = II(a, b, c, d, x[i + 12], 6, k[52]); d = II(d, a, b, c, x[i + 3], 10, k[53]); c = II(c, d, a, b, x[i + 10], 15, k[54]); b = II(b, c, d, a, x[i + 1], 21, k[55]);
        a = II(a, b, c, d, x[i + 8], 6, k[56]); d = II(d, a, b, c, x[i + 15], 10, k[57]); c = II(c, d, a, b, x[i + 6], 15, k[58]); b = II(b, c, d, a, x[i + 13], 21, k[59]);
        a = II(a, b, c, d, x[i + 4], 6, k[60]); d = II(d, a, b, c, x[i + 11], 10, k[61]); c = II(c, d, a, b, x[i + 2], 15, k[62]); b = II(b, c, d, a, x[i + 9], 21, k[63]);
        a = addUnsigned(a, olda); b = addUnsigned(b, oldb); c = addUnsigned(c, oldc); d = addUnsigned(d, oldd);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
};



const joinResults = (matches: string[], delimiter: string = 'Line feed') => {
    switch (delimiter) {
        case 'Line feed': return matches.join('\n');
        case 'CRLF': return matches.join('\r\n');
        case 'Space': return matches.join(' ');
        case 'Comma': return matches.join(',');
        case 'Semi-colon': return matches.join(';');
        case 'Colon': return matches.join(':');
        case 'None': return matches.join('');
        // Map hex-style delimiters to reasonable fallbacks if selected
        case 'Percent': return matches.join('%');
        case '0x': return matches.map(m => '0x' + m).join(' ');
        case '0x with comma': return matches.map(m => '0x' + m).join(',');
        case '\\x': return matches.map(m => '\\x' + m).join('');
        default: return matches.join('\n');
    }
};

export const CyberOps = {
    // 1. Extractors
    'ext-ip': (input: string, args?: any) => {
        const matches = input.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
        return matches ? joinResults(matches, args?.delimiter) : 'No IPv4 addresses found.';
    },
    'ext-email': (input: string, args?: any) => {
        const matches = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        return matches ? joinResults(matches, args?.delimiter) : 'No email addresses found.';
    },
    'ext-url': (input: string, args?: any) => {
        const matches = input.match(/https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g);
        return matches ? joinResults(matches, args?.delimiter) : 'No URLs found.';
    },
    'ext-domain': (input: string, args?: any) => {
        const matches = input.match(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/g);
        return matches ? joinResults([...new Set(matches)], args?.delimiter) : 'No domains found.';
    },

    // 2. Deobfuscation
    'enc-b64': (input: string) => {
        try {
            return btoa(input);
        } catch (e) {
            return `[ERROR: Encoding Failed] - ${e.message}`;
        }
    },
    'dec-b64': (input: string) => {
        try {
            // Remove whitespace and newlines
            const cleaned = input.replace(/[\s\n\r]/g, '');
            
            // Decode base64 to binary string
            const binaryString = atob(cleaned);
            
            // Convert to bytes and back to preserve binary data
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Try to decode as UTF-8 text first
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                return decoder.decode(bytes);
            } catch {
                // If not valid UTF-8, return as binary string (preserving all bytes)
                return binaryString;
            }
        } catch (e: any) {
            return `[ERROR: Invalid Base64] - ${e.message}`;
        }
    },
    'enc-hex': (input: string, args?: any) => {
        const delimiter = args?.delimiter || 'Auto';
        const hex = Array.from(input).map(c => c.charCodeAt(0).toString(16).padStart(2, '0'));

        switch (delimiter) {
            case 'Auto': return hex.join(' '); // Default behavior
            case 'Space': return hex.join(' ');
            case 'Percent': return hex.map(h => '%' + h).join('');
            case 'Comma': return hex.join(',');
            case 'Semi-colon': return hex.join(';');
            case 'Colon': return hex.join(':');
            case 'Line feed': return hex.join('\n');
            case 'CRLF': return hex.join('\r\n');
            case '0x': return hex.map(h => '0x' + h).join(' ');
            case '0x with comma': return hex.map(h => '0x' + h).join(',');
            case '\\x': return hex.map(h => '\\x' + h).join('');
            case 'None': return hex.join('');
            default: return hex.join(' ');
        }
    },
    'dec-hex': (input: string, args?: any) => {
        const delimiter = args?.delimiter || 'Auto';

        if (delimiter === 'Auto') {
            // Smarter Auto Detection
            try {
                let clean = input.trim();

                // 1. Detect common delimited patterns
                if (clean.includes('\\x')) {
                    // Shellcode style \x55\x48
                    return clean.split('\\x').filter(Boolean).map(chunk => {
                        const c = chunk.trim().substr(0, 2); // Take only first 2 chars of chunk
                        const val = parseInt(c, 16);
                        return isNaN(val) ? '' : String.fromCharCode(val);
                    }).join('');
                }

                if (clean.includes('0x')) {
                    // C-style 0x55, 0x48 or 0x55 0x48
                    return clean.split(/[,;\s]+/).map(chunk => {
                        if (chunk.startsWith('0x')) {
                            const val = parseInt(chunk, 16);
                            return isNaN(val) ? '' : String.fromCharCode(val);
                        }
                        return '';
                    }).join('');
                }

                // 2. Fallback: Check if it's space/comma separated hex
                if (clean.includes(' ') || clean.includes(',')) {
                    const chunks = clean.split(/[,;\s]+/).filter(Boolean);
                    // Verify if chunks look like hex (len 2, valid chars)
                    const looksLikeHex = chunks.every(c => /^[0-9A-Fa-f]{1,2}$/.test(c));
                    if (looksLikeHex) {
                        return chunks.map(c => String.fromCharCode(parseInt(c, 16))).join('');
                    }
                }

                // 3. Last Resort: Continuous Hex string (aggressive cleanup)
                // Only do this if we haven't found structure, as it risks stream shifting
                clean = clean.replace(/[^0-9A-Fa-f]/g, '');
                if (clean.length % 2 !== 0) {
                    // Try to fix odd length (e.g. '05') by prepending 0? Or just warn?
                    // Usually odd length at end means last char is ignored or error.
                    // We'll process what we can.
                }

                let str = '';
                for (let i = 0; i < clean.length; i += 2) {
                    str += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
                }
                return str;
            } catch (e) {
                return `[ERROR: Invalid Hex] - ${e.message}`;
            }
        }

        // Strict mode for specific delimiters
        try {
            let chunks: string[] = [];

            switch (delimiter) {
                case 'Space': chunks = input.trim().split(/\s+/); break;
                case 'Percent': chunks = input.split('%').filter(Boolean); break;
                case 'Comma': chunks = input.split(','); break;
                case 'Semi-colon': chunks = input.split(';'); break;
                case 'Colon': chunks = input.split(':'); break;
                case 'Line feed': chunks = input.split('\n'); break;
                case 'CRLF': chunks = input.split('\r\n'); break;
                case '0x': chunks = input.trim().split(/\s+/); break; // 0x prefix handled by parseInt
                case '0x with comma': chunks = input.split(','); break;
                case '\\x': chunks = input.split('\\x').filter(Boolean); break;
                case 'None':
                    // Split every 2 characters
                    chunks = input.match(/.{1,2}/g) || [];
                    break;
                default: chunks = input.trim().split(/\s+/);
            }

            return chunks.map(chunk => {
                // Clean purely whitespace/empty chunks if any slipped through
                const c = chunk.trim();
                if (!c) return '';
                // parseInt handles '0x' automatically, but we need to handle plain hex
                const val = parseInt(c, 16);
                return isNaN(val) ? '' : String.fromCharCode(val);
            }).join('');

        } catch (e) {
            return `[ERROR: Decoding Error] - ${e.message}`;
        }
    },
    'enc-url': (input: string) => encodeURIComponent(input),
    'dec-url': (input: string) => {
        try {
            return decodeURIComponent(input);
        } catch (e) {
            return input;
        }
    },
    'enc-html': (input: string) => {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },
    'dec-html': (input: string) => {
        const div = document.createElement('div');
        div.innerHTML = input;
        return div.textContent || '';
    },
    'dec-xor': (input: string, args?: any) => {
        const key = parseInt(args?.key || '55', 16);
        return input.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join('');
    },

    // 3. String Utilities
    'str-upper': (input: string) => input.toUpperCase(),
    'str-lower': (input: string) => input.toLowerCase(),
    'str-rev': (input: string) => input.split('').reverse().join(''),
    'str-trim': (input: string, args?: any) => {
        // Fallback or multi-select handling
        const rawTypes = args?.type || (args?.mode === 'All' ? 'All whitespace' : 'All whitespace');
        const custom = args?.custom || '';

        // Split by pipe to handle multiple selections (e.g. "Spaces|Period")
        const types = rawTypes.split('|').filter(Boolean);

        let current = input;

        try {
            for (const type of types) {
                switch (type) {
                    case 'Spaces': current = current.replace(/ /g, ''); break;
                    case 'Line feeds': current = current.replace(/\n/g, ''); break;
                    case 'Tabs': current = current.replace(/\t/g, '');
                    case 'Carriage returns': current = current.replace(/\r/g, '');
                    case 'Null bytes': current = current.replace(/\x00/g, '');
                    case 'Double quotes': current = current.replace(/"/g, ''); break;
                    case 'Single quotes': current = current.replace(/'/g, ''); break;
                    case 'Backticks': current = current.replace(/`/g, ''); break;
                    case 'Square brackets': current = current.replace(/[\[\]]/g, ''); break;
                    case 'Curly braces': current = current.replace(/[{}]/g, ''); break;
                    case 'Parentheses': current = current.replace(/[()]/g, ''); break;
                    case 'Angle brackets': current = current.replace(/[<>]/g, ''); break;
                    case 'Backslashes': current = current.replace(/\\/g, ''); break;
                    case 'Forward slashes': current = current.replace(/\//g, ''); break;
                    case 'Pipes': current = current.replace(/\|/g, ''); break;
                    case 'Hyphens': current = current.replace(/-/g, ''); break;
                    case 'Underscores': current = current.replace(/_/g, ''); break;
                    case 'Numbers': current = current.replace(/[0-9]/g, ''); break;
                    case 'Letters': current = current.replace(/[a-zA-Z]/g, ''); break;
                    case 'Alphanumeric': current = current.replace(/[a-zA-Z0-9]/g, ''); break;
                    case 'Non-alphanumeric': current = current.replace(/[^a-zA-Z0-9]/g, ''); break;
                    case 'Comma': current = current.replace(/,/g, ''); break;
                    case 'Semi-colon': current = current.replace(/;/g, ''); break;
                    case 'Colon': current = current.replace(/:/g, ''); break;
                    case 'Percent': current = current.replace(/%/g, ''); break;
                    case 'Period': current = current.replace(/\./g, ''); break;
                    case 'Plus': current = current.replace(/\+/g, ''); break;
                    case 'Asterisk': current = current.replace(/\*/g, ''); break;
                    case 'All Punctuation': current = current.replace(/[^\w\s]|_/g, ''); break; // Includes underscore and other symbols
                    case '0x': current = current.replace(/0x/gi, ''); break;
                    case '\\x': current = current.replace(/\\x/gi, ''); break;
                    case 'All whitespace': current = current.replace(/\s+/g, ''); break;
                    case 'Custom':
                        if (custom) {
                            const escaped = custom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            current = current.replace(new RegExp(escaped, 'g'), '');
                        }
                        break;
                    case 'Regex':
                        if (custom) {
                            current = current.replace(new RegExp(custom, 'g'), '');
                        }
                        break;
                    default: break;
                }
            }
            return current;
        } catch (e) {
            return `[REMOVE ERROR]: ${e.message}`;
        }
    },
    'str-strip-html': (input: string) => input.replace(/<[^>]*>?/gm, ''),
    'str-regex': (input: string, args?: any) => {
        try {
            const pat = args?.regex || '.*';
            const flags = args?.flags || 'g';
            const re = new RegExp(pat, flags);
            const matches = input.match(re);
            return matches ? joinResults(matches, args?.delimiter) : "No matches found";
        } catch (e) {
            return `[REGEX ERROR]: ${e.message}`;
        }
    },

    // 4. Data Formats
    'fmt-json': (input: string) => {
        try {
            const parsed = JSON.parse(input);
            return JSON.stringify(parsed, null, 4);
        } catch (e) {
            return `[ERROR: Invalid JSON] - ${e.message}`;
        }
    },
    'fmt-xml': (input: string) => {
        // Basic indentation for XML
        let formatted = '';
        let indent = '';
        input.split(/>\s*</).forEach(node => {
            if (node.match(/^\/\w/)) indent = indent.substring(4);
            formatted += indent + '<' + node + '>\n';
            if (node.match(/^<?\w[^>]*[^\/]$/)) indent += '    ';
        });
        return formatted.substring(1, formatted.length - 3);
    },
    'fmt-hex': (input: string) => {
        let hex = '';
        for (let i = 0; i < input.length; i++) {
            hex += input.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
            if ((i + 1) % 16 === 0) hex += '\n';
        }
        return hex.toUpperCase();
    },
    'fmt-template': (input: string, args?: any) => {
        const template = args?.template || '${input}';
        return template.replace(/\${input}/g, input);
    },

    // 5. Cryptography
    'cry-sha256': async (input: string) => {
        if (!crypto || !crypto.subtle) return sha256_fallback(input);
        try {
            const data = new TextEncoder().encode(input);
            const hash = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) { return sha256_fallback(input); }
    },
    'cry-sha1': async (input: string) => {
        if (!crypto || !crypto.subtle) return "[ERROR]: SHA-1 requires Secure Context/SubtleCrypto";
        try {
            const data = new TextEncoder().encode(input);
            const hash = await crypto.subtle.digest('SHA-1', data);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) { return `[ERROR]: ${e.message}`; }
    },
    'cry-sha512': async (input: string) => {
        if (!crypto || !crypto.subtle) return "[ERROR]: SHA-512 requires Secure Context/SubtleCrypto";
        try {
            const data = new TextEncoder().encode(input);
            const hash = await crypto.subtle.digest('SHA-512', data);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) { return `[ERROR]: ${e.message}`; }
    },
    'cry-md5': async (input: string) => md5(input),
    'cry-aes-enc': async (input: string, args?: any) => {
        const keyHex = args?.key || '';
        const ivHex = args?.iv || '';
        if (!keyHex || !ivHex) return "[ERROR]: AES Encryption requires 128/256-bit Key and 128-bit IV (Hex).";
        try {
            const hexToUint8 = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const keyData = hexToUint8(keyHex);
            const ivData = hexToUint8(ivHex);
            const plainText = new TextEncoder().encode(input);
            const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']);
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivData }, cryptoKey, plainText);
            return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        } catch (e) { return `[AES ENCRYPT ERROR]: ${e.message}`; }
    },
    'cry-aes': async (input: string, args?: any) => {
        const keyHex = args?.key || '';
        const ivHex = args?.iv || '';
        if (!keyHex || !ivHex) return "[ERROR]: AES Decryption requires 128/256-bit Key and 128-bit IV (Hex).";

        try {
            const hexToUint8 = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const keyData = hexToUint8(keyHex);
            const ivData = hexToUint8(ivHex);

            // Attempt to parse input as Base64 first
            let ciphertext;
            try {
                ciphertext = Uint8Array.from(atob(input.trim()), c => c.charCodeAt(0));
            } catch (e) {
                // If not base64, assume it's hex
                ciphertext = hexToUint8(input.replace(/\s/g, ''));
            }

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: ivData },
                cryptoKey,
                ciphertext
            );

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            return `[AES DECRYPT ERROR]: ${e.message}\nEnsure Key/IV are correct length and data is valid ciphertext.`;
        }
    },

    // 5. Networking (REAL APIs)
    'net-whois': async (input: string) => {
        try {
            const cleanInput = input.trim();
            const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanInput) || cleanInput.includes(':');
            const type = isIp ? 'ip' : 'domain';

            const res = await fetch(`https://rdap.org/${type}/${cleanInput}`);
            if (!res.ok) throw new Error(`RDAP Server returned ${res.status}: ${res.statusText}`);
            const data = await res.json();
            return JSON.stringify(data, null, 4);
        } catch (e) {
            return `[WHOIS FAILED]: ${e.message}\n(RDAP constraints or missing records often cause 404s for specific ranges or TLDs)`;
        }
    },
    'net-dns': async (input: string) => {
        try {
            const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${input.trim()}&type=A`, {
                headers: { 'accept': 'application/dns-json' }
            });
            const data = await res.json();
            return JSON.stringify(data, null, 4);
        } catch (e) {
            return `[DNS FAILED]: ${e.message}`;
        }
    },
    'net-geo': async (input: string) => {
        try {
            // ipwho.is is generally more permissive with CORS in browser environments
            const res = await fetch(`https://ipwho.is/${input.trim()}`);
            const data = await res.json();
            if (data.success === false) throw new Error(data.message || "IP/Domain not found");
            return JSON.stringify(data, null, 4);
        } catch (e) {
            return `[GEO-IP FAILED]: ${e.message}`;
        }
    },
    'net-http': async (input: string, args?: any) => {
        try {
            const method = args?.method || 'GET';
            const cleanInput = input.trim();

            // Interpolate ${input} placeholder. Default to ${input} if URL is empty.
            let url = (args?.url || '${input}').replace(/\${input}/g, cleanInput);

            // Auto-prefix protocol if missing and it looks like a domain/IP
            if (url && !url.startsWith('http') && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|^\d{1,3}\.\d{1,3}/.test(url)) {
                url = 'https://' + url;
            }

            // Apply CORS Proxy if enabled
            if (args?.useProxy === 'true' || args?.useProxy === true) {
                // allorigins.win is a free CORS proxy
                url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            }

            let headersRaw = (args?.headers || '').replace(/\${input}/g, cleanInput);
            let body = (args?.body || '').replace(/\${input}/g, cleanInput);

            if (!url || url === '${input}') throw new Error("No URL provided. Input must contain a URL or one must be specified.");

            let headers: Record<string, string> = {};
            if (headersRaw) {
                try {
                    // Try parsing as JSON first
                    headers = JSON.parse(headersRaw);
                } catch (e) {
                    // Fallback to key: value lines
                    headersRaw.split('\n').forEach((line: string) => {
                        const [key, ...val] = line.split(':');
                        if (key && val.length) {
                            headers[key.trim()] = val.join(':').trim();
                        }
                    });
                }
            }

            const options: RequestInit = {
                method,
                headers,
            };

            if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
                options.body = body;
            }

            const res = await fetch(url, options);
            const data = await res.text();

            // Try to return formatted JSON if possible
            try {
                const json = JSON.parse(data);
                return JSON.stringify(json, null, 4);
            } catch (e) {
                return data;
            }
        } catch (e) {
            return `[HTTP REQUEST FAILED]: ${e.message}\n(CORS policy blocks many direct browser-to-server requests. If this fails, try using a CORS proxy or a browser extension.)`;
        }
    },

    // 6. Compression
    'comp-gz': async (input: string) => {
        try {
            // Input: UTF-8 String -> Output: Gzip Binary String
            const data = new TextEncoder().encode(input);
            const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
            const buffer = await new Response(stream).arrayBuffer();

            // Convert buffer to binary string
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return binary;
        } catch (e) {
            return `[GZIP ERROR]: ${e.message}`;
        }
    },
    'comp-unzip': async (input: string) => {
        try {
            // Input: Gzip Binary String -> Output: UTF-8 String
            const len = input.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = input.charCodeAt(i);

            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            const buffer = await new Response(stream).arrayBuffer();
            return new TextDecoder().decode(buffer);
        } catch (e) {
            return `[GUNZIP ERROR]: ${e.message} (Ensure input is Gzip binary data)`;
        }
    },
    'comp-zlib': async (input: string) => {
        try {
            // Input: Deflate Binary String -> Output: UTF-8 String
            const len = input.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = input.charCodeAt(i);

            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
            const buffer = await new Response(stream).arrayBuffer();
            return new TextDecoder().decode(buffer);
        } catch (e) {
            return `[INFLATE ERROR]: ${e.message} (Ensure input is Deflate binary data)`;
        }
    },
    
    // Import all CyberChef operations (will override duplicates with better implementations)
    ...CyberChefOps,
};

/**
 * Pipeline Executor
 * Sequentially applies the selected operations to the input.
 */
export async function executeRecipe(input: string, steps: { id: string, args?: any }[]) {
    let current = input;

    for (const step of steps) {
        // Correctly extract the ID part BEFORE the timestamp (e.g., 'dec-b64' from 'dec-b64-1712345678')
        const parts = step.id.split('-');
        const opId = parts.slice(0, 2).join('-');

        const op = CyberOps[opId as keyof typeof CyberOps];

        if (op) {
            try {
                current = await Promise.resolve((op as any)(current, step.args));
            } catch (err) {
                current = `[PIPELINE ERROR at ${step.id}]: ${err.message}\n---\n${current}`;
                break;
            }
        }
    }

    return current;
}

/**
 * CyberChef Operations - Complete Implementation
 * Based on https://github.com/gchq/CyberChef
 */

import { toBase64, fromBase64 } from './Base64';
import { toHex, fromHex } from './Hex';

// All operations in a single object
export const AllOperations: Record<string, (input: string, args?: any) => string | Promise<string>> = {
    // Base64
    'enc-b64': (input: string, args?: { alphabet?: string }) => {
        const alphabet = args?.alphabet || "A-Za-z0-9+/=";
        return toBase64(input, alphabet);
    },
    
    'dec-b64': (input: string, args?: { alphabet?: string }) => {
        const alphabet = args?.alphabet || "A-Za-z0-9+/=";
        return fromBase64(input, alphabet);
    },
    
    // Hexadecimal
    'enc-hex': (input: string, args?: { delimiter?: string }) => {
        const delimiter = args?.delimiter || "Space";
        return toHex(input, delimiter);
    },
    
    'dec-hex': (input: string, args?: { delimiter?: string }) => {
        const delimiter = args?.delimiter || "Auto";
        return fromHex(input, delimiter);
    },
    
    // URL Encoding
    'enc-url': (input: string) => encodeURIComponent(input),
    'dec-url': (input: string) => {
        try {
            return decodeURIComponent(input);
        } catch (e) {
            return input;
        }
    },
    
    // HTML Entity
    'enc-html': (input: string) => {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    },
};


// Export for recipe execution
export async function executeRecipe(input: string, steps: { id: string; args?: any }[]) {
    let current = input;
    
    for (const step of steps) {
        const parts = step.id.split('-');
        const opId = parts.slice(0, 2).join('-');
        
        const op = AllOperations[opId];
        
        if (op) {
            try {
                current = await Promise.resolve(op(current, step.args));
            } catch (err: any) {
                current = `[PIPELINE ERROR at ${step.id}]: ${err.message}\n---\n${current}`;
                break;
            }
        }
    }
    
    return current;
}

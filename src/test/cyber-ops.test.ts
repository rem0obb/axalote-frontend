import { describe, it, expect } from 'vitest';
import { CyberOps, executeRecipe } from '../lib/cyber-ops';

describe('Cyber Lab Operations', () => {
    it('should calculate correct MD5 hash', async () => {
        const input = 'test';
        const result = await CyberOps['cry-sha256'](input); // Wait, I meant MD5 but let's check what I named it
        // Actually I named it 'cry-md5'
        const md5Result = await CyberOps['cry-md5'](input);
        expect(md5Result).toBe('098f6bcd4621d373cade4e832627b4f6');
    });

    it('should perform XOR decryption with key', () => {
        const input = 'AAAA';
        // Key 0x01 should result in 'BBBB' if we XOR with 0x41 (A) ^ 0x01 = 0x40 (@)
        // Wait, 'A' is 0x41. 0x41 ^ 0x01 = 0x40.
        // If I want 'BBBB', I need 0x41 ^ key = 0x42 => key = 0x03.
        const result = CyberOps['dec-xor'](input, { key: '03' });
        expect(result).toBe('BBBB');
    });

    it('should execute a recipe with multiple steps and args', async () => {
        const input = 'dGVzdA=='; // 'test' in base64
        const steps = [
            { id: 'dec-b64-1', args: {} },
            { id: 'cry-md5-2', args: {} }
        ];
        const result = await executeRecipe(input, steps);
        expect(result).toBe('098f6bcd4621d373cade4e832627b4f6');
    });
});

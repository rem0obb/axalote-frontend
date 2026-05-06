import { AISkill } from '@/types/skills.types';
import { Fingerprint, SearchCode, ShieldAlert, Code2 } from 'lucide-react';
import React from 'react';

export const yaraSkills: AISkill[] = [
    {
        id: 'yara-string-extractor',
        name: 'YARA String Generator',
        description: 'Extracts unique strings and generates a high-fidelity YARA rule from sample data.',
        category: 'Detection',
        icon: React.createElement(Fingerprint, { className: "h-4 w-4 text-emerald-400" }),
        promptTemplate: `You are an expert Malware Analyst and Detection Engineer. I need to create a high-fidelity YARA rule to detect a specific family or behavior based on the following strings/data.

### Task Requirements:
1. **Analyze** the provided strings/code snippets.
2. **Filter out** common API calls, generic standard library imports, or common English words that would cause false positives.
3. **Select** the most unique, interesting, or suspicious strings (e.g., PDB paths, custom user-agents, unique mutexes, typoed function names, C2 URLs, or specific cryptographic constants).
4. **Generate** a well-structured YARA rule using the selected strings.
5. Include robust conditions (e.g., matching a minimum number of strings, checking for PE magic bytes if applicable, and ensuring file size reasonable limits).
6. Add professional metadata (author, description, date, reference).

### Output Format:
Explain briefly why you chose the specific strings, and then output the raw YARA rule inside a \`\`\`yara code block.

Here is the data:
[PASTE YOUR STRINGS/CODE SNIPPETS HERE]`
    },
    {
        id: 'malware-behavior-analysis',
        name: 'Behavioral Analysis',
        description: 'Deep dives into identified behaviors, API calls, and IOCs to explain what the malware does.',
        category: 'Analysis',
        icon: React.createElement(SearchCode, { className: "h-4 w-4 text-blue-400" }),
        promptTemplate: `You are an expert Reverse Engineer. Please analyze the following behavioral data, API imports, and IOCs from a suspicious file.

### Task Requirements:
1. Identify the primary capability of this file (e.g., Downloader, Ransomware, InfoStealer, Keylogger).
2. Point out specific API combinations that indicate malicious intent (e.g., VirtualAlloc + WriteProcessMemory + CreateRemoteThread = Process Injection).
3. If there are network indicators, explain the likely C2 protocol or exfiltration method.
4. Provide a brief summary of the potential execution flow based on these artifacts.

### Data to Analyze:
[PASTE BEHAVIORAL DATA / IMPORTS / IOCS HERE]`
    },
    {
        id: 'code-deobfuscator',
        name: 'Script Deobfuscator',
        description: 'Attempts to deobfuscate PowerShell, VBScript, or JavaScript snippets.',
        category: 'Reversing',
        icon: React.createElement(Code2, { className: "h-4 w-4 text-purple-400" }),
        promptTemplate: `You are an expert Reverse Engineer specializing in script deobfuscation. I have a snippet of heavily obfuscated code (e.g., Base64, XOR, string concatenation, variable renaming, or dead code insertion).

### Task Requirements:
1. Identify the obfuscation techniques used.
2. Step-by-step, explain how the payload is decoded or assembled in memory.
3. Provide the fully deobfuscated and functionally equivalent clean version of the code snippet.
4. Highlight any embedded URLs, IP addresses, or dropped file paths found in the clean layer.

### Obfuscated Code:
[PASTE OBFUSCATED CODE HERE]`
    }
];

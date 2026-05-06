import { ParsedData, Section, EnumField, ELFProgramHeader } from '@/types/parser.types';
import { HexRegion } from '@/types/hex.types';

export function getParserRegions(parsed: ParsedData): HexRegion[] {
    const regions: HexRegion[] = [];

    // Aesthetic Colors for specific types of regions
    // Core Headers: Purples/Blues
    // Sections/Segments: Greens/Cyans
    // Tables/Dictionaries: Oranges/Yellows

    const colors = [
        'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        'bg-green-500/20 text-green-400 border-green-500/30',
        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'bg-orange-500/20 text-orange-400 border-orange-500/30',
    ];
    let colorIndex = 0;

    const getNextColor = () => {
        const color = colors[colorIndex % colors.length];
        colorIndex++;
        return color;
    };

    const getLabel = (field: EnumField | undefined | null): string => {
        if (field === undefined || field === null) return 'Unknown';
        if (typeof field === 'object' && 'label' in field) return field.label;
        if (typeof field === 'object' && 'value' in field) return String(field.value);
        return String(field);
    };

    if (!parsed) return regions;

    // Helper: Convert RVA to File Offset
    const rvaToFileOffset = (rva: number): number | undefined => {
        if (!parsed.sections) return undefined;
        for (const section of parsed.sections) {
            if (section.virtual_address !== undefined && section.pointer_to_raw_data !== undefined) {
                // VirtualSize might be 0 or small, try aligned size or Max(VirtualSize, SizeOfRawData)?
                // Standard: within [VirtualAddress, VirtualAddress + VirtualSize]
                const vSize = section.virtual_size || section.size_of_raw_data;
                if (rva >= section.virtual_address && rva < section.virtual_address + vSize) {
                    return rva - section.virtual_address + section.pointer_to_raw_data;
                }
            }
        }
        return undefined;
    };

    // -------------------------------------------------------------------------
    // 1. PE Format
    // -------------------------------------------------------------------------
    if (parsed.format === "PE") {
        const peOffset = parsed.mz?.ofs_pe || parsed.mz?.e_lfanew || 0;

        // MZ Header (DOS Header)
        regions.push({
            label: "DOS Header (MZ)",
            start: 0,
            end: 63, // Standard 64 bytes
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            description: "Legacy MS-DOS Header",
            fields: [
                { offset: 0, size: 2, name: "e_magic", value: "0x5A4D", type: "WORD" },
                { offset: 60, size: 4, name: "e_lfanew", value: `0x${parsed.mz?.e_lfanew?.toString(16).toUpperCase()}`, type: "DWORD" }
            ]
        });

        // DOS Stub (gap between MZ header and PE header)
        if (peOffset > 64) {
            regions.push({
                label: "DOS Stub",
                start: 64,
                end: peOffset - 1,
                color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                description: "Legacy MS-DOS Stub"
            });
        }

        // PE Header Signature
        regions.push({
            label: "PE Signature",
            start: peOffset,
            end: peOffset + 3, // 4 bytes
            color: 'bg-red-500/20 text-red-400 border-red-500/30',
            description: "PE\\0\\0",
            fields: [
                { offset: peOffset, size: 4, name: "Signature", value: "PE\\0\\0", type: "DWORD" }
            ]
        });

        // COFF Header (20 bytes after signature)
        const coffStart = peOffset + 4;
        regions.push({
            label: "COFF Header",
            start: coffStart,
            end: coffStart + 19,
            color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            description: `Machine: ${getLabel(parsed.coff_hdr?.machine)}`,
            fields: [
                { offset: coffStart, size: 2, name: "Machine", value: getLabel(parsed.coff_hdr?.machine), type: "WORD" },
                { offset: coffStart + 2, size: 2, name: "NumberOfSections", value: `${parsed.coff_hdr?.number_of_sections}`, type: "WORD" },
                { offset: coffStart + 4, size: 4, name: "TimeDateStamp", value: `0x${parsed.coff_hdr?.time_date_stamp?.toString(16) || '0'}`, type: "DWORD" },
                { offset: coffStart + 8, size: 4, name: "PointerToSymbolTable", value: `0x${parsed.coff_hdr?.pointer_to_symbol_table?.toString(16) || '0'}`, type: "DWORD" },
                { offset: coffStart + 12, size: 4, name: "NumberOfSymbols", value: `${parsed.coff_hdr?.number_of_symbols || 0}`, type: "DWORD" },
                { offset: coffStart + 16, size: 2, name: "SizeOfOptionalHeader", value: `${parsed.coff_hdr?.size_of_optional_header}`, type: "WORD" },
                { offset: coffStart + 18, size: 2, name: "Characteristics", value: `0x${parsed.coff_hdr?.characteristics?.toString(16)}`, type: "WORD" }
            ]
        });

        // Optional Header
        if (parsed.coff_hdr && parsed.coff_hdr.size_of_optional_header > 0) {
            const optStart = coffStart + 20;
            regions.push({
                label: "Optional Header",
                start: optStart,
                end: optStart + parsed.coff_hdr.size_of_optional_header - 1,
                color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                description: `Magic: ${getLabel(parsed.optional_hdr?.magic)}`,
                fields: [
                    { offset: optStart, size: 2, name: "Magic", value: getLabel(parsed.optional_hdr?.magic), type: "WORD" },
                    { offset: optStart + 2, size: 1, name: "MajorLinkerVersion", value: `${parsed.optional_hdr?.major_linker_version || 0}`, type: "BYTE" },
                    { offset: optStart + 3, size: 1, name: "MinorLinkerVersion", value: `${parsed.optional_hdr?.minor_linker_version || 0}`, type: "BYTE" },
                    { offset: optStart + 4, size: 4, name: "SizeOfCode", value: `0x${parsed.optional_hdr?.size_of_code?.toString(16) || '0'}`, type: "DWORD" },
                    { offset: optStart + 16, size: 4, name: "AddressOfEntryPoint", value: `0x${parsed.optional_hdr?.entry_point?.toString(16)}`, type: "DWORD" },
                    { offset: optStart + 20, size: 4, name: "BaseOfCode", value: `0x${parsed.optional_hdr?.base_of_code?.toString(16) || '0'}`, type: "DWORD" },
                    // Note: ImageBase offset depends on PE32 vs PE32+ (28 vs 24)
                    { offset: optStart + 68, size: 2, name: "Subsystem", value: getLabel(parsed.optional_hdr?.subsystem), type: "WORD" }
                ]
            });
        }

        // Data Directories (Import, Export, Resource, etc.)
        // These are RVAs, need conversion to file offset.
        // Exception: Certificate Table (Security) is File Offset.
        if (parsed.optional_hdr && parsed.optional_hdr.data_dirs) {
            const dirs = parsed.optional_hdr.data_dirs;
            // Map of directory names to friendly labels/colors
            const dirMap: Record<string, string> = {
                'export_table': 'Export Table',
                'import_table': 'Import Table',
                'resource_table': 'Resource Table',
                'exception_table': 'Exception Table',
                'certificate_table': 'Certificate Table',
                'base_relocation_table': 'Base Relocations',
                'debug': 'Debug Directory',
                'architecture': 'Architecture',
                'global_ptr': 'Global Ptr',
                'tls_table': 'TLS Table',
                'load_config_table': 'Load Config',
                'bound_import': 'Bound Import',
                'iat': 'IAT',
                'delay_import_descriptor': 'Delay Import',
                'clr_runtime_header': 'CLR Runtime'
            };

            Object.entries(dirs).forEach(([key, val]: [string, any]) => {
                if (val && val.size > 0) {
                    let startOffset: number | undefined;

                    if (key === 'certificate_table') {
                        startOffset = val.virtual_address; // Raw File Offset for Certs
                    } else {
                        startOffset = rvaToFileOffset(val.virtual_address);
                    }

                    if (startOffset !== undefined) {
                        regions.push({
                            label: dirMap[key] || key,
                            start: startOffset,
                            end: startOffset + val.size - 1,
                            color: getNextColor(), // Use distinct colors?
                            description: `RVA: 0x${val.virtual_address.toString(16)}`,
                            fields: [
                                { offset: startOffset, size: 0, name: "VirtualAddress", value: `0x${val.virtual_address.toString(16)}`, type: "DWORD" },
                                { offset: startOffset, size: 0, name: "Size", value: `0x${val.size.toString(16)}`, type: "DWORD" }
                            ]
                        });
                    }
                }
            });
        }

        // Sections
        if (parsed.sections) {
            parsed.sections.forEach((s) => {
                if (s.pointer_to_raw_data !== undefined && s.size_of_raw_data > 0) {
                    regions.push({
                        label: `Section ${s.name.replace(/\x00/g, '')}`,
                        start: s.pointer_to_raw_data,
                        end: s.pointer_to_raw_data + s.size_of_raw_data - 1,
                        color: getNextColor(),
                        description: `VirtAddr: 0x${s.virtual_address?.toString(16)}`,
                        fields: [
                            { offset: s.pointer_to_raw_data!, size: 0, name: "Name", value: s.name.replace(/\x00/g, ''), type: "STRING" },
                            { offset: s.pointer_to_raw_data!, size: 0, name: "VirtualSize", value: `0x${s.virtual_size?.toString(16)}`, type: "DWORD" },
                            { offset: s.pointer_to_raw_data!, size: 0, name: "VirtualAddress", value: `0x${s.virtual_address?.toString(16)}`, type: "DWORD" },
                            { offset: s.pointer_to_raw_data!, size: 0, name: "SizeOfRawData", value: `0x${s.size_of_raw_data?.toString(16)}`, type: "DWORD" },
                            { offset: s.pointer_to_raw_data!, size: 0, name: "PointerToRawData", value: `0x${s.pointer_to_raw_data?.toString(16)}`, type: "DWORD" },
                            { offset: s.pointer_to_raw_data!, size: 0, name: "Characteristics", value: `0x${s.characteristics?.toString(16)}`, type: "DWORD" }
                        ]
                    });
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // 2. ELF Format
    // -------------------------------------------------------------------------
    else if (parsed.format === "ELF" && parsed.header) {
        // ELF Header
        // 32-bit: 52 bytes, 64-bit: 64 bytes. 
        // Checked via bits: { value: 2, label: "B64" }
        const is64 = parsed.bits?.label === "B64" || parsed.bits?.value === 2;
        const headerSize = is64 ? 64 : 52;

        regions.push({
            label: "ELF Header",
            start: 0,
            end: headerSize - 1,
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            description: `${getLabel(parsed.header.machine)}`,
            fields: [
                { offset: 0, size: 16, name: "e_ident", value: "ELF Magic", type: "BYTE[16]" },
                { offset: 16, size: 2, name: "e_type", value: getLabel(parsed.header.e_type), type: "HALF" },
                { offset: 18, size: 2, name: "e_machine", value: getLabel(parsed.header.machine), type: "HALF" },
                { offset: 20, size: 4, name: "e_version", value: `${parsed.header.version || 1}`, type: "WORD" },
                { offset: 24, size: is64 ? 8 : 4, name: "e_entry", value: `0x${parsed.header.entry_point?.toString(16)}`, type: is64 ? "ADDR64" : "ADDR32" },
                { offset: is64 ? 32 : 28, size: is64 ? 8 : 4, name: "e_phoff", value: `0x${parsed.header.program_headers && parsed.header.program_headers.length > 0 ? parsed.header.program_headers[0].offset.toString(16) : '0'}`, type: is64 ? "OFF64" : "OFF32" },
                { offset: is64 ? 40 : 32, size: is64 ? 8 : 4, name: "e_shoff", value: `0x${(parsed.header as any).shoff?.toString(16) || '0'}`, type: is64 ? "OFF64" : "OFF32" },
                { offset: is64 ? 48 : 36, size: 4, name: "e_flags", value: `0x${(parsed.header as any).flags?.toString(16) || '0'}`, type: "WORD" },
                { offset: is64 ? 52 : 40, size: 2, name: "e_ehsize", value: `${(parsed.header as any).ehsize || headerSize}`, type: "HALF" },
                { offset: is64 ? 54 : 42, size: 2, name: "e_phentsize", value: `${(parsed.header as any).phentsize || 0}`, type: "HALF" },
                { offset: is64 ? 56 : 44, size: 2, name: "e_phnum", value: `${(parsed.header as any).phnum || parsed.header.program_headers?.length || 0}`, type: "HALF" },
                { offset: is64 ? 58 : 46, size: 2, name: "e_shentsize", value: `${(parsed.header as any).shentsize || 0}`, type: "HALF" },
                { offset: is64 ? 60 : 48, size: 2, name: "e_shnum", value: `${(parsed.header as any).shnum || parsed.header.section_headers?.length || 0}`, type: "HALF" },
                { offset: is64 ? 62 : 50, size: 2, name: "e_shstrndx", value: `${(parsed.header as any).shstrndx || 0}`, type: "HALF" }
            ]
        });

        // Program Headers (Segments)
        if (parsed.header.program_headers) {
            parsed.header.program_headers.forEach((ph, idx) => {
                // Ensure it occupies file space
                if (ph.filesz > 0 && ph.offset !== undefined) {
                    regions.push({
                        label: `Segment ${idx} (${getLabel(ph.type)})`,
                        start: ph.offset,
                        end: ph.offset + ph.filesz - 1,
                        color: getNextColor(),
                        description: `Flags: ${ph.flags}`,
                        fields: [
                            { offset: ph.offset, size: 4, name: "p_type", value: getLabel(ph.type), type: "WORD" },
                            { offset: ph.offset, size: 0, name: "p_vaddr", value: `0x${ph.vaddr?.toString(16)}`, type: is64 ? "ADDR64" : "ADDR32" },
                            { offset: ph.offset, size: 0, name: "p_filesz", value: `0x${ph.filesz?.toString(16)}`, type: is64 ? "XWORD" : "WORD" },
                            { offset: ph.offset, size: 0, name: "p_memsz", value: `0x${ph.memsz?.toString(16)}`, type: is64 ? "XWORD" : "WORD" },
                            { offset: ph.offset, size: 0, name: "p_flags", value: `0x${ph.flags?.toString(16)}`, type: "WORD" }
                        ]
                    });
                }
            });
        }

        // Section Headers
        // NOTE: The example structure shows section headers with 'addr' and 'size', 
        // but typically valid Sections in file have an offset. 
        // If 'offset' is missing in JSON, we might fallback to checking if addr looks like an offset (only for non-alloc sections?), 
        // but for now, we'll check for 'offset' field if it exists in data, or skip visual highlighting if no file mapping is certain.
        if (parsed.header.section_headers) {
            parsed.header.section_headers.forEach((sh, idx) => {
                // Try to find file offset. Some parsers map 'offset' field, 'sh_offset', or 'addr' if it's not a VMA.
                // In the user's example, 'offset' is MISSING in section_headers, only 'addr' is there.
                // However, for PROGBITS, addr usually maps to offset in simple binaries or we can't map it without segment mapping.
                // We will verify if 'offset' exists type-safely.
                const fileOffset = sh.offset || sh['sh_offset'];

                if (fileOffset !== undefined && sh.size && sh.size > 0) {
                    regions.push({
                        label: `Section ${sh.name || idx}`,
                        start: fileOffset,
                        end: fileOffset + sh.size - 1,
                        color: getNextColor(),
                        description: `${getLabel(sh.type)}`
                    });
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // 3. MACH-O Format
    // -------------------------------------------------------------------------
    else if (parsed.format === "MACH_O" && parsed.header) {
        // Mach-O Header
        // 32-bit (0xFEEDFACE) = 28 bytes
        // 64-bit (0xFEEDFACF) = 32 bytes
        // checking magic string or number
        // example: magic: "..." (string?) or number? user example says magic: "..."
        // let's rely on cputype for 64-bit check or sizeofcmds relative?
        // Actually, just assumed 32 bytes if 64-bit arch in cputype? 
        // X86_64 label exists in example.

        const is64 = parsed.header.cputype?.label?.includes("64");
        const headerSize = is64 ? 32 : 28;

        regions.push({
            label: "Mach-O Header",
            start: 0,
            end: headerSize - 1,
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            description: `${getLabel(parsed.header.cputype)}`,
            fields: [
                { offset: 0, size: 4, name: "magic", value: `0x${parsed.header.magic?.toString(16)}`, type: "DWORD" },
                { offset: 4, size: 4, name: "cputype", value: getLabel(parsed.header.cputype), type: "DWORD" },
                { offset: 8, size: 4, name: "cpusubtype", value: getLabel(parsed.header.cpusubtype), type: "DWORD" },
                { offset: 12, size: 4, name: "filetype", value: getLabel(parsed.header.filetype), type: "DWORD" },
                { offset: 16, size: 4, name: "ncmds", value: `${parsed.header.ncmds}`, type: "DWORD" },
                { offset: 20, size: 4, name: "sizeofcmds", value: `${parsed.header.sizeofcmds}`, type: "DWORD" },
                { offset: 24, size: 4, name: "flags", value: `0x${parsed.header.flags?.toString(16)}`, type: "DWORD" }
            ]
        });

        // Load Commands
        // They follow immediately after header.
        if (parsed.load_commands) {
            let currentOffset = headerSize;
            parsed.load_commands.forEach((lc, idx) => {
                if (lc.size > 0) {
                    regions.push({
                        label: `Load Command ${idx}: ${getLabel(lc.type)}`,
                        start: currentOffset,
                        end: currentOffset + lc.size - 1,
                        color: getNextColor(),
                        description: `Size: ${lc.size}`,
                        fields: [
                            { offset: currentOffset, size: 4, name: "cmd", value: getLabel(lc.type), type: "DWORD" },
                            { offset: currentOffset + 4, size: 4, name: "cmdsize", value: `${lc.size}`, type: "DWORD" },
                            // Custom body fields?
                            ...(lc.body ? Object.entries(lc.body).map(([k, v], i) => ({
                                offset: currentOffset + 8, // Approximate
                                size: 0,
                                name: k,
                                value: String(v),
                                type: "VAR"
                            })) : [])
                        ]
                    });

                    // Special Handling for Segments to highlight their data?
                    // if lc.type is SEGMENT, it has vmaddr, vmsize, but also 'fileoff' and 'filesize' usually?
                    // User example: { body: { segname: "__PAGEZERO", vmaddr: 0, vmsize... } }
                    // Does it have fileoff?
                    if (lc.body && (lc.body.fileoff || lc.body.filesize)) {
                        const foff = lc.body.fileoff || 0;
                        const fsize = lc.body.filesize || 0;
                        if (fsize > 0) {
                            regions.push({
                                label: `Segment ${lc.body.segname || ''}`,
                                start: foff,
                                end: foff + fsize - 1,
                                color: getNextColor(),
                                description: `Segment Data`
                            });
                        }
                    }

                    currentOffset += lc.size;
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // 4. DEX Format
    // -------------------------------------------------------------------------
    else if (parsed.format === "DEX" && parsed.header) {
        // Header
        const headerSize = parsed.header.header_size || 0x70;
        regions.push({
            label: "DEX Header",
            start: 0,
            end: headerSize - 1,
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            description: `Size: ${parsed.header.file_size}`,
            fields: [
                { offset: 0, size: 8, name: "magic", value: "dex\\n035\\0", type: "UBYTE[8]" },
                { offset: 8, size: 4, name: "checksum", value: `0x${parsed.header.checksum?.toString(16)}`, type: "UINT" },
                { offset: 32, size: 4, name: "file_size", value: `${parsed.header.file_size}`, type: "UINT" },
                { offset: 36, size: 4, name: "header_size", value: `${parsed.header.header_size}`, type: "UINT" },
                { offset: 40, size: 4, name: "endian_tag", value: `0x${parsed.header.endian_tag?.toString(16)}`, type: "UINT" }
            ]
        });

        // Map List / Tables
        const mapTables = [
            { key: 'string_ids', label: 'String IDs' },
            { key: 'type_ids', label: 'Type IDs' },
            { key: 'proto_ids', label: 'Proto IDs' },
            { key: 'field_ids', label: 'Field IDs' },
            { key: 'method_ids', label: 'Method IDs' },
            { key: 'class_defs', label: 'Class Defs' }
        ];

        // Item sizes in bytes
        const sizes: Record<string, number> = {
            'string_ids': 4,
            'type_ids': 4,
            'proto_ids': 12,
            'field_ids': 8,
            'method_ids': 8,
            'class_defs': 32
        };

        mapTables.forEach(tbl => {
            const off = parsed.header[`${tbl.key}_off`];
            const size = parsed.header[`${tbl.key}_size`];

            if (off !== undefined && size !== undefined && size > 0) {
                const byteSize = size * (sizes[tbl.key] || 0);
                if (byteSize > 0) {
                    regions.push({
                        label: tbl.label,
                        start: off,
                        end: off + byteSize - 1,
                        color: getNextColor(),
                        description: `Count: ${size}`
                    });
                }
            }
        });

        // Data Section
        if (parsed.header.data_off && parsed.header.data_size) {
            regions.push({
                label: "Data Section",
                start: parsed.header.data_off,
                end: parsed.header.data_off + parsed.header.data_size - 1,
                color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                description: "Mixed Data"
            });
        }
    }


    // Sort regions by start offset
    regions.sort((a, b) => a.start - b.start);

    // Prevent overlaps? Or just let them overlap (last one wins in rendering usually, or mix?)
    // HexViewer logic handles finding *first* match currently? 
    // "regions.find" finds first. 
    // We might want smallest regions first if nested? 
    // Sort by size (smallest first) within same start?
    // For now, simple start sort is standard.

    return regions;
}

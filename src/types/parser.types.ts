// Helper for Enum Fields
export type EnumField = { value: number; label: string } | number;

export interface ParserResponse {
    success: boolean;
    sha256: string;
    file_type: string;
    parsed: ParsedData;
}

export interface ParsedData {
    format: string; // "PE", "ELF", "MACH_O", "DEX"

    // PE Fields
    mz?: {
        lz?: string;
        ofs_pe?: number; // Offset to PE Header (e_lfanew)
        e_lfanew?: number; // legacy support
        [key: string]: any;
    };
    pe_signature?: number[];
    coff_hdr?: COFFHeader;
    optional_hdr?: OptionalHeader;
    sections?: Section[]; // PE Sections

    // ELF Fields
    magic?: number[];
    bits?: EnumField;
    endian?: EnumField;
    header?: ELFHeader; // Contains program_headers and section_headers

    // MACH-O Fields
    // mach_header is inside 'header' property in user example? 
    // "header": { cputype... }
    // but root also has "load_commands"
    // User example:
    /*
      "header": { "cputype": ... },
      "load_commands": [ ... ]
    */
    // So for Mach-O, 'header' is the MachHeader
    load_commands?: LoadCommand[];

    // DEX Fields
    // "header": { ... } (DEX header)
    // "string_ids": [ ... ]
    string_ids?: any[];
    type_ids?: any[];
    proto_ids?: any[];
    field_ids?: any[];
    method_ids?: any[];
    class_defs?: any[];

    // General
    [key: string]: any;
}

// PE Interfaces
export interface COFFHeader {
    machine: EnumField;
    number_of_sections: number;
    time_date_stamp?: number;
    pointer_to_symbol_table?: number;
    number_of_symbols?: number;
    size_of_optional_header: number;
    characteristics: any;
    [key: string]: any;
}

export interface OptionalHeader {
    magic: EnumField;
    entry_point?: number;
    address_of_entry_point?: number; // PE specific
    image_base: number;
    subsystem: EnumField;
    [key: string]: any;
}

export interface Section {
    name: string;
    virtual_size?: number;
    virtual_address?: number;
    size_of_raw_data?: number; // PE
    pointer_to_raw_data?: number; // PE

    // ELF Section Fields (inside header.section_headers)
    name_offset?: number;
    type?: EnumField;
    flags?: number | EnumField;
    addr?: number; // ELF virtual address
    offset?: number; // ELF file offset
    size?: number; // ELF section size

    [key: string]: any;
}

// ELF Interfaces
export interface ELFHeader {
    e_type?: EnumField;
    machine?: EnumField;
    version?: number;
    entry_point?: number;
    phoff?: number; // Program header offset
    shoff?: number; // Section header offset
    flags?: number;
    ehsize?: number;
    phentsize?: number;
    phnum?: number;
    shentsize?: number;
    shnum?: number;
    shstrndx?: number;

    program_headers?: ELFProgramHeader[];
    section_headers?: Section[];
    [key: string]: any;
}

export interface ELFProgramHeader {
    type: EnumField;
    flags: number;
    offset: number;
    vaddr: number;
    filesz: number;
    memsz: number;
    [key: string]: any;
}

// Mach-O Interfaces (User example puts this in 'header' property of root)
export interface MachHeader {
    magic?: string | number;
    cputype: EnumField;
    cpusubtype: EnumField;
    filetype: EnumField;
    ncmds: number;
    sizeofcmds: number;
    flags: number;
    [key: string]: any;
}

export interface LoadCommand {
    type: EnumField;
    size: number;
    body?: any;
    [key: string]: any;
}

// DEX Interfaces (User example puts this in 'header' property of root)
export interface DEXHeader {
    magic: number[];
    header_size: number;
    file_size: number;

    string_ids_off: number;
    string_ids_size: number;

    type_ids_off: number;
    type_ids_size: number;

    proto_ids_off: number;
    proto_ids_size: number;

    field_ids_off: number;
    field_ids_size: number;

    method_ids_off: number;
    method_ids_size: number;

    class_defs_off: number;
    class_defs_size: number;

    data_off: number;
    data_size: number;

    [key: string]: any;
}

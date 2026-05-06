export interface HexRegion {
    label: string;
    start: number;
    end: number;
    color: string;
    description?: string;
    onClick?: () => void;
    fields?: HexField[];
}

export interface HexField {
    offset: number;
    size: number;
    name: string;
    value: string;
    type?: string;
}

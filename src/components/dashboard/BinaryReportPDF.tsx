import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { ThreatFile, YaraScanResult } from '@/types/threat.types';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottom: 1,
        borderBottomColor: '#009982',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#009982',
    },
    meta: {
        fontSize: 10,
        color: '#666666',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333333',
        backgroundColor: '#f5f5f5',
        padding: 4,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    label: {
        width: 100,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#555555',
    },
    value: {
        flex: 1,
        fontSize: 10,
        color: '#333333',
        fontFamily: 'Courier',
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 5,
        marginTop: 5,
    },
    badge: {
        fontSize: 8,
        padding: '2 5',
        borderRadius: 3,
        backgroundColor: '#009982',
        color: '#ffffff',
        textTransform: 'uppercase',
    },
    badgeWarning: {
        backgroundColor: '#f59e0b',
    },
    badgeDanger: {
        backgroundColor: '#ef4444',
    },
    iocRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#eeeeee',
        paddingVertical: 4,
        alignItems: 'center',
    },
    iocNum: {
        width: 20,
        fontSize: 8,
        color: '#999999',
    },
    iocText: {
        fontSize: 9,
        fontFamily: 'Courier',
        color: '#333333',
    },
    rulesContainer: {
        marginTop: 5,
    },
    ruleItem: {
        marginBottom: 3,
        padding: '3 6',
        backgroundColor: '#fff5f5',
        borderLeft: 1.5,
        borderLeftColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
    },
    ruleText: {
        fontSize: 7.5,
        fontFamily: 'Courier',
        color: '#ef4444',
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#999999',
        borderTop: 0.5,
        borderTopColor: '#eeeeee',
        paddingTop: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
    },
    gridItem: {
        width: '48%',
        padding: 8,
        backgroundColor: '#f9f9f9',
        borderRadius: 4,
    },
    gridLabel: {
        fontSize: 8,
        color: '#888888',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    gridValue: {
        fontSize: 10,
        color: '#333333',
        fontWeight: 'bold',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        padding: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#dddddd',
    },
    tableRow: {
        flexDirection: 'row',
        padding: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#eeeeee',
    },
    tableCell: {
        fontSize: 8,
        color: '#444444',
    },
    vtMalicious: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
    vtClean: {
        color: '#10b981',
    }
});

interface BinaryReportPDFProps {
    file: ThreatFile;
    scanResult: YaraScanResult | null;
    vtData?: any;
    vtBehaviour?: any;
    parserData?: any;
}

export const BinaryReportPDF = ({ file, scanResult, vtData, vtBehaviour, parserData }: BinaryReportPDFProps) => {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    return (
        <Document title={`Axalote_Report_${file.filename}`}>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 30, height: 30, backgroundColor: '#009982', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>A</Text>
                        </View>
                        <View>
                            <Text style={styles.title}>AXALOTE</Text>
                            <Text style={{ fontSize: 10, color: '#009982', fontWeight: 'bold' }}></Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.meta}>Report ID: {file.metadata.sha256.substring(0, 12)}</Text>
                        <Text style={styles.meta}>Generated: {date} {time}</Text>
                    </View>
                </View>

                {/* Main Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Artifact Identity</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Filename:</Text>
                        <Text style={styles.value}>{file.filename || "Unknown Object"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Description:</Text>
                        <Text style={styles.value}>{file.description || "No description provided"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Classification:</Text>
                        <Text style={styles.value}>{file.family || "Unclassified"}</Text>
                    </View>
                    {file.tags && file.tags.length > 0 && (
                        <View style={styles.badgeContainer}>
                            {file.tags.map((tag, i) => (
                                <Text key={i} style={styles.badge}>{tag}</Text>
                            ))}
                        </View>
                    )}
                </View>

                {/* Fingerprints */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Fingerprints</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>MD5:</Text>
                        <Text style={styles.value}>{file.metadata.md5}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>SHA1:</Text>
                        <Text style={styles.value}>{file.metadata.sha1}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>SHA256:</Text>
                        <Text style={styles.value}>{file.metadata.sha256}</Text>
                    </View>
                </View>

                {/* Properties */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Physical Properties</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Size:</Text>
                        <Text style={styles.value}>
                            {file.metadata.size < 1024
                                ? `${file.metadata.size} B`
                                : (file.metadata.size / 1024).toFixed(2) + ' KB'}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Entropy:</Text>
                        <Text style={[styles.value, file.metadata.entropy > 7 ? { color: '#ef4444' } : {}]}>
                            {file.metadata.entropy.toFixed(4)}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>MIME Type:</Text>
                        <Text style={styles.value}>{file.metadata.mime_type}</Text>
                    </View>
                </View>

                {/* Yara Analysis */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Yara Analysis</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Match Status:</Text>
                        <Text style={[styles.value, scanResult?.match ? { color: '#ef4444', fontWeight: 'bold' } : { color: '#10b981', fontWeight: 'bold' }]}>
                            {scanResult?.match ? "THREAT DETECTED" : "CLEAN"}
                        </Text>
                    </View>

                    {scanResult?.match && scanResult.rules.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 6, color: '#666666', textTransform: 'uppercase' }}>
                                Matched Rules ({scanResult.rules.length}):
                            </Text>
                            <View style={styles.rulesContainer}>
                                {scanResult.rules.map((rule, idx) => {
                                    const ruleName = typeof rule === 'string' ? rule : (rule as any).identifier || 'Unknown';
                                    return (
                                        <View key={idx} style={styles.ruleItem} wrap={false}>
                                            <Text style={styles.ruleText}>{ruleName}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Yara Diagnostics / Logs */}
                    {(scanResult?.warnings?.length || 0) > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase' }}>Scan Warnings:</Text>
                            {scanResult?.warnings?.map((w, i) => (
                                <Text key={i} style={[styles.value, { fontSize: 8, color: '#92400e' }]}>• {w.message}</Text>
                            ))}
                        </View>
                    )}

                    {(scanResult?.logs?.length || 0) > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#666666', textTransform: 'uppercase' }}>Engine Logs:</Text>
                            {scanResult?.logs?.map((log, i) => (
                                <Text key={i} style={[styles.value, { fontSize: 7, fontFamily: 'Courier', color: '#666666' }]}>{log}</Text>
                            ))}
                        </View>
                    )}
                </View>

                {/* Analysis Highlights */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Analysis Highlights</Text>
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <Text style={styles.gridLabel}>Packer Detection</Text>
                            <Text style={[styles.gridValue, file.is_packed ? { color: '#f59e0b' } : {}]}>
                                {file.is_packed ? `PACKED (${file.packer || 'Generic'})` : 'NOT PACKED'}
                            </Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text style={styles.gridLabel}>Reputation Score</Text>
                            <Text style={[styles.gridValue, vtData?.reputation < 0 ? { color: '#ef4444' } : { color: '#10b981' }]}>
                                {vtData?.reputation || 'N/A'}
                            </Text>
                        </View>
                        {vtData?.last_analysis_stats && (
                            <View style={styles.gridItem}>
                                <Text style={styles.gridLabel}>Malicious Verdicts</Text>
                                <Text style={[styles.gridValue, vtData.last_analysis_stats.malicious > 0 ? styles.vtMalicious : styles.vtClean]}>
                                    {vtData.last_analysis_stats.malicious} / {Object.keys(vtData.last_analysis_results || {}).length}
                                </Text>
                            </View>
                        )}
                        <View style={styles.gridItem}>
                            <Text style={styles.gridLabel}>Source</Text>
                            <Text style={styles.gridValue}>{file.is_dropped ? 'Dropped Artifact' : 'Original Submission'}</Text>
                        </View>
                    </View>
                </View>

                {/* VirusTotal Details (If available) */}
                {vtData && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>VirusTotal Intelligence</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Threat Label:</Text>
                            <Text style={[styles.value, { color: '#ef4444', fontWeight: 'bold' }]}>
                                {vtData.popular_threat_classification?.suggested_threat_label || "No common label"}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Categories:</Text>
                            <Text style={styles.value}>
                                {vtData.popular_threat_classification?.popular_threat_category?.map((c: any) => c.value).join(', ') || "N/A"}
                            </Text>
                        </View>
                        
                        {/* Summary of top AV engines */}
                        <View style={{ marginTop: 8 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>Engine</Text>
                                <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold' }]}>Result</Text>
                            </View>
                            {Object.entries(vtData.last_analysis_results || {})
                                .filter(([_, result]: [string, any]) => result.category === 'malicious')
                                .slice(0, 10)
                                .map(([name, result]: [string, any], i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 1 }]}>{name}</Text>
                                        <Text style={[styles.tableCell, { width: 100, color: '#ef4444' }]}>{result.result}</Text>
                                    </View>
                                ))}
                        </View>
                    </View>
                )}

                {/* Static Analysis / Parser Structure */}
                {parserData && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Structural Analysis (Static)</Text>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>Field / Section</Text>
                            <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>Value / Description</Text>
                        </View>
                        {Object.entries(parserData)
                            .filter(([key]) => !['raw', 'full'].includes(key))
                            .slice(0, 15)
                            .map(([key, value], i) => (
                                <View key={i} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>{key}</Text>
                                    <Text style={[styles.tableCell, { flex: 2 }]}>
                                        {typeof value === 'object' ? JSON.stringify(value).substring(0, 80) : String(value)}
                                    </Text>
                                </View>
                            ))}
                    </View>
                )}

                {/* Indicators */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Threat Indicators (IOCs)</Text>
                    {file.iocs && file.iocs.length > 0 ? (
                        file.iocs.slice(0, 30).map((ioc, idx) => (
                            <View key={idx} style={styles.iocRow}>
                                <Text style={styles.iocNum}>{(idx + 1).toString().padStart(2, '0')}</Text>
                                <Text style={styles.iocText}>{ioc}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={{ fontSize: 10, color: '#999999', fontStyle: 'italic' }}>No indicators identified.</Text>
                    )}
                </View>

                {/* Dropped Files / Children */}
                {file.children && file.children.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Child Artifacts ({file.children.length})</Text>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>Filename</Text>
                            <Text style={[styles.tableCell, { width: 150, fontWeight: 'bold' }]}>SHA256</Text>
                        </View>
                        {file.children.map((child, i) => (
                            <View key={i} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 1 }]}>{child.filename}</Text>
                                <Text style={[styles.tableCell, { width: 150, fontFamily: 'Courier' }]}>{child.metadata.sha256.substring(0, 20)}...</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    This document is an automated intelligence report generated by AXALOTE Threat Lab.
                    Copyright © {new Date().getFullYear()} AXALOTE. All rights reserved.
                </Text>
            </Page>
        </Document>
    );
};

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

Font.register({
  family: 'Rubik',
  src: '/fonts/Rubik-Regular.ttf', 
});

const styles = StyleSheet.create({
  page: { fontFamily: 'Rubik', padding: 20, backgroundColor: '#ffffff', paddingBottom: 40 },
  
  headerBox: { backgroundColor: '#1e1b4b', padding: 15, borderRadius: 8, marginBottom: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 40, height: 40, objectFit: 'contain' },
  titleBox: { alignItems: 'center', flex: 1 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { color: '#818cf8', fontSize: 14 },
  
  tableHeader: { flexDirection: 'row-reverse', backgroundColor: '#e2e8f0', borderBottomWidth: 2, borderBottomColor: '#94a3b8', alignItems: 'stretch' },
  tableRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'stretch' },
  tableRowZebra: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'stretch', backgroundColor: '#f8fafc' },
  
  rankCol: { width: '10%', textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#64748b', paddingVertical: 10 },
  nameCol: { width: '25%', textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: '#0f172a', paddingVertical: 10, paddingRight: 8, borderLeftWidth: 1, borderLeftColor: '#cbd5e1' },
  
  // עמודות משחקים מוגדרות מראש למניעת Inline styles
  matchCol1: { width: '65%', borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  matchCol2: { width: '32.5%', borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  matchCol3: { width: '21.6%', borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  matchCol4: { width: '16.25%', borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  matchCol5: { width: '13%', borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  matchColFallback: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#cbd5e1', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  
  headerText: { fontSize: 10, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  timeText: { fontSize: 9, fontWeight: 'bold', color: '#64748b', textAlign: 'center', marginTop: 2 },
  cellText: { fontSize: 11, color: '#334155', textAlign: 'center', fontWeight: 'bold' },
  
  footer: { position: 'absolute', bottom: 15, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#94a3b8' }
});

const r = (text: any) => {
  if (text === undefined || text === null) return "";
  let str = String(text);
  str = str.replace(/[^\u0590-\u05FFa-zA-Z0-9\s.,!'":;()\-]/g, '').trim();
  return str;
};

interface DailyMatrixProps {
  dateStr: string;
  matches: { id: string; home: string; away: string; time: string }[];
  rows: { rank: number; name: string; totalPoints: number; predictions: Record<string, string> }[];
}

export const DailyMatrixPDF = ({ dateStr, matches, rows }: DailyMatrixProps) => {
  const timestamp = new Date().toLocaleString('he-IL');
  
  // בחירת סגנון העמודה בצורה קשיחה (ללא Inline styles)
  const getColStyle = () => {
    if (matches.length === 1) return styles.matchCol1;
    if (matches.length === 2) return styles.matchCol2;
    if (matches.length === 3) return styles.matchCol3;
    if (matches.length === 4) return styles.matchCol4;
    if (matches.length === 5) return styles.matchCol5;
    return styles.matchColFallback;
  };
  const colStyle = getColStyle();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        <View fixed>
          <View style={styles.headerBox}>
            <View style={styles.headerTop}>
              <Image src="/icon-512.png" style={styles.logo} />
              <View style={styles.titleBox}>
                <Text style={styles.title}>{r("מטריצת ניחושים יומית")}</Text>
                <Text style={styles.subtitle}>{r(`משחקי היום: ${dateStr}`)}</Text>
              </View>
              <Image src="/worldcup-bg1.png" style={styles.logo} />
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.rankCol}>{r("מקום")}</Text>
            <Text style={styles.nameCol}>{r("שחקן")}</Text>
            {matches.map((m, idx) => (
              <View key={idx} style={colStyle}>
                <Text style={styles.headerText}>{r(`${m.home} - ${m.away}`)}</Text>
                <Text style={styles.timeText}>{m.time}</Text>
              </View>
            ))}
          </View>
        </View>

        {rows.map((row, idx) => (
          <View key={idx} style={idx % 2 !== 0 ? styles.tableRowZebra : styles.tableRow} wrap={false}>
            <Text style={styles.rankCol}>{row.rank}</Text>
            <Text style={styles.nameCol}>{r(row.name)}</Text>
            {matches.map((m, mIdx) => (
              <View key={mIdx} style={colStyle}>
                <Text style={styles.cellText}>{row.predictions[m.id] || "X"}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {r(`הופק אוטומטית ממערכת Bets in PROD | ${timestamp}`)}
        </Text>

      </Page>
    </Document>
  );
};
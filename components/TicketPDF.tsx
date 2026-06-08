import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

Font.register({
  family: 'Rubik',
  src: '/fonts/Rubik-Regular.ttf', 
});

const styles = StyleSheet.create({
  page: { fontFamily: 'Rubik', padding: 30, backgroundColor: '#ffffff' },
  headerBox: { backgroundColor: '#1e1b4b', padding: 15, borderRadius: 8, marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  logo: { width: 45, height: 45, objectFit: 'contain' },
  headerTextContainer: { alignItems: 'center', flex: 1 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { color: '#818cf8', fontSize: 14 },
  
  headerBottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 5 },
  headerBottomText: { color: '#ffffff', fontSize: 10, opacity: 0.8 },
  headerBottomDivider: { color: '#ffffff', fontSize: 10, opacity: 0.8, marginHorizontal: 8 },
  
  sectionContainer: { marginBottom: 15 },
  groupsSection: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 5, marginBottom: 10, marginTop: 15, textAlign: 'right', color: '#1e293b', fontWeight: 'bold' },
  
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  matchRowZebra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  
  teamText: { fontSize: 14, flex: 1, textAlign: 'center' },
  scoreCenter: { alignItems: 'center', flex: 1 },
  dateText: { fontSize: 9, color: '#64748b', marginBottom: 3, textAlign: 'center' },
  scoreBox: { backgroundColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  scoreText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },

  groupsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  groupCard: { width: '31%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 6, marginBottom: 12 },
  groupHeader: { fontSize: 12, fontWeight: 'bold', color: '#1e40af', textAlign: 'center', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 4 },
  teamBox: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 4, marginBottom: 4 },
  teamTextLabel: { fontSize: 8, color: '#64748b', textAlign: 'right', marginBottom: 2 },
  teamTextName: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },

  thirdPlaceContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5 },
  thirdPlaceBadge: { backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, margin: 3 },
  thirdPlaceText: { fontSize: 11, color: '#9f1239', fontWeight: 'bold' },
  
  bonusTable: { width: '100%', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' },
  bonusHeaderRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  
  bonusHeaderTextCenter: { fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center', width: '15%' },
  bonusHeaderTextRight1: { fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'right', width: '35%' },
  bonusHeaderTextRight2: { fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'right', width: '50%', paddingRight: 10 },
  
  bonusRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  bonusRowZebra: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  
  bonusColPts: { width: '15%', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  bonusColAns: { width: '35%', textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: '#0f172a', paddingRight: 10 },
  bonusColQ: { width: '50%', textAlign: 'right', fontSize: 11, color: '#334155', paddingRight: 10 },

  footerBox: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 15, alignItems: 'center' },
  footerText: { fontSize: 10, color: '#64748b', marginBottom: 10 },
  barcodeContainer: { flexDirection: 'row', height: 40, justifyContent: 'center' },
  
  // הברקודים הוגדרו מראש! אין יותר Inline styles
  bc1: { backgroundColor: '#0f172a', marginRight: 1.5, width: 1 },
  bc2: { backgroundColor: '#0f172a', marginRight: 1.5, width: 2 },
  bc3: { backgroundColor: '#0f172a', marginRight: 1.5, width: 3 },
  bc4: { backgroundColor: '#0f172a', marginRight: 1.5, width: 4 }
});

const r = (text: any) => {
  if (text === undefined || text === null) return "";
  let str = String(text);
  str = str.replace(/[^\u0590-\u05FFa-zA-Z0-9\s.,!'":;()\-]/g, '').trim();
  str = str.replace(/\?/g, ''); 
  return str;
};

interface TicketPDFProps {
  userName: string;
  stageName: string;
  matches: { home: string; away: string; homeScore: number; awayScore: number; dateTime: string; roundLabel?: string }[];
  qualifiers: { group: string; first: string; second: string }[];
  thirdPlace: string[];
  bonuses: { question: string; answer: string; points: number }[];
}

export const TicketPDF = ({ userName, stageName, matches = [], qualifiers = [], thirdPlace = [], bonuses = [] }: TicketPDFProps) => {
  const ticketId = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${new Date().getFullYear()}`;
  const timestamp = new Date().toLocaleString('he-IL');
  const barcodeWidths = [2, 1, 3, 1, 1, 4, 2, 1, 2, 3, 1, 1, 2, 2, 1, 4, 1, 2];

  const sortedMatches = [...matches].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  
  const formatDateTime = (isoString: string) => {
    try {
      const dateObj = new Date(isoString);
      if (isNaN(dateObj.getTime())) return "";
      return dateObj.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        <View style={styles.headerBox} wrap={false}>
          <View style={styles.headerTop}>
            <Image src="/icon-512.png" style={styles.logo} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{r("טופס ניחושים רשמי")}</Text>
              <Text style={styles.subtitle}>{r(`Bets in PROD - ${stageName}`)}</Text>
            </View>
            <Image src="/worldcup-bg1.png" style={styles.logo} />
          </View>
          
          <View style={styles.headerBottomRow}>
            <Text style={styles.headerBottomText}>{r(`הופק: ${timestamp}`)}</Text>
            <Text style={styles.headerBottomDivider}>|</Text>
            <Text style={styles.headerBottomText}>{r(`טופס: ${ticketId}`)}</Text>
            <Text style={styles.headerBottomDivider}>|</Text>
            <Text style={styles.headerBottomText}>{r(`שחקן: ${userName}`)}</Text>
          </View>
        </View>

        {sortedMatches.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{r("משחקים")}</Text>
            {sortedMatches.map((match, index) => (
                <View key={index} style={index % 2 !== 0 ? styles.matchRowZebra : styles.matchRow}>
                
                {/* 1. קבוצת החוץ תהיה בצד שמאל */}
                <Text style={styles.teamText}>{r(match.away)}</Text>
                
                <View style={styles.scoreCenter}>
                  <Text style={styles.dateText}>
                    {match.roundLabel ? `${r(match.roundLabel)}\n` : ""}{formatDateTime(match.dateTime)}
                  </Text>
                  <View style={styles.scoreBox}>
                    {/* 2. תוצאת החוץ משמאל, תוצאת הבית מימין! */}
                    <Text style={styles.scoreText}>{`${match.awayScore} - ${match.homeScore}`}</Text>
                  </View>
                </View>
                
                {/* 3. קבוצת הבית תהיה בצד ימין (הכי אחרונה בקוד = הכי ימינה ב-PDF) */}
                <Text style={styles.teamText}>{r(match.home)}</Text>

              </View>
            ))}
          </View>
        ) : null}

        {qualifiers.length > 0 ? (
          <View style={styles.groupsSection} wrap={false}>
            <Text style={styles.sectionTitle}>{r("עולות מהבתים")}</Text>
            <View style={styles.groupsContainer}>
              {qualifiers.map((q, idx) => (
                <View key={idx} style={styles.groupCard}>
                  <Text style={styles.groupHeader}>{r(`בית ${q.group}`)}</Text>
                  <View style={styles.teamBox}>
                    <Text style={styles.teamTextLabel}>{r("מקום 1")}</Text>
                    <Text style={styles.teamTextName}>{r(q.first)}</Text>
                  </View>
                  <View style={styles.teamBox}>
                    <Text style={styles.teamTextLabel}>{r("מקום 2")}</Text>
                    <Text style={styles.teamTextName}>{r(q.second)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {thirdPlace.length > 0 ? (
          <View style={styles.sectionContainer} wrap={false}>
            <Text style={styles.sectionTitle}>{r("המעפילות מהמקום ה-3")}</Text>
            <View style={styles.thirdPlaceContainer}>
              {thirdPlace.map((team, idx) => (
                <View key={idx} style={styles.thirdPlaceBadge}>
                  <Text style={styles.thirdPlaceText}>{r(team)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {bonuses.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{r("שאלות בונוס")}</Text>
            <View style={styles.bonusTable}>
              <View style={styles.bonusHeaderRow}>
                <Text style={styles.bonusHeaderTextCenter}>{r("ניקוד")}</Text>
                <Text style={styles.bonusHeaderTextRight1}>{r("הניחוש שלך")}</Text>
                <Text style={styles.bonusHeaderTextRight2}>{r("השאלה")}</Text>
              </View>
              
              {[...bonuses]
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .map((bonus, idx) => (
                <View key={idx} style={idx % 2 !== 0 ? styles.bonusRowZebra : styles.bonusRow} wrap={false}>
                  <Text style={styles.bonusColPts}>{bonus.points > 0 ? `+${bonus.points}` : "-"}</Text>
                  <Text style={styles.bonusColAns}>{r(bonus.answer)}</Text>
                  <Text style={styles.bonusColQ}>{r(bonus.question)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footerBox} wrap={false}>
          <Text style={styles.footerText}>{r("הטופס ננעל והוזן למערכת בהצלחה. ט.ל.ח")}</Text>
          <View style={styles.barcodeContainer}>
            {barcodeWidths.map((w, i) => (
              <View key={i} style={styles[`bc${w}` as keyof typeof styles]} />
            ))}
          </View>
        </View>

      </Page>
    </Document>
  );
};
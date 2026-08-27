import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Certification } from './database.types';
import { dictionaries } from './i18n/dictionaries';
import { Lang } from './i18n/config';

// Certificate PDF template — one page per product. Renders server-side
// via @react-pdf/renderer in app/api/certificates/generate/route.tsx.
// Fully translated: pass `lang` to render the certificate itself in the
// client's chosen language.

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  border: {
    borderWidth: 3,
    borderColor: '#1a5f7a',
    padding: 40,
    height: '100%',
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#1a5f7a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 20,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#dde9f0',
    marginVertical: 20,
  },
  certTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 30,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  bodyText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  productName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1a5f7a',
    marginVertical: 16,
  },
  detailsGrid: {
    marginTop: 30,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 11,
    color: '#1a1a1a',
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 9,
    color: '#999',
    marginBottom: 4,
  },
  sealBox: {
    marginTop: 20,
    alignItems: 'center',
  },
  sealText: {
    fontSize: 10,
    color: '#1a5f7a',
    fontFamily: 'Helvetica-Bold',
  },
});

const LOCALE_MAP: Record<Lang, string> = { es: 'es-ES', en: 'en-US', pt: 'pt-BR' };

export function CertificatePDF({
  certifications,
  companyName,
  lang = 'en',
}: {
  certifications: Certification[];
  companyName: string;
  lang?: Lang;
}) {
  const t = dictionaries[lang].certificate;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return t.notAvailable;
    return new Date(dateStr).toLocaleDateString(LOCALE_MAP[lang], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <Document>
      {certifications.map((cert) => (
        <Page key={cert.id} size="LETTER" style={styles.page}>
          <View style={styles.border}>
            <View style={styles.header}>
              <Text style={styles.companyName}>Latin America Kosher</Text>
              <Text style={styles.subtitle}>{t.authority}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.certTitle}>{t.title}</Text>

            <Text style={styles.bodyText}>{t.certifies}</Text>
            <Text style={styles.productName}>{cert.product_name}</Text>
            <Text style={styles.bodyText}>{t.manufacturedBy}</Text>
            <Text style={styles.productName}>{companyName}</Text>
            <Text style={styles.bodyText}>{t.inspectedText}</Text>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.certNumberLabel}</Text>
                <Text style={styles.detailValue}>{cert.certification_number}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.categoryLabel}</Text>
                <Text style={styles.detailValue}>{cert.product_category || t.notAvailable}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.issuedLabel}</Text>
                <Text style={styles.detailValue}>{formatDate(cert.date_issued)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.validUntilLabel}</Text>
                <Text style={styles.detailValue}>{formatDate(cert.expiration_date)}</Text>
              </View>
            </View>

            <View style={styles.sealBox}>
              <Text style={styles.sealText}>{t.sealText}</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t.footerValidNote}</Text>
              <Text style={styles.footerText}>
                {t.footerVerify} · {t.generatedOn} {formatDate(new Date().toISOString())}
              </Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}

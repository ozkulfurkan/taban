import { StyleSheet, Text, View } from 'react-native';

// SoleCost marka işareti: bordo-beyaz "SC" kutusu.
// inverse: bordo zemin üzerinde (beyaz kutu, bordo yazı); değilse bordo kutu, beyaz yazı.
export const BRAND_BORDO = '#6B1A2C';

export function BrandMark({ size = 40, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? '#FFFFFF' : BRAND_BORDO;
  const fg = inverse ? BRAND_BORDO : '#FFFFFF';
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg }]} accessible={false}>
      <Text style={{ color: fg, fontSize: size * 0.4, fontWeight: '800', letterSpacing: 0.5 }}>SC</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center' } });

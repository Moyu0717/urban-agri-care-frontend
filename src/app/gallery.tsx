import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import PersistedPhoto from '../components/PersistedPhoto';
import { Button, Choice, Icon, Page, Pill, ui } from '../components/Ui';
import { useLocalStore } from '../services/storage/LocalStore';
import { effective } from '../services/feedback/corrections';
import { font, theme, type, lineHeight } from '../theme';
import { formatDateTime, formatDate, LOCALE } from '../utils/dates';

type Photo = { id: string; photoUri: string; createdAt: string; plantId?: string; scan?: { id: string; crop: string; condition: string } };

export default function Gallery() {
  const { data } = useLocalStore();
  const [plantId, setPlantId] = useState('all');
  const [open, setOpen] = useState<Photo | null>(null);
  // Journal photos plus the photo of every scan (scans not linked to a plant are listed by crop).
  const all: Photo[] = [
    ...data.journal.filter((entry) => entry.photoUri).map((entry) => ({ id: entry.id, photoUri: entry.photoUri!, createdAt: entry.createdAt, plantId: entry.plantId })),
    ...data.diagnoses.filter((item) => item.photoUri && !data.journal.some((entry) => entry.photoUri === item.photoUri)).map(effective)
      .map((item) => ({ id: item.id, photoUri: item.photoUri!, createdAt: item.createdAt, plantId: item.plantId, scan: { id: item.id, crop: item.crop, condition: item.condition } })),
  ];
  const photos = all.filter((photo) => plantId === 'all' || photo.plantId === plantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const plantName = (id?: string) => data.plants.find((plant) => plant.id === id)?.name ?? 'Plant';
  const tagFor = (photo: Photo) => (photo.plantId ? plantName(photo.plantId) : photo.scan?.crop ?? 'Plant');
  // Group by month, newest first.
  const months: { key: string; label: string; items: Photo[] }[] = [];
  photos.forEach((photo) => {
    const d = new Date(photo.createdAt); const key = `${d.getFullYear()}-${d.getMonth()}`;
    const group = months.find((m) => m.key === key);
    if (group) group.items.push(photo); else months.push({ key, label: d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }), items: [photo] });
  });
  const withPhotos = data.plants.filter((plant) => all.some((photo) => photo.plantId === plant.id));

  return <Page title="Gallery" back>
    {withPhotos.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      <Choice label="All plants" active={plantId === 'all'} icon="images-outline" onPress={() => setPlantId('all')} />
      {withPhotos.map((plant) => <Choice key={plant.id} label={plant.name} active={plantId === plant.id} icon="leaf-outline" onPress={() => setPlantId(plant.id)} />)}
    </ScrollView> : null}
    {months.length ? months.map((month) => <View key={month.key} style={{ marginBottom: 12 }}>
      <Text style={[ui.label, { marginBottom: 10 }]}>{month.label}</Text>
      <View style={s.grid}>{month.items.map((photo) => <Pressable key={photo.id} accessibilityRole="imagebutton" accessibilityLabel={`${tagFor(photo)}, ${formatDate(photo.createdAt)}`} onPress={() => setOpen(photo)} style={({ pressed }) => [s.tile, pressed && { opacity: 0.75 }]}>
        <PersistedPhoto uri={photo.photoUri} height={110} cover />
        {plantId === 'all' ? <View style={s.tag}><Text style={s.tagText} numberOfLines={1}>{tagFor(photo)}</Text></View> : null}
      </Pressable>)}</View>
    </View>) : <View style={s.empty}><Icon name="images-outline" size={30} color={theme.sage} /><Text style={s.emptyText}>No photos yet.</Text>{data.plants.length ? <Button label="Open Journal" icon="leaf-outline" onPress={() => router.push('/journal')} outline /> : null}</View>}

    <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
      <Pressable style={s.backdrop} onPress={() => setOpen(null)} accessibilityLabel="Close photo">
        {open ? <Pressable style={s.viewer} onPress={() => {}}>
          <PersistedPhoto uri={open.photoUri} height={360} />
          <View style={s.viewerInfo}>
            <View style={{ flex: 1 }}><Text style={ui.serifMedium}>{tagFor(open)}</Text><Text style={s.viewerDate}>{open.scan ? `${open.scan.condition} · ` : ''}{formatDateTime(open.createdAt)}</Text></View>
            <Pill label={open.scan ? 'Scan photo' : 'Journal photo'} tone="neutral" icon={open.scan ? 'scan-outline' : 'camera-outline'} />
          </View>
          {open.scan ? <Button label="Open Result" icon="document-text-outline" onPress={() => { const id = open.scan!.id; setOpen(null); router.push({ pathname: '/result', params: { id, view: '1' } }); }} /> : null}
          {open.plantId ? <Button label="Open Plant Journal" icon="leaf-outline" outline={!!open.scan} onPress={() => { const id = open.plantId; setOpen(null); router.push({ pathname: '/journal', params: { plantId: id } }); }} /> : null}
          <Button label="Close" outline onPress={() => setOpen(null)} />
        </Pressable> : null}
      </Pressable>
    </Modal>
  </Page>;
}
const s = StyleSheet.create({
  count: { color: theme.muted, fontFamily: font.regular, fontSize: type.body, marginTop: -4, marginBottom: 14 },
  filters: { gap: 8, paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.6%', borderRadius: 16, overflow: 'hidden' },
  tag: { position: 'absolute', left: 6, right: 6, bottom: 6, backgroundColor: 'rgba(255,253,247,0.92)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: type.caption, fontFamily: font.semibold, color: theme.primary },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border },
  emptyText: { color: theme.muted, fontFamily: font.regular, fontSize: type.body, lineHeight: lineHeight(type.body), textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,42,32,0.6)', justifyContent: 'center', padding: 20 },
  viewer: { backgroundColor: theme.surface, borderRadius: 26, padding: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  viewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  viewerDate: { color: theme.muted, fontFamily: font.regular, fontSize: type.small, marginTop: 2 },
});

import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { isSafeHttpUrl } from '../../utils/links';
import { useAuthStore } from '../../auth/authStore';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { colors, fonts, spacing } from '../../config/theme';
import { useGallery } from '../../hooks/useSchoolInfo';
import { MenuTile } from '../../menu/types';
import { Album, buildAlbums, GalleryEntry, GalleryKind } from './galleryModel';
import { StaleBanner, studentGate } from './gate';
import { LIST_PAGE_SIZE } from './listHelpers';

/**
 * The albums the school published for the student's class (`studentPhotoVideoGalleryAPI`). VIEW ONLY and text-first:
 * the app never renders or fetches a photo (no `Image`), so it adds no image cache of its own. A photo or video opens
 * only in the phone's browser / viewer after the link check (photos: ERP host allow-list; videos: plain http(s)).
 * No download, save, share, upload or third-party thumbnail.
 */
export function PhotoGalleryScreen(_props: { tile: MenuTile }) {
  return <GalleryList kind="Photo" />;
}

export function VideoGalleryScreen(_props: { tile: MenuTile }) {
  return <GalleryList kind="Video" />;
}

function GalleryList({ kind }: { kind: GalleryKind }) {
  const user = useAuthStore((s) => s.user);
  const q = useGallery(kind);
  const albums = useMemo(() => buildAlbums(q.data ?? [], kind), [q.data, kind]);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);

  const blocked = studentGate(user, q);
  if (blocked) return blocked;

  const visible = albums.slice(0, shown);
  const noun = kind === 'Photo' ? 'photos' : 'videos';

  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <StaleBanner show={q.isError} />
      {albums.length === 0 ? (
        <EmptyState title={`No ${noun} for your class yet`} hint="Your school has not published any for your class." />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={styles.caption}>School year {user?.syear}</Text>
          {visible.map((album) => (
            <AlbumCard key={album.key} album={album} kind={kind} />
          ))}
          {albums.length > visible.length ? (
            <Button title={`Show more (${albums.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
        </View>
      )}
    </Page>
  );
}

function AlbumCard({ album, kind }: { album: Album; kind: GalleryKind }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(LIST_PAGE_SIZE);
  const [failed, setFailed] = useState<string | null>(null);
  const noun = kind === 'Photo' ? (album.count === 1 ? 'photo' : 'photos') : album.count === 1 ? 'video' : 'videos';

  const openEntry = (e: GalleryEntry) => {
    const url = e.link.url;
    if (!url) return;
    setFailed(null);
    void Promise.resolve()
      .then(() => { if (!isSafeHttpUrl(url)) throw new Error('unsafe link'); return Linking.openURL(url); })
      .catch(() => setFailed(e.key));
  };

  const visible = album.entries.slice(0, shown);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${album.title}, ${album.count} ${noun}${album.newest ? `, latest ${album.newest}` : ''}, ${open ? 'expanded' : 'collapsed'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.muted}>
            {album.count} {noun}
            {album.newest ? ` · latest ${album.newest}` : ''}
          </Text>
        </View>
        <Text style={styles.chev}>{open ? '–' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {visible.map((e) => (
            <View key={e.key} style={styles.entry}>
              <View accessible accessibilityLabel={`${e.title}${e.date ? `, ${e.date}` : ''}`}>
                <Text style={styles.entryTitle}>{e.title}</Text>
                {e.date ? <Text style={styles.muted}>{e.date}</Text> : null}
                {e.link.state === 'unsafe' ? <Text style={styles.warn}>{kind === 'Photo' ? "Photo can't be opened from the app" : "Video can't be opened from the app"}</Text> : null}
              </View>
              {e.link.state === 'ready' ? <Button title={kind === 'Photo' ? 'Open photo' : 'Open video'} variant="secondary" onPress={() => openEntry(e)} /> : null}
              {failed === e.key ? (
                <Text style={styles.warn} accessibilityRole="alert">
                  Couldn't open the file. Please try again or contact your school.
                </Text>
              ) : null}
            </View>
          ))}
          {album.entries.length > visible.length ? (
            <Button title={`Show more (${album.entries.length - visible.length} more)`} variant="secondary" onPress={() => setShown((s) => s + LIST_PAGE_SIZE)} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular },
  chev: { color: colors.primary, fontSize: 22, fontFamily: fonts.bold, width: 24, textAlign: 'center' },
  entry: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
  warn: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
});

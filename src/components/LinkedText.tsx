import React from 'react';
import { Linking, StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../config/theme';
import { isSafeHttpUrl, splitLinks } from '../utils/links';

/** Opens a link only if it is a safe `http(s)://host…` URL (checked again here, not only when the text was split). */
export function openSafeLink(url: string): void {
  if (!isSafeHttpUrl(url)) return;
  Linking.openURL(url).catch(() => {});
}

/**
 * Plain text in which `http(s)` links are tappable. Everything else - including `javascript:`, `tel:`,
 * `intent:` and `file:` text - stays inert. The text is rendered as text, never interpreted as markup.
 */
export function LinkedText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const parts = splitLinks(children);
  return (
    <Text style={style} selectable>
      {parts.map((p, i) =>
        p.url ? (
          <Text key={i} style={styles.link} accessibilityRole="link" onPress={() => openSafeLink(p.url!)}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({ link: { color: colors.primary, textDecorationLine: 'underline' } });

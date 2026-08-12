import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui';

/** A single read-only reminder: a seafoam dot, the text, and optional provenance. */
export type Highlight = { text: string; source?: string };

/**
 * Read-only prep reminders (round-2 change #2/#3): a seafoam dot-strip of "what's worth
 * carrying in", NOT a checklist. No checkboxes, no counter, no "mark all done" — prep is a
 * reminder the clinician reads, never a task they tick. Used on the drawer, the prep
 * screen, and pre-capture so the three surfaces read as one family.
 */
export function Highlights({ items }: { items: Highlight[] }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: 10 }}>
      {items.map((h, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, marginTop: 7, backgroundColor: c.brandStrong }} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" color="ink">
              {h.text}
            </AppText>
            {h.source ? (
              <AppText variant="small" color="ink3" style={{ marginTop: 2 }}>
                {h.source}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

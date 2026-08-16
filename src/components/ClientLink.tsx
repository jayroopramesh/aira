import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Client } from '../data/types';
import { Avatar, Row } from './ui';

/**
 * The one place a client's name/avatar becomes a link to their patient page
 * (`/(app)/today/[clientId]`). Every screen that renders a client identity chip wraps it in this
 * instead of hand-rolling its own Pressable, so the affordance (route, role, label) can't drift
 * between screens. `children` carries the name/subtitle content next to the avatar — callers keep
 * their own text layout, this owns only the navigation.
 */
export function ClientLink({
  client,
  avatarSize = 44,
  avatarTone,
  gap = 14,
  style,
  children,
}: {
  client: Pick<Client, 'id' | 'name' | 'initials' | 'risk'>;
  avatarSize?: number;
  /** Overrides the risk-derived tone (e.g. the acute risk-review header, forced via `?risk=1`). */
  avatarTone?: 'brand' | 'risk';
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(app)/today/${client.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${client.name}’s page`}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }, style]}
    >
      <Row gap={gap}>
        <Avatar initials={client.initials} size={avatarSize} tone={avatarTone ?? (client.risk === 'acute' ? 'risk' : 'brand')} />
        {children}
      </Row>
    </Pressable>
  );
}

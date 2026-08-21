// app/components/partite/MatchEventCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarEvent } from '../../data/events';

type MatchEvent = CalendarEvent & {
  competition?: string;
  homeAway?: 'CASA' | 'TRASFERTA';
};

interface MatchEventCardProps {
  item: MatchEvent;
  onPress: (item: MatchEvent) => void;
  onEdit?: (item: MatchEvent) => void;
  onDelete?: (id: string) => void;
}

export default function MatchEventCard({ item, onPress, onEdit, onDelete }: MatchEventCardProps) {
  const comp = item.competition || '—';
  const ha = item.homeAway || 'CASA';

  return (
    <View style={styles.eventCard}>
      <Pressable style={{ flex: 1 }} onPress={() => onPress(item)}>
        <View style={styles.rowBetween}>
          <Text style={styles.badge}>{comp}</Text>
          <Text style={[styles.haBadge, ha === 'CASA' ? styles.haHome : styles.haAway]}>{ha}</Text>
        </View>
        <Text style={styles.opponent}>vs {item.opponent || '—'}</Text>
        <Text style={styles.meta}>
          {item.date || '—'} · {item.time || '--:--'} · {item.location || '—'}
        </Text>
      </Pressable>
      {onEdit && (
        <Pressable style={styles.trashBtn} onPress={() => onEdit(item)}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
        </Pressable>
      )}
      {onDelete && (
        <Pressable style={styles.trashBtn} onPress={() => onDelete(item.id)}>
          <Text style={{ fontSize: 18 }}>🗑️</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  haBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  haHome: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  haAway: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  opponent: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#666',
  },
  trashBtn: {
    padding: 8,
    marginLeft: 8,
  },
});
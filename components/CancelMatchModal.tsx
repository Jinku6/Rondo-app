import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

export type CancelWindow = '48h_plus' | '24_48h' | '4_24h' | 'sub_4h';

interface Props {
  visible: boolean;
  window: CancelWindow;
  onConfirm: () => void;
  onCancel: () => void;
}

const COPY: Record<Exclude<CancelWindow, '48h_plus'>, { title: string; body: string }> = {
  '24_48h': {
    title: 'Baja con poco margen',
    body: 'Vas con el tiempo justo. Esta baja se anota en tu historial, pero de momento no toca tu fiabilidad.',
  },
  '4_24h': {
    title: 'Baja tardía',
    body: 'Si te borras ahora, al grupo le va a costar encontrar un suplente. Esta baja cuenta como No Asistencia. ¿Seguro que no puedes ir?',
  },
  sub_4h: {
    title: 'Borrarse a última hora',
    body: 'Borrarse ahora complica mucho el partido. Se registrará como No Asistencia y tu reputación en Rondo bajará. ¿Te lo piensas dos veces?',
  },
};

export default function CancelMatchModal({ visible, window, onConfirm, onCancel }: Props) {
  if (window === '48h_plus') return null;
  const { title, body } = COPY[window];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white dark:bg-gray-900 rounded-t-2xl p-6 pb-10">
          <Text className="text-lg font-bold text-slate-900 dark:text-white mb-3">{title}</Text>
          <Text className="text-slate-600 dark:text-slate-400 text-base leading-relaxed mb-6">
            {body}
          </Text>
          <TouchableOpacity
            className="bg-green-500 rounded-xl py-4 items-center mb-3"
            onPress={onCancel}
          >
            <Text className="text-white font-bold text-base">Mantenerme en el partido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-xl py-4 items-center border border-red-400"
            onPress={onConfirm}
          >
            <Text className="text-red-500 font-semibold text-base">Cancelar y asumir consecuencias</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

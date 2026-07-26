// app/utils/modules-layout.ts
export type FieldSlot = {
  id: string;
  x: number;
  y: number;
};

export const MODULES: Record<string, FieldSlot[]> = {
  // 3-1-4-2 con trequartista dietro la linea a 4
  '3-1-4-2': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DF1', x: 20, y: 74 },
    { id: 'DF2', x: 50, y: 74 },
    { id: 'DF3', x: 80, y: 74 },

    { id: 'MF1', x: 50, y: 62 }, // mediano

    // linea a 4
    { id: 'MF2', x: 22, y: 50 },
    { id: 'MF5', x: 40, y: 50 },
    { id: 'MF3', x: 60, y: 50 },
    { id: 'MF4', x: 78, y: 50 },

    // trequartista dietro le punte


    { id: 'FW1', x: 35, y: 22 },
    { id: 'FW2', x: 65, y: 22 },
  ],

  // 3-4-2-1
  '3-4-2-1': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DF1', x: 20, y: 74 },
    { id: 'DF2', x: 50, y: 74 },
    { id: 'DF3', x: 80, y: 74 },

    { id: 'MF1', x: 20, y: 56 },
    { id: 'MF2', x: 40, y: 56 },
    { id: 'MF3', x: 60, y: 56 },
    { id: 'MF4', x: 80, y: 56 },

    { id: 'TQ1', x: 38, y: 36 },
    { id: 'TQ2', x: 62, y: 36 },

    { id: 'PC', x: 50, y: 18 },
  ],

  // 4-4-2
  '4-4-2': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DL', x: 12, y: 74 },
    { id: 'DC1', x: 36, y: 74 },
    { id: 'DC2', x: 64, y: 74 },
    { id: 'DR', x: 88, y: 74 },

    { id: 'ML', x: 18, y: 54 },
    { id: 'MC1', x: 40, y: 54 },
    { id: 'MC2', x: 60, y: 54 },
    { id: 'MR', x: 82, y: 54 },

    { id: 'F1', x: 42, y: 22 },
    { id: 'F2', x: 58, y: 22 },
  ],

  // 4-3-3
  '4-3-3': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DL', x: 12, y: 74 },
    { id: 'DC1', x: 36, y: 74 },
    { id: 'DC2', x: 64, y: 74 },
    { id: 'DR', x: 88, y: 74 },

    { id: 'MC', x: 50, y: 58 },
    { id: 'MS', x: 32, y: 56 },
    { id: 'MD', x: 68, y: 56 },

    { id: 'AS', x: 24, y: 26 },
    { id: 'PC', x: 50, y: 18 },
    { id: 'AD', x: 76, y: 26 },
  ],

  // 4-2-3-1
  '4-2-3-1': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DL', x: 12, y: 74 },
    { id: 'DC1', x: 36, y: 74 },
    { id: 'DC2', x: 64, y: 74 },
    { id: 'DR', x: 88, y: 74 },

    { id: 'MDM1', x: 38, y: 62 },
    { id: 'MDM2', x: 62, y: 62 },

    { id: 'TQ1', x: 30, y: 40 },
    { id: 'TQ2', x: 50, y: 38 },
    { id: 'TQ3', x: 70, y: 40 },

    { id: 'PC', x: 50, y: 18 },
  ],

  // 4-3-2-1 (albero di Natale)
  '4-3-2-1': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DL', x: 12, y: 74 },
    { id: 'DC1', x: 36, y: 74 },
    { id: 'DC2', x: 64, y: 74 },
    { id: 'DR', x: 88, y: 74 },

    { id: 'MC1', x: 35, y: 58 },
    { id: 'REG', x: 50, y: 58 },
    { id: 'MC2', x: 65, y: 58 },

    { id: 'TQ1', x: 42, y: 38 },
    { id: 'TQ2', x: 57, y: 38 },

    { id: 'PC', x: 50, y: 18 },
  ],

  // 3-5-2
  '3-5-2': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DF1', x: 20, y: 74 },
    { id: 'DF2', x: 50, y: 74 },
    { id: 'DF3', x: 80, y: 74 },

    { id: 'ES', x: 16, y: 56 },
    { id: 'MC1', x: 36, y: 58 },
    { id: 'REG', x: 50, y: 60 },
    { id: 'MC2', x: 64, y: 58 },
    { id: 'ED', x: 84, y: 56 },

    { id: 'AT1', x: 42, y: 22 },
    { id: 'AT2', x: 58, y: 22 },
  ],

  // 5-3-2
  '5-3-2': [
    { id: 'GK', x: 50, y: 92 },

    { id: 'DL', x: 8, y: 74 },
    { id: 'DC1', x: 28, y: 74 },
    { id: 'LDC', x: 50, y: 76 },
    { id: 'DC2', x: 72, y: 74 },
    { id: 'DR', x: 92, y: 74 },

    { id: 'MC1', x: 36, y: 56 },
    { id: 'REG', x: 50, y: 58 },
    { id: 'MC2', x: 64, y: 56 },

    { id: 'AT1', x: 42, y: 22 },
    { id: 'AT2', x: 58, y: 22 },
  ],
};

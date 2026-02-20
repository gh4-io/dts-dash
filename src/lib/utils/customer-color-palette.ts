/**
 * Hardcoded customer color palette based on complementary color theory
 * Colors are polar opposites on the color wheel for maximum visual pop
 * while maintaining cohesion through saturation and lightness balance
 * Optimized for dark theme backgrounds
 */

export const CUSTOMER_COLOR_PALETTE = [
  // Pair 1: Red ↔ Cyan
  { primary: "#EF4444", complement: "#06B6D4" },

  // Pair 2: Orange ↔ Blue
  { primary: "#F97316", complement: "#3B82F6" },

  // Pair 3: Yellow ↔ Purple
  { primary: "#EABC42", complement: "#8B5CF6" },

  // Pair 4: Green ↔ Magenta
  { primary: "#22C55E", complement: "#EC4899" },

  // Pair 5: Teal ↔ Pink-Red
  { primary: "#14B8A6", complement: "#F43F5E" },

  // Pair 6: Lime ↔ Indigo
  { primary: "#84CC16", complement: "#6366F1" },

  // Pair 7: Sky Blue ↔ Amber
  { primary: "#0EA5E9", complement: "#F59E0B" },

  // Pair 8: Emerald ↔ Fuchsia
  { primary: "#10B981", complement: "#D946EF" },

  // Pair 9: Ocean ↔ Light Blue
  { primary: "#06B6D4", complement: "#BFDBFE" },

  // Pair 10: Rose ↔ Mint
  { primary: "#FB7185", complement: "#06D6A6" },

  // Pair 11: Violet ↔ Electric Lime
  { primary: "#A855F7", complement: "#CCFF00" },

  // Pair 12: Orange-Red ↔ Electric Cyan
  { primary: "#FF6B35", complement: "#00D9FF" },
];

/**
 * Get a color pair from the palette by index, cycling if exhausted
 * @param index - Customer index (0-based)
 * @returns Object with primary and complement colors
 */
export function getCustomerColorPair(index: number) {
  return CUSTOMER_COLOR_PALETTE[index % CUSTOMER_COLOR_PALETTE.length];
}

/**
 * Get just the primary color (for backward compatibility)
 * @param index - Customer index (0-based)
 * @returns Hex color code
 */
export function getCustomerColor(index: number): string {
  return getCustomerColorPair(index).primary;
}

/**
 * Get the complement color for a given index
 * @param index - Customer index (0-based)
 * @returns Hex color code of the complementary color
 */
export function getCustomerComplementColor(index: number): string {
  return getCustomerColorPair(index).complement;
}

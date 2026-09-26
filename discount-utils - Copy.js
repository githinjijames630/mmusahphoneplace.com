function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function calculateDiscountedPrice(price, discountPercent) {
  const basePrice = Number(price) || 0;
  const percent = clamp(Number(discountPercent) || 0, 0, 100);
  if (basePrice <= 0 || percent <= 0) return basePrice;
  return Math.max(0, Math.round(basePrice * (1 - percent / 100)));
}

export function getDiscountInfo(price, discountPercent) {
  const basePrice = Number(price) || 0;
  const percent = clamp(Number(discountPercent) || 0, 0, 100);
  const discountAmount = basePrice > 0 ? Math.round(basePrice * (percent / 100)) : 0;
  const finalPrice = calculateDiscountedPrice(basePrice, percent);
  return {
    originalPrice: basePrice,
    discountPercent: percent,
    discountAmount,
    finalPrice,
    isDiscounted: percent > 0 && basePrice > 0
  };
}

if (typeof window !== 'undefined') {
  window.calculateDiscountedPrice = calculateDiscountedPrice;
  window.getDiscountInfo = getDiscountInfo;
}

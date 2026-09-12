/**
 * Builds a `sms:` URI that works across iOS and Android. The two platforms disagree on how a
 * pre-filled body is separated from the number: iOS (particularly older Safari/iOS Messages)
 * expects `&body=`, while Android and standard mobile browsers expect `?body=`. Getting this
 * wrong silently drops the pre-filled text on one platform.
 */
export function getSmsUri(phoneNumber: string | null | undefined, message: string) {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  const separator = isIOS ? "&body=" : "?body=";
  const number = phoneNumber ?? "";
  return `sms:${number}${separator}${encodeURIComponent(message)}`;
}

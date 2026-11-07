import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * react-native-web ships Alert.alert as a no-op, so every confirmation
 * dialog (logout, delete, validation errors...) silently does nothing in
 * the browser. This polyfill maps Alert.alert to window.alert/confirm so
 * the exact same code works on web without touching any screen.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');

    // No buttons -> simple notice
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }

    // Single button -> notice, then run its handler
    if (buttons.length === 1) {
      window.alert(text);
      buttons[0].onPress?.();
      return;
    }

    // Two or more buttons -> confirm: OK = the action, Cancel = the cancel button
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const actionBtn =
      [...buttons].reverse().find((b) => b !== cancelBtn) ?? buttons[buttons.length - 1];

    if (window.confirm(text)) {
      actionBtn.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}

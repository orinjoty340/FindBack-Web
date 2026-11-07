
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
const API_URL = 'https://findback-lostandfound.onrender.com/api/notifications';
const TOKEN_STORAGE_KEY = 'findback_token';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

type Props = {
  isLoggedIn: boolean;
};

export default function NotificationBell({ isLoggedIn }: Props) {
  const [visible, setVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popupQueue, setPopupQueue] = useState<NotificationItem[]>([]);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === 'active'
  );
  const [audioReady, setAudioReady] = useState(false);

  // Refs
  const knownIdsRef = useRef<Set<string>>(new Set());
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const soundPlayedIdsRef = useRef<Set<string>>(new Set());

  const initializedRef = useRef(false);
  const fetchingRef = useRef(false);

  // Audio synchronization
  const playbackLockRef = useRef<string | null>(null);
  const [playbackVersion, setPlaybackVersion] = useState(0);

  // Persistent audio player
  const player = useAudioPlayer(
    require('../assets/notification.wav')
  );

  const playerStatus = useAudioPlayerStatus(player);

  const activePopup = popupQueue[0] || null;

  // ==========================================
  // CONFIGURE AUDIO
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
        });

        if (cancelled) return;

        player.volume = 1;
        player.muted = false;

        setAudioReady(true);

        console.log('FindBack audio configured successfully');
      } catch (err) {
        console.log('Audio configuration error:', err);

        if (!cancelled) {
          // Audio mode options are native-only; on web the player still works.
          setAudioReady(Platform.OS === 'web');
        }
      }
    };

    configureAudio();

    return () => {
      cancelled = true;
      player.pause();
    };
  }, [player]);

  // ==========================================
  // TRACK APP FOREGROUND / BACKGROUND
  // ==========================================

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        const active = nextState === 'active';

        setAppIsActive(active);

        if (!active) {
          player.pause();
        }
      }
    );

    return () => subscription.remove();
  }, [player]);

  // ==========================================
  // AUTHENTICATION HEADERS
  // ==========================================

  const getHeaders = async () => {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      throw new Error('Please login again.');
    }

    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  };

  // ==========================================
  // FETCH NOTIFICATIONS
  // ==========================================

  const refreshNotifications = useCallback(
    async (showLoading = false, detectNew = true) => {
      if (
        !isLoggedIn ||
        !initializedRef.current ||
        fetchingRef.current
      ) {
        return;
      }

      fetchingRef.current = true;

      if (showLoading) {
        setLoading(true);
      }

      try {
        const headers = await getHeaders();

        const [listResponse, countResponse] = await Promise.all([
          fetch(API_URL, { headers }),
          fetch(`${API_URL}/unread-count`, { headers }),
        ]);

        const [listData, countData] = await Promise.all([
          listResponse.json(),
          countResponse.json(),
        ]);

        if (!listResponse.ok || !listData.success) {
          throw new Error(
            listData.message || 'Could not load notifications.'
          );
        }

        if (!countResponse.ok || !countData.success) {
          throw new Error(
            countData.message || 'Could not load unread count.'
          );
        }

        const list: NotificationItem[] = Array.isArray(
          listData.notifications
        )
          ? listData.notifications
          : [];

        setNotifications(list);
        setUnreadCount(Number(countData.count) || 0);
        setError('');

        // Detect genuinely new unread notifications
        const newNotifications = detectNew
          ? list.filter(
              (item) =>
                !knownIdsRef.current.has(item._id) &&
                !item.isRead
            )
          : [];

        // Remember existing notifications
        list.forEach((item) => {
          knownIdsRef.current.add(item._id);
        });

        if (newNotifications.length > 0) {
          const sortedNew = newNotifications.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
          );

          const uniqueNew = sortedNew.filter((item) => {
            if (queuedIdsRef.current.has(item._id)) {
              return false;
            }

            queuedIdsRef.current.add(item._id);
            return true;
          });

          if (uniqueNew.length > 0) {
            setPopupQueue((previous) => [
              ...previous,
              ...uniqueNew,
            ]);
          }

          console.log(
            'New foreground notifications:',
            uniqueNew.length
          );
        }
      } catch (err: any) {
        console.log('Notification fetch error:', err.message);

        if (showLoading) {
          setError(err.message || 'Something went wrong.');
        }
      } finally {
        fetchingRef.current = false;

        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [isLoggedIn]
  );

  // ==========================================
  // INITIALIZE NOTIFICATIONS
  // ==========================================

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    if (!isLoggedIn) {
      initializedRef.current = false;

      knownIdsRef.current.clear();
      queuedIdsRef.current.clear();
      soundPlayedIdsRef.current.clear();

      playbackLockRef.current = null;
      fetchingRef.current = false;

      setNotifications([]);
      setUnreadCount(0);
      setPopupQueue([]);
      setVisible(false);
      setError('');

      return;
    }

    const initialize = async () => {
      try {
        initializedRef.current = true;

        // Initial fetch establishes baseline
        await refreshNotifications(false, false);

        if (cancelled) return;

        interval = setInterval(() => {
          if (AppState.currentState === 'active') {
            refreshNotifications();
          }
        }, 5000);

        console.log('Notification monitoring started');
      } catch (err) {
        console.log('Notification initialization error:', err);
      }
    };

    initialize();

    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active' && !cancelled) {
          // Resume without generating old popups
          refreshNotifications(false, false);
        }
      }
    );

    return () => {
      cancelled = true;

      if (interval) {
        clearInterval(interval);
      }

      subscription.remove();
      initializedRef.current = false;
    };
  }, [isLoggedIn, refreshNotifications]);

  // ==========================================
  // SYNCHRONIZED FOREGROUND SOUND PLAYBACK
  // ==========================================

  useEffect(() => {
    if (!activePopup) return;
    if (!appIsActive) return;
    if (!audioReady) return;
    if (!playerStatus.isLoaded) return;

    const notificationId = activePopup._id;

    // Prevent duplicate playback
    if (soundPlayedIdsRef.current.has(notificationId)) {
      return;
    }

    // Wait until the previous sound finishes
    if (playerStatus.playing) {
      return;
    }

    // Prevent simultaneous playback operations
    if (playbackLockRef.current !== null) {
      return;
    }

    let cancelled = false;

    const playNotificationSound = async () => {
      if (playbackLockRef.current !== null) return;

      // Acquire lock immediately
      playbackLockRef.current = notificationId;

      try {
        if (
          cancelled ||
          AppState.currentState !== 'active'
        ) {
          return;
        }

        player.volume = 1;
        player.muted = false;

        // Start from the beginning
        await player.seekTo(0);

        // Recheck after asynchronous operation
        if (
          cancelled ||
          !appIsActive ||
          AppState.currentState !== 'active' ||
          !playerStatus.isLoaded
        ) {
          return;
        }

        if (soundPlayedIdsRef.current.has(notificationId)) {
          return;
        }

        // Mark before requesting playback
        soundPlayedIdsRef.current.add(notificationId);

        // Start playback
        player.play();

        console.log(
          'FindBack sound playback requested:',
          notificationId
        );
      } catch (err) {
        // Allow retry if playback request fails
        soundPlayedIdsRef.current.delete(notificationId);

        console.log(
          'Notification sound playback error:',
          err
        );
      } finally {
        if (playbackLockRef.current === notificationId) {
          playbackLockRef.current = null;
        }

        // Retry pending popup if it was waiting for the lock
        setPlaybackVersion((previous) => previous + 1);
      }
    };

    playNotificationSound();

    return () => {
      cancelled = true;
    };
  }, [
    activePopup?._id,
    appIsActive,
    audioReady,
    playerStatus.isLoaded,
    playerStatus.playing,
    player,
    playbackVersion,
  ]);

  // ==========================================
  // AUDIO STATUS MONITORING
  // ==========================================

  useEffect(() => {
    if (playerStatus.isLoaded) {
      console.log('Notification audio file loaded successfully');
      console.log('Audio duration:', playerStatus.duration);
    }
  }, [playerStatus.isLoaded]);

  useEffect(() => {
    if (playerStatus.isLoaded) {
      console.log(
        'Notification audio playing:',
        playerStatus.playing
      );
    }
  }, [playerStatus.playing]);

  // ==========================================
  // REMOVE POPUP FROM QUEUE
  // ==========================================

  const removeFromQueue = (id: string) => {
    queuedIdsRef.current.delete(id);

    setPopupQueue((previous) =>
      previous.filter((item) => item._id !== id)
    );
  };

  const dismissPopup = () => {
    if (!activePopup) return;

    removeFromQueue(activePopup._id);
  };

  // ==========================================
  // AUTO DISMISS POPUP
  // ==========================================

  useEffect(() => {
    if (!activePopup) return;

    const timer = setTimeout(() => {
      removeFromQueue(activePopup._id);
    }, 6000);

    return () => clearTimeout(timer);
  }, [activePopup?._id]);

  // ==========================================
  // OPEN NOTIFICATION HISTORY
  // ==========================================

  const openModal = () => {
    setVisible(true);
    refreshNotifications(true);
  };

  const closeModal = () => {
    setVisible(false);
  };

  // ==========================================
  // MARK ONE AS READ
  // ==========================================

  const markAsRead = async (id: string) => {
    try {
      const headers = await getHeaders();

      const response = await fetch(`${API_URL}/${id}/read`, {
        method: 'PATCH',
        headers,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Could not mark as read.'
        );
      }

      removeFromQueue(id);
      await refreshNotifications();
    } catch (err: any) {
      Alert.alert('Notification', err.message);
    }
  };

  // ==========================================
  // MARK ALL AS READ
  // ==========================================

  const markAllAsRead = async () => {
    try {
      const headers = await getHeaders();

      const response = await fetch(`${API_URL}/read-all`, {
        method: 'PATCH',
        headers,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Could not update notifications.'
        );
      }

      queuedIdsRef.current.clear();
      setPopupQueue([]);

      await refreshNotifications();
    } catch (err: any) {
      Alert.alert('Notification', err.message);
    }
  };

  // ==========================================
  // DELETE NOTIFICATION
  // ==========================================

  const deleteNotification = async (id: string) => {
    try {
      const headers = await getHeaders();

      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Could not delete notification.'
        );
      }

      removeFromQueue(id);
      knownIdsRef.current.delete(id);
      soundPlayedIdsRef.current.delete(id);

      await refreshNotifications();
    } catch (err: any) {
      Alert.alert('Notification', err.message);
    }
  };

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate = (date: string) => {
    const value = new Date(date);

    if (Number.isNaN(value.getTime())) return '';

    return value.toLocaleString();
  };

  if (!isLoggedIn) return null;

  return (
    <>
      {/* Notification Bell */}
      <View>
        <Button
          size="icon"
          variant="outline"
          className="rounded-xl border-0"
          onPress={openModal}
        >
          <Text style={styles.bell}>🔔</Text>
        </Button>

        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>

      {/* Notification History */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeModal}
          />

          <View style={styles.modal}>
            <View style={styles.header}>
              <View>
                <Text style={styles.heading}>
                  Notifications
                </Text>

                <Text style={styles.subheading}>
                  {unreadCount} unread notifications
                </Text>
              </View>

              <Pressable onPress={closeModal} hitSlop={10}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            {unreadCount > 0 && (
              <Pressable
                style={styles.markAllButton}
                onPress={markAllAsRead}
              >
                <Text style={styles.markAllText}>
                  Mark All as Read
                </Text>
              </Pressable>
            )}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator
                  size="large"
                  color="#40205F"
                />
                <Text style={styles.emptyText}>
                  Loading notifications...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>
                  {error}
                </Text>

                <Pressable
                  onPress={() => refreshNotifications(true)}
                >
                  <Text style={styles.markAllText}>
                    Try Again
                  </Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.emptyIcon}>🔔</Text>
                    <Text style={styles.emptyText}>
                      No notifications yet.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.notificationCard,
                      !item.isRead && styles.unreadCard,
                    ]}
                  >
                    <Pressable
                      style={styles.notificationContent}
                      onPress={() => {
                        if (!item.isRead) {
                          markAsRead(item._id);
                        }
                      }}
                    >
                      <View style={styles.titleRow}>
                        <Text style={styles.notificationTitle}>
                          {item.title}
                        </Text>

                        {!item.isRead && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>

                      <Text style={styles.message}>
                        {item.message}
                      </Text>

                      <Text style={styles.date}>
                        {formatDate(item.createdAt)}
                      </Text>

                      <Text style={styles.type}>
                        {item.type}
                      </Text>
                    </Pressable>

                    <View style={styles.actions}>
                      {!item.isRead && (
                        <Pressable
                          onPress={() => markAsRead(item._id)}
                          hitSlop={8}
                        >
                          <Text style={styles.actionText}>
                            Read
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            'Delete Notification',
                            'Are you sure you want to delete this notification?',
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                              {
                                text: 'Delete',
                                onPress: () =>
                                  deleteNotification(item._id),
                              },
                            ]
                          );
                        }}
                        hitSlop={8}
                      >
                        <Text style={styles.actionText}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            )}

            <Pressable
              style={styles.footer}
              onPress={closeModal}
            >
              <Text style={styles.footerText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Foreground Notification Popup */}
      <Modal
        visible={Boolean(activePopup)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissPopup}
      >
        <View
          pointerEvents="box-none"
          style={styles.popupOverlay}
        >
          {activePopup && (
            <View style={styles.popupCard}>
              <View style={styles.popupTopRow}>
                <View style={styles.popupIcon}>
                  <Text style={styles.popupBell}>🔔</Text>
                </View>

                <View style={styles.popupTextContainer}>
                  <Text
                    style={styles.popupHeading}
                    numberOfLines={1}
                  >
                    {activePopup.title}
                  </Text>

                  <Text
                    style={styles.popupMessage}
                    numberOfLines={2}
                  >
                    {activePopup.message}
                  </Text>
                </View>

                <Pressable
                  onPress={dismissPopup}
                  hitSlop={10}
                  style={styles.popupClose}
                >
                  <Text style={styles.popupCloseText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.popupBottomRow}>
                <Text style={styles.popupTime}>
                  {formatDate(activePopup.createdAt)}
                </Text>

                <Pressable
                  onPress={() => {
                    dismissPopup();
                    setVisible(true);
                    refreshNotifications(true);
                  }}
                >
                  <Text style={styles.popupInboxText}>
                    View Inbox
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#40205F',
  },
  subheading: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
  },
  closeButton: {
    fontSize: 22,
    color: '#40205F',
    padding: 5,
  },
  bell: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#40205F',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: 9,
  },
  markAllText: {
    color: '#40205F',
    fontSize: 13,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: '#F8F5FB',
    borderWidth: 1,
    borderColor: '#E8DDF2',
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
  },
  unreadCard: {
    backgroundColor: '#F0E8FA',
    borderColor: '#C9B2E2',
  },
  notificationContent: {
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTitle: {
    color: '#40205F',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#40205F',
  },
  message: {
    color: '#444444',
    fontSize: 13,
    lineHeight: 19,
  },
  date: {
    color: '#888888',
    fontSize: 10,
  },
  type: {
    color: '#40205F',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 10,
  },
  actionText: {
    color: '#40205F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  center: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    marginTop: 12,
    backgroundColor: '#40205F',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  popupOverlay: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 12,
  },
  popupCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DDF2',
  },
  popupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  popupIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F0E8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBell: {
    fontSize: 22,
  },
  popupTextContainer: {
    flex: 1,
    gap: 3,
  },
  popupHeading: {
    color: '#40205F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  popupMessage: {
    color: '#444444',
    fontSize: 12,
    lineHeight: 17,
  },
  popupClose: {
    padding: 4,
  },
  popupCloseText: {
    color: '#796B86',
    fontSize: 17,
  },
  popupBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE7F5',
  },
  popupTime: {
    color: '#888888',
    fontSize: 10,
    flex: 1,
  },
  popupInboxText: {
    color: '#40205F',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

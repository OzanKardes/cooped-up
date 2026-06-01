import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, TextInput, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerTabReset, triggerTabReset as _triggerTabReset } from '../../lib/tabResetStore';
import { Ionicons } from '@expo/vector-icons';
import BackArrow from '../../components/ui/BackArrow';
import { Colors, Typography } from '../../constants/theme';
import { isDark, subscribe as subscribeTheme, DarkTheme } from '../../lib/themeStore';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
  getDMs, getMessages, getGroupMessages,
  sendMessage as dbSendMessage,
  sendGroupMessage as dbSendGroupMessage,
  subscribeToMessages,
  subscribeToGroupMessages,
  subscribeToGroupMemberships,
  subscribeToIncomingDMs,
  getGroupsForUser,
  leaveGroup,
  addMembersToGroup,
  sendSystemMessage,
  getGroupMembers,
} from '../../services/messages';
import { cancelPlan, leavePlan, getPlanById } from '../../services/plans';
import { notifyChatUnreadCount } from '../../lib/chatUnreadStore';
import type { Message, User } from '../../types';
import {
  searchUsers, sendFriendRequest, getFriends,
  getFriendRequests, getSentFriendRequests,
  acceptFriendRequest, declineFriendRequest,
  subscribeToFriendRequests,
} from '../../services/friends';
import { checkAndUnlockBadges } from '../../services/badges';
import { notifyBadgeUnlocked } from '../../lib/badgeQueue';
import { getFriendCount } from '../../services/users';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

const formatTimestamp = (iso: string): string => {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlanData { title: string; location: string; time: string; weather: string; }
interface LocationData { name: string; status: string; weather: string; }

interface ChatMessage {
  id: string;
  sender: string;      // 'ME' | initials
  senderName: string;
  text: string;
  time: string;
  isSystem?: boolean;
  plan?: PlanData;
  location?: LocationData;
  invite?: PlanData;
  imageUri?: string;
}

interface GroupThread {
  type: 'group';
  id: string;
  name: string;
  memberCount: number;
  memberInitials: string[];
  lastMsg: string;
  lastTime: string;
  unread: number;
  isSystem?: boolean;
  messages: ChatMessage[];
  planId?: string | null;
  planCreatorId?: string | null;
}

interface DMThread {
  type: 'dm';
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  online: boolean;
  lastMsg: string;
  lastTime: string;
  unread: number;
  isNew?: boolean;
}

type Thread = GroupThread | DMThread;

const REACTION_EMOJIS = ['👍', '🔥', '😂', '✅'];

const CAMPUS_SPACES_SHARE = [
  { name: "Queen's Lawn", status: 'BUSY', weather: '☀️ 20°C' },
  { name: 'Beit Quad', status: 'QUIET', weather: '⛅ 18°C' },
  { name: 'SAF Terrace', status: 'EMPTY', weather: '🌤 19°C' },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ initials, size = 32, free = false, uri }: {
  initials: string; size?: number; free?: boolean; uri?: string | null;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View style={[styles.avatar, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: free ? Colors.bluePale : Colors.gray100,
    }]}>
      <Text style={[styles.avatarText, {
        fontSize: size * 0.34,
        color: free ? Colors.navy : Colors.gray500,
      }]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Avatar cluster (3 overlapping circles) ───────────────────────────────────
function AvatarCluster({ initials }: { initials: string[] }) {
  const shown = initials.slice(0, 3);
  const W = shown.length * 18 + 16;
  return (
    <View style={[styles.avatarCluster, { width: W }]}>
      {shown.map((init, i) => (
        <View key={i} style={[styles.clusterSlot, { left: i * 18 }]}>
          <Avatar initials={init} size={28} />
        </View>
      ))}
    </View>
  );
}

// ─── Unread badge ─────────────────────────────────────────────────────────────
function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(1)).current;
  const d2 = useRef(new Animated.Value(1)).current;
  const d3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // target cycle = 900ms, timing_total = 520ms → end_delay = 380 - delay
    // keeps all three dots at the same 900ms period with 180ms stagger
    const bounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1.6, duration: 260, useNativeDriver: true }),
          Animated.timing(val, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.delay(Math.max(0, 380 - delay)),
        ])
      );
    const a1 = bounce(d1, 0);
    const a2 = bounce(d2, 180);
    const a3 = bounce(d3, 360);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingDotsRow}>
      <Animated.View style={[styles.typingDot, { transform: [{ scale: d1 }] }]} />
      <Animated.View style={[styles.typingDot, { transform: [{ scale: d2 }] }]} />
      <Animated.View style={[styles.typingDot, { transform: [{ scale: d3 }] }]} />
    </View>
  );
}

// ─── Plan pill (embedded inside a bubble) ────────────────────────────────────
function PlanPill({ plan }: { plan: PlanData }) {
  return (
    <View style={styles.planPill}>
      <View style={styles.planPillTop}>
        <Text style={styles.planPillTitle}>{plan.title}</Text>
        <Text style={styles.planPillWeather}>{plan.weather}</Text>
      </View>
      <Text style={styles.planPillMeta}>{plan.location}  ·  {plan.time}</Text>
      <TouchableOpacity
        style={styles.planPillJoin}
        onPress={() => showToast(`Joined "${plan.title}"! 🎉`)}
        activeOpacity={0.85}
      >
        <Text style={styles.planPillJoinText}>JOIN →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Location card (embedded in a bubble) ────────────────────────────────────
function LocationCard({ loc }: { loc: LocationData }) {
  return (
    <View style={styles.locationCard}>
      <Text style={styles.locationPin}>📍</Text>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{loc.name}</Text>
        <Text style={styles.locationStatus}>{loc.status}  ·  {loc.weather}</Text>
      </View>
    </View>
  );
}

// ─── Invite card (plan invite with accept / decline) ─────────────────────────
function InviteCard({
  plan, msgId, inviteStates, onRespond,
}: {
  plan: PlanData;
  msgId: string;
  inviteStates: Record<string, 'accepted' | 'declined'>;
  onRespond: (id: string, response: 'accepted' | 'declined') => void;
}) {
  const state = inviteStates[msgId];
  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteCardHeader}>
        <Text style={styles.inviteCardLabel}>PLAN INVITE</Text>
        <Text style={styles.inviteCardWeather}>{plan.weather}</Text>
      </View>
      <Text style={styles.inviteCardTitle}>{plan.title}</Text>
      <Text style={styles.inviteCardMeta}>{plan.location}  ·  {plan.time}</Text>
      {state === 'accepted' ? (
        <View style={styles.inviteAccepted}>
          <Text style={styles.inviteAcceptedText}>✓ ACCEPTED</Text>
        </View>
      ) : state === 'declined' ? (
        <View style={styles.inviteDeclined}>
          <Text style={styles.inviteDeclinedText}>✗ DECLINED</Text>
        </View>
      ) : (
        <View style={styles.inviteBtnRow}>
          <TouchableOpacity
            style={styles.inviteDeclineBtn}
            onPress={() => { onRespond(msgId, 'declined'); showToast(`Declined "${plan.title}"`); }}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteDeclineBtnText}>DECLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inviteAcceptBtn}
            onPress={() => { onRespond(msgId, 'accepted'); showToast(`Accepted "${plan.title}"! 🎉`); }}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteAcceptBtnText}>ACCEPT →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Reaction strip ───────────────────────────────────────────────────────────
function ReactionStrip({
  reactions, msgId, onAdd, alignRight,
}: {
  reactions: Record<string, number>;
  msgId: string;
  onAdd: (id: string, emoji: string) => void;
  alignRight: boolean;
}) {
  const entries = Object.entries(reactions);
  if (!entries.length) return null;
  return (
    <View style={[styles.reactionStrip, alignRight && { justifyContent: 'flex-end' }]}>
      {entries.map(([emoji, count]) => (
        <TouchableOpacity
          key={emoji}
          style={styles.reactionPill}
          onPress={() => onAdd(msgId, emoji)}
        >
          <Text style={styles.reactionPillText}>{emoji} {count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Message row ──────────────────────────────────────────────────────────────
function MessageRow({
  msg, reactions, isGroup, onLongPress, onAddReaction, inviteStates, onInviteRespond, dark, senderAvatarUrl,
}: {
  msg: ChatMessage;
  reactions: Record<string, Record<string, number>>;
  isGroup: boolean;
  senderAvatarUrl?: string | null;
  onLongPress: (id: string) => void;
  onAddReaction: (id: string, emoji: string) => void;
  inviteStates: Record<string, 'accepted' | 'declined'>;
  onInviteRespond: (id: string, response: 'accepted' | 'declined') => void;
  dark: boolean;
}) {
  if (msg.isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.text}</Text>
      </View>
    );
  }

  const isMe = msg.sender === 'ME';
  const msgReactions = reactions[msg.id];
  const bubbleDark = dark && !isMe ? { backgroundColor: '#002060' } : undefined;
  const bubbleMeDark = dark && isMe ? { backgroundColor: '#003087' } : undefined;

  return (
    <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
      {!isMe && <Avatar initials={msg.sender} size={28} uri={senderAvatarUrl} />}
      <View style={[styles.msgCol, isMe && styles.msgColMe]}>
        {!isMe && isGroup && (
          <Text style={[styles.msgSender, dark && { color: 'rgba(255,255,255,0.55)' }]}>{msg.senderName}</Text>
        )}
        {msg.invite ? (
          <InviteCard
            plan={msg.invite}
            msgId={msg.id}
            inviteStates={inviteStates}
            onRespond={onInviteRespond}
          />
        ) : (
          <TouchableOpacity
            onLongPress={() => onLongPress(msg.id)}
            delayLongPress={400}
            activeOpacity={0.88}
          >
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, msg.imageUri && styles.bubbleImage, bubbleDark, bubbleMeDark]}>
              {msg.imageUri && (
                <Image source={{ uri: msg.imageUri }} style={styles.msgImage} resizeMode="cover" />
              )}
              {msg.text !== '' && (
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe, dark && !isMe && { color: '#FFFFFF' }]}>
                  {msg.text}
                </Text>
              )}
              {msg.plan && <PlanPill plan={msg.plan} />}
              {msg.location && <LocationCard loc={msg.location} />}
              <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe, dark && { color: isMe ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.45)' }]}>
                {msg.time}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {msgReactions && (
          <ReactionStrip
            reactions={msgReactions}
            msgId={msg.id}
            onAdd={onAddReaction}
            alignRight={isMe}
          />
        )}
      </View>
    </View>
  );
}

// ─── Chat thread ──────────────────────────────────────────────────────────────
function ChatThread({ thread, onBack, dark, onModalChange }: { thread: Thread; onBack: () => void; dark: boolean; onModalChange?: (open: boolean) => void }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isDM = thread.type === 'dm';
  const dm = isDM ? (thread as DMThread) : null;

  // UUID-format IDs are real DB threads; hardcoded IDs start with 'd'/'g'
  const isRealThread = thread.id.includes('-');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(isRealThread);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addPeopleVisible, setAddPeopleVisible] = useState(false);
  const [addPeopleFriends, setAddPeopleFriends] = useState<any[]>([]);
  const [addPeopleSelected, setAddPeopleSelected] = useState<string[]>([]);
  const [addingPeople, setAddingPeople] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actioning, setActioning] = useState(false);

  const groupThread = !isDM ? (thread as GroupThread) : null;
  const isCreator = groupThread?.planCreatorId === user?.id;
  const planId = groupThread?.planId ?? null;
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [inviteStates, setInviteStates] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [shareSpaceVisible, setShareSpaceVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(thread.unread);

  // Group info sheet
  const [groupInfoVisible, setGroupInfoVisible] = useState(false);
  const [groupInfoMembers, setGroupInfoMembers] = useState<{id: string; name: string; initials: string}[]>([]);
  const [groupInfoPlan, setGroupInfoPlan] = useState<{title: string; location: string; time: string; emoji?: string; temp?: number} | null>(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [creatorLeaveConfirm, setCreatorLeaveConfirm] = useState(false);
  const infoSheetY = useRef(new Animated.Value(700)).current;

  const openGroupInfo = async () => {
    if (!groupThread || !isRealThread) return;
    setGroupInfoMembers([]);
    setGroupInfoPlan(null);
    setCreatorLeaveConfirm(false);
    setGroupInfoVisible(true);
    onModalChange?.(true);
    infoSheetY.setValue(700);
    Animated.spring(infoSheetY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 12 }).start();
    const members = await getGroupMembers(thread.id);
    setGroupInfoMembers(members);
    if (groupThread.planId) {
      const plan = await getPlanById(groupThread.planId);
      if (plan) {
        const snap = plan.weather_snapshot as any;
        setGroupInfoPlan({
          title: plan.title,
          location: plan.location,
          time: plan.time,
          emoji: snap?.emoji,
          temp: snap?.temp,
        });
      }
    }
  };

  const closeGroupInfo = () => {
    Animated.spring(infoSheetY, { toValue: 700, useNativeDriver: true, tension: 50, friction: 12 }).start(() => {
      setGroupInfoVisible(false);
      setGroupInfoPlan(null);
      setCreatorLeaveConfirm(false);
    });
    onModalChange?.(false);
  };

  const handleLeaveGroup = async () => {
    if (leavingGroup || !user) return;
    if (isCreator && groupThread?.planId && !creatorLeaveConfirm) {
      setCreatorLeaveConfirm(true);
      return;
    }
    setLeavingGroup(true);
    try {
      if (groupThread?.planId) {
        await leavePlan(groupThread.planId, user.id);
      }
      await leaveGroup(thread.id, user.id);
      setGroupInfoVisible(false);
      onModalChange?.(false);
      showToast('You left the plan');
      onBack();
    } catch {
      showToast('Connection error — check your internet');
    } finally {
      setLeavingGroup(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showToast('Photo library access denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setMessages(prev => [...prev, {
        id: `m_${Date.now()}`,
        sender: 'ME',
        senderName: 'You',
        text: '',
        time: 'now',
        imageUri: uri,
      }]);
    }
  };
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to bottom on open
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 120);
  }, []);

  // Scroll to bottom whenever messages or typing indicator change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, isTyping]);

  // Load message history for real threads (DM and group)
  useEffect(() => {
    if (!isRealThread || !user) return;
    if (isDM) {
      getMessages(user.id, thread.id).then(data => {
        setMessages(data.map(msg => ({
          id: msg.id,
          sender: msg.sender_id === user.id ? 'ME' : (dm?.initials ?? '??'),
          senderName: msg.sender_id === user.id ? 'You' : (dm?.name ?? 'User'),
          text: msg.content,
          time: formatTime(msg.created_at),
        })));
        setLoadingMessages(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      });
    } else {
      getGroupMessages(thread.id).then(data => {
        setMessages(data.map(msg => ({
          id: msg.id,
          sender: msg.sender_id === user.id ? 'ME' : (msg.sender?.avatar_initials ?? msg.sender_id.slice(0, 2).toUpperCase()),
          senderName: msg.sender_id === user.id ? 'You' : (msg.sender?.full_name?.split(' ')[0] ?? 'Member'),
          text: msg.content,
          time: formatTime(msg.created_at),
          isSystem: msg.content.startsWith('📢 '),
        })));
        setLoadingMessages(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      });
    }
  }, [isRealThread, isDM, user?.id, thread.id]);

  // Realtime subscription for real DB threads
  useEffect(() => {
    if (!isRealThread || !user) return;

    let unsubscribe: (() => void) | null = null;

    if (isDM) {
      unsubscribe = subscribeToMessages(user.id, (msg: Message) => {
        // Filter to messages only in this thread
        const isThisThread =
          (msg.sender_id === user.id && msg.receiver_id === thread.id) ||
          (msg.sender_id === thread.id && msg.receiver_id === user.id);
        if (!isThisThread) return;

        // Own messages already shown optimistically — skip
        if (msg.sender_id === user.id) return;

        // Show typing indicator, then reveal incoming message
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: msg.id,
            sender: dm?.initials ?? '??',
            senderName: dm?.name ?? 'User',
            text: msg.content,
            time: formatTime(msg.created_at),
          }]);
        }, 1200);
      });
    } else {
      unsubscribe = subscribeToGroupMessages(thread.id, (msg: Message) => {
        if (msg.sender_id === user?.id) return;
        setMessages(prev => [...prev, {
          id: msg.id,
          sender: msg.sender_id.slice(0, 2).toUpperCase(),
          senderName: 'Member',
          text: msg.content,
          time: formatTime(msg.created_at),
          isSystem: msg.content.startsWith('📢 '),
        }]);
      });
    }

    return () => { unsubscribe?.(); };
  }, [isRealThread, user?.id, thread.id, isDM]);

  const respondToInvite = (msgId: string, response: 'accepted' | 'declined') => {
    setInviteStates(prev => ({ ...prev, [msgId]: response }));
  };

  const addReaction = (msgId: string, emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] ?? {}),
        [emoji]: ((prev[msgId] ?? {})[emoji] ?? 0) + 1,
      },
    }));
  };

  const sendMessage = async (text?: string, loc?: LocationData) => {
    const body = text ?? inputText.trim();
    if (!body && !loc) return;

    // Stable ID for this optimistic message so we can remove it on failure
    const optId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Optimistic append — appears immediately before network round-trip
    setMessages(prev => [...prev, {
      id: optId,
      sender: 'ME',
      senderName: 'You',
      text: body,
      time: 'now',
      location: loc,
    }]);
    if (!loc) setInputText('');

    // Persist to DB — on failure roll back the optimistic message
    if (isRealThread && user) {
      const { error } = isDM
        ? await dbSendMessage(user.id, thread.id, body)
        : await dbSendGroupMessage(user.id, thread.id, body);

      if (error) {
        setMessages(prev => prev.filter(m => m.id !== optId));
        showToast('Failed to send');
      }
    }
  };

  const sendSpace = (space: typeof CAMPUS_SPACES_SHARE[0]) => {
    setShareSpaceVisible(false);
    onModalChange?.(false);
    sendMessage('', { name: space.name, status: space.status, weather: space.weather });
  };

  const headerSub = isDM
    ? (dm!.online ? '🟢 Online now' : '⚫ Offline')
    : `${(thread as GroupThread).memberCount} members`;

  const D = dark ? {
    threadBg: '#001233', headerBg: '#001845', headerBorder: 'rgba(255,255,255,0.12)',
    backBg: 'rgba(255,255,255,0.1)', backIcon: '#FFFFFF' as string,
    nameColor: '#FFFFFF', subColor: 'rgba(255,255,255,0.55)',
    inputBarBg: '#001845', inputBarBorder: 'rgba(255,255,255,0.12)',
    btnBg: '#002060', btnBorder: 'rgba(255,255,255,0.15)',
    inputBg: '#002060', inputBorder: 'rgba(255,255,255,0.15)',
    inputText: '#FFFFFF' as string, inputPlaceholder: 'rgba(255,255,255,0.35)',
    reactionBg: '#001845', reactionBorder: 'rgba(255,255,255,0.2)',
    sheetBg: '#001845', sheetBorder: 'rgba(255,255,255,0.15)',
    sheetTitle: 'rgba(255,255,255,0.55)', sheetRowBg: '#002060',
    sheetRowBorder: 'rgba(255,255,255,0.12)', sheetName: '#FFFFFF' as string,
    pillBg: 'rgba(255,255,255,0.12)', pillBorder: 'rgba(255,255,255,0.2)',
    pillText: '#FFFFFF' as string, weatherColor: 'rgba(255,255,255,0.55)',
  } : {
    threadBg: Colors.lightGrey, headerBg: Colors.white, headerBorder: Colors.gray100,
    backBg: 'rgba(0,0,0,0.06)', backIcon: Colors.navy as string,
    nameColor: Colors.navy, subColor: Colors.gray500,
    inputBarBg: Colors.white, inputBarBorder: Colors.gray100,
    btnBg: Colors.gray100, btnBorder: Colors.gray100,
    inputBg: Colors.gray100, inputBorder: Colors.gray300,
    inputText: Colors.black as string, inputPlaceholder: Colors.gray300,
    reactionBg: Colors.white, reactionBorder: Colors.gray100,
    sheetBg: Colors.white, sheetBorder: Colors.black,
    sheetTitle: Colors.gray500, sheetRowBg: Colors.white,
    sheetRowBorder: Colors.gray100, sheetName: Colors.navy as string,
    pillBg: Colors.bluePale, pillBorder: Colors.gray100,
    pillText: Colors.navy as string, weatherColor: Colors.gray500,
  };

  return (
    <View style={[styles.thread, { backgroundColor: D.threadBg }]}>
      {/* Thread header */}
      <View style={[styles.threadHeader, { backgroundColor: D.headerBg, borderBottomColor: D.headerBorder, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: D.backBg }]} onPress={onBack} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={D.backIcon} />
        </TouchableOpacity>
        <View style={styles.threadHeaderInfo}>
          {(!isDM && isRealThread) ? (
            <TouchableOpacity onPress={openGroupInfo} activeOpacity={0.75}>
              <Text style={[styles.threadName, { color: D.nameColor }]} numberOfLines={1}>{thread.name}</Text>
              <Text style={[styles.threadSub, { color: D.subColor }]}>{headerSub} · tap for info</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={[styles.threadName, { color: D.nameColor }]} numberOfLines={1}>{thread.name}</Text>
              <Text style={[styles.threadSub, { color: D.subColor }]}>{headerSub}</Text>
            </>
          )}
        </View>
        {!isDM && (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: D.backBg }]}
            onPress={() => { setMenuVisible(true); setConfirmLeave(false); setConfirmEnd(false); onModalChange?.(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={D.backIcon} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages + input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={{ flex: 1 }}>
          {loadingMessages && (
            <View style={styles.messagesLoading}>
              <ActivityIndicator color={Colors.navy} />
            </View>
          )}
          <ScrollView
            ref={scrollRef}
            style={[styles.messageList, loadingMessages && { opacity: 0 }]}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(msg => (
              <MessageRow
                key={msg.id}
                msg={msg}
                reactions={reactions}
                isGroup={!isDM}
                onLongPress={id => { setReactionTarget(id); onModalChange?.(true); }}
                onAddReaction={addReaction}
                inviteStates={inviteStates}
                onInviteRespond={respondToInvite}
                dark={dark}
                senderAvatarUrl={isDM && msg.sender !== 'ME' ? dm?.avatarUrl : undefined}
              />
            ))}
            {isTyping && dm && (
              <View style={styles.msgRow}>
                <Avatar initials={dm.initials} size={28} uri={dm.avatarUrl} />
                <View style={[styles.bubble, dark && { backgroundColor: '#002060' }]}>
                  <TypingDots />
                </View>
              </View>
            )}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Unread indicator */}
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.unreadIndicator}
              onPress={() => {
                scrollRef.current?.scrollToEnd({ animated: true });
                setUnreadCount(0);
              }}
            >
              <Text style={styles.unreadIndicatorText}>
                ↓ {unreadCount} new message{unreadCount > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: D.inputBarBg, borderTopColor: D.inputBarBorder }]}>
          <TouchableOpacity
            style={[styles.shareSpaceBtn, { backgroundColor: D.btnBg, borderColor: D.btnBorder }]}
            onPress={() => { setShareSpaceVisible(true); onModalChange?.(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.shareSpaceIcon}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareSpaceBtn, { backgroundColor: D.btnBg, borderColor: D.btnBorder }]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={20} color={D.backIcon} />
          </TouchableOpacity>
          <TextInput
            style={[styles.chatInput, { backgroundColor: D.inputBg, color: D.inputText, borderColor: D.inputBorder }]}
            placeholder="Message..."
            placeholderTextColor={D.inputPlaceholder}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.sendArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Reaction picker modal */}
      <Modal
        visible={!!reactionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => { setReactionTarget(null); onModalChange?.(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { setReactionTarget(null); onModalChange?.(false); }}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <View style={styles.reactionOverlay} pointerEvents="box-none">
          <View style={[styles.reactionBox, { backgroundColor: D.reactionBg, borderColor: D.reactionBorder }]}>
            {REACTION_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={styles.reactionEmojiBtn}
                onPress={() => {
                  if (reactionTarget) addReaction(reactionTarget, e);
                  setReactionTarget(null);
                  onModalChange?.(false);
                }}
              >
                <Text style={styles.reactionEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Share a space modal */}
      <Modal
        visible={shareSpaceVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setShareSpaceVisible(false); onModalChange?.(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { setShareSpaceVisible(false); onModalChange?.(false); }}>
          <View style={styles.spaceSheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={[styles.spaceSheet, { backgroundColor: D.sheetBg, borderColor: D.sheetBorder }]}>
            <Text style={[styles.spaceSheetTitle, { color: D.sheetTitle }]}>SHARE A SPACE</Text>
            {CAMPUS_SPACES_SHARE.map(space => (
              <TouchableOpacity
                key={space.name}
                style={[styles.spaceSheetRow, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }]}
                onPress={() => sendSpace(space)}
                activeOpacity={0.85}
              >
                <Text style={[styles.spaceSheetName, { color: D.sheetName }]}>{space.name}</Text>
                <View style={styles.spaceSheetRight}>
                  <View style={[styles.spaceStatusPill, { backgroundColor: D.pillBg, borderColor: D.pillBorder }]}>
                    <Text style={[styles.spaceStatusText, { color: D.pillText }]}>{space.status}</Text>
                  </View>
                  <Text style={[styles.spaceWeather, { color: D.weatherColor }]}>{space.weather}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Group chat menu ─────────────────────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setMenuVisible(false); onModalChange?.(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { setMenuVisible(false); setConfirmLeave(false); setConfirmEnd(false); onModalChange?.(false); }}>
          <View style={styles.spaceSheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <View style={[styles.spaceSheet, { backgroundColor: D.sheetBg, borderColor: D.sheetBorder, paddingBottom: 32 }]}>
          <View style={styles.sheetDragHandle} />
          <Text style={[styles.spaceSheetTitle, { color: D.sheetTitle }]}>GROUP OPTIONS</Text>

          {/* Add people */}
          <TouchableOpacity
            style={[styles.menuRow, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }]}
            onPress={() => {
              setMenuVisible(false);
              setAddPeopleSelected([]);
              setAddPeopleFriends([]);
              setAddPeopleVisible(true);
              if (user) getFriends(user.id).then(setAddPeopleFriends);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add-outline" size={20} color={D.sheetName} />
            <Text style={[styles.menuRowText, { color: D.sheetName }]}>Add people</Text>
            <Ionicons name="chevron-forward" size={16} color={D.subColor as string} />
          </TouchableOpacity>

          {/* Leave chat */}
          <TouchableOpacity
            style={[styles.menuRow, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }, actioning && { opacity: 0.6 }]}
            onPress={async () => {
              if (!confirmLeave) { setConfirmLeave(true); return; }
              if (actioning || !user) return;
              setActioning(true);
              try {
                await leaveGroup(thread.id, user.id);
                setMenuVisible(false);
                onModalChange?.(false);
                showToast(`Left "${thread.name}"`);
                onBack();
              } catch {
                showToast('Connection error — check your internet');
              } finally {
                setActioning(false);
              }
            }}
            disabled={actioning}
            activeOpacity={0.85}
          >
            <Ionicons name="exit-outline" size={20} color={confirmLeave ? '#CC3333' : D.sheetName} />
            <Text style={[styles.menuRowText, { color: confirmLeave ? '#CC3333' : D.sheetName }]}>
              {confirmLeave ? 'Tap again to confirm leave' : 'Leave chat'}
            </Text>
          </TouchableOpacity>

          {/* End plan — creator only, only if linked to a plan */}
          {isCreator && planId && (
            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowDanger, actioning && { opacity: 0.6 }]}
              onPress={async () => {
                if (!confirmEnd) { setConfirmEnd(true); return; }
                if (actioning || !user) return;
                setActioning(true);
                try {
                  await cancelPlan(planId);
                  try { await sendSystemMessage(thread.id, user.id, '📢 The plan has been ended by the organiser.'); } catch { /* silent */ }
                  setMenuVisible(false);
                  onModalChange?.(false);
                  showToast('Plan ended');
                  onBack();
                } catch {
                  showToast('Connection error — check your internet');
                } finally {
                  setActioning(false);
                }
              }}
              disabled={actioning}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.menuRowText, { color: '#FFFFFF' }]}>
                {confirmEnd ? 'Tap again to confirm end' : 'End plan'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* ── Add people modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={addPeopleVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setAddPeopleVisible(false); onModalChange?.(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { setAddPeopleVisible(false); onModalChange?.(false); }}>
          <View style={styles.spaceSheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <View style={[styles.spaceSheet, { backgroundColor: D.sheetBg, borderColor: D.sheetBorder, maxHeight: '70%', paddingBottom: 0 }]}>
          <View style={styles.sheetDragHandle} />
          <Text style={[styles.spaceSheetTitle, { color: D.sheetTitle }]}>ADD PEOPLE</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {addPeopleFriends.length === 0 && (
              <ActivityIndicator color={Colors.navy} style={{ marginVertical: 24 }} />
            )}
            {addPeopleFriends.map((f: any) => {
              const initials = f.avatar_initials ?? f.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';
              const sel = addPeopleSelected.includes(f.id);
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.menuRow, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }]}
                  onPress={() => setAddPeopleSelected(prev => prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                  activeOpacity={0.85}
                >
                  <Avatar initials={initials} size={32} uri={f.avatar_url} />
                  <Text style={[styles.menuRowText, { color: D.sheetName, flex: 1 }]}>{f.full_name}</Text>
                  {sel && <Ionicons name="checkmark-circle" size={20} color={Colors.navy} />}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>
          <TouchableOpacity
            style={[styles.menuAddBtn, addingPeople && { opacity: 0.6 }]}
            onPress={async () => {
              if (addingPeople || !user || !addPeopleSelected.length) return;
              setAddingPeople(true);
              try {
                await addMembersToGroup(thread.id, addPeopleSelected);
                const names = addPeopleFriends
                  .filter((f: any) => addPeopleSelected.includes(f.id))
                  .map((f: any) => f.full_name?.split(' ')[0])
                  .join(', ');
                try { await sendSystemMessage(thread.id, user.id, `📢 ${names} ${addPeopleSelected.length === 1 ? 'was' : 'were'} added to the chat.`); } catch { /* silent */ }
                showToast(`Added ${addPeopleSelected.length} person${addPeopleSelected.length > 1 ? 's' : ''} to the chat`);
                setAddPeopleVisible(false);
                onModalChange?.(false);
              } catch {
                showToast('Connection error — check your internet');
              } finally {
                setAddingPeople(false);
              }
            }}
            disabled={addingPeople || addPeopleSelected.length === 0}
            activeOpacity={0.85}
          >
            {addingPeople
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.menuAddBtnText}>ADD {addPeopleSelected.length > 0 ? `(${addPeopleSelected.length}) ` : ''}→</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </View>
      </Modal>

      {/* ── Group info sheet ─────────────────────────────────────────────────── */}
      <Modal
        visible={groupInfoVisible}
        transparent
        animationType="none"
        onRequestClose={closeGroupInfo}
      >
        <TouchableWithoutFeedback onPress={closeGroupInfo}>
          <View style={styles.spaceSheetBackdrop} pointerEvents="box-only" />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={() => {}}>
          <Animated.View style={[styles.groupInfoSheet, { backgroundColor: D.sheetBg, borderColor: D.sheetBorder, transform: [{ translateY: infoSheetY }] }]}>
            <View style={styles.sheetDragHandle} />

            {/* Close button */}
            <TouchableOpacity style={styles.groupInfoCloseBtn} onPress={closeGroupInfo} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={18} color={D.sheetTitle as string} />
            </TouchableOpacity>

            {/* Group name */}
            <Text style={[styles.groupInfoName, { color: D.nameColor }]} numberOfLines={2}>{thread.name}</Text>
            <Text style={[styles.groupInfoSub, { color: D.subColor }]}>{(thread as GroupThread).memberCount} members</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

              {/* Linked plan */}
              {groupThread?.planId && (
                <View style={[styles.groupInfoSection, { borderColor: D.sheetRowBorder }]}>
                  <Text style={[styles.groupInfoLabel, { color: D.sheetTitle }]}>LINKED PLAN</Text>
                  {groupInfoPlan ? (
                    <View style={[styles.groupInfoPlanCard, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }]}>
                      <Text style={[styles.groupInfoPlanTitle, { color: D.sheetName }]}>{groupInfoPlan.title}</Text>
                      <Text style={[styles.groupInfoPlanMeta, { color: D.subColor }]}>
                        📍 {groupInfoPlan.location}
                      </Text>
                      {groupInfoPlan.emoji && (
                        <Text style={[styles.groupInfoPlanMeta, { color: D.subColor }]}>
                          {groupInfoPlan.emoji} {groupInfoPlan.temp}°C
                        </Text>
                      )}
                    </View>
                  ) : (
                    <ActivityIndicator color={Colors.navy} style={{ marginVertical: 12 }} />
                  )}
                </View>
              )}

              {/* Members */}
              <View style={[styles.groupInfoSection, { borderColor: D.sheetRowBorder }]}>
                <Text style={[styles.groupInfoLabel, { color: D.sheetTitle }]}>MEMBERS</Text>
                {groupInfoMembers.length === 0 ? (
                  <ActivityIndicator color={Colors.navy} style={{ marginVertical: 12 }} />
                ) : (
                  groupInfoMembers.map(m => (
                    <View key={m.id} style={[styles.groupInfoMemberRow, { backgroundColor: D.sheetRowBg, borderColor: D.sheetRowBorder }]}>
                      <Avatar initials={m.initials} size={32} uri={m.avatarUrl} />
                      <Text style={[styles.groupInfoMemberName, { color: D.sheetName }]}>{m.name}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Media */}
              <View style={[styles.groupInfoSection, { borderColor: D.sheetRowBorder }]}>
                <Text style={[styles.groupInfoLabel, { color: D.sheetTitle }]}>MEDIA</Text>
                <Text style={[styles.groupInfoNoMedia, { color: D.subColor }]}>No media shared yet</Text>
              </View>

              {/* Creator confirmation banner */}
              {creatorLeaveConfirm && (
                <View style={[styles.creatorConfirmBanner, { backgroundColor: D.sheetRowBg, borderColor: '#CC3333' }]}>
                  <Text style={[styles.creatorConfirmText, { color: D.sheetName }]}>
                    You created this plan. Leaving will not delete it for others.
                  </Text>
                  <View style={styles.creatorConfirmBtns}>
                    <TouchableOpacity
                      style={[styles.creatorCancelBtn, { borderColor: D.sheetRowBorder }]}
                      onPress={() => setCreatorLeaveConfirm(false)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.creatorCancelBtnText, { color: D.sheetName }]}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.creatorConfirmBtn}
                      onPress={handleLeaveGroup}
                      disabled={leavingGroup}
                      activeOpacity={0.85}
                    >
                      {leavingGroup
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <Text style={styles.creatorConfirmBtnText}>CONFIRM LEAVE</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Leave group button */}
            {!creatorLeaveConfirm && (
              <TouchableOpacity
                style={[styles.leaveGroupBtn, leavingGroup && { opacity: 0.6 }]}
                onPress={handleLeaveGroup}
                disabled={leavingGroup}
                activeOpacity={0.85}
              >
                {leavingGroup
                  ? <ActivityIndicator size="small" color="#CC3333" />
                  : <Text style={styles.leaveGroupBtnText}>LEAVE GROUP</Text>
                }
              </TouchableOpacity>
            )}

            <View style={{ height: 32 }} />
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ─── Group row ────────────────────────────────────────────────────────────────
function GroupRow({ group, onPress }: { group: GroupThread; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chatCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.chatCardLeft}>
        <AvatarCluster initials={group.memberInitials} />
      </View>
      <View style={styles.chatCardContent}>
        <View style={styles.chatCardTop}>
          <Text style={styles.chatCardName} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.chatCardTime}>{group.lastTime}</Text>
        </View>
        <Text style={styles.chatCardSub} numberOfLines={1}>
          {group.memberCount} members
        </Text>
        <Text style={[styles.chatCardPreview, group.unread > 0 && styles.chatCardPreviewBold]} numberOfLines={1}>
          {group.lastMsg}
        </Text>
      </View>
      {group.unread > 0 && <UnreadBadge count={group.unread} />}
    </TouchableOpacity>
  );
}

// ─── DM row ───────────────────────────────────────────────────────────────────
function DMRow({ dm, onPress }: { dm: DMThread; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chatCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.dmAvatarWrap}>
        <Avatar initials={dm.initials} size={44} free={dm.online} uri={dm.avatarUrl} />
        {dm.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.chatCardContent}>
        <View style={styles.chatCardTop}>
          <Text style={styles.chatCardName} numberOfLines={1}>{dm.name}</Text>
          <Text style={styles.chatCardTime}>{dm.lastTime}</Text>
        </View>
        <Text style={[
          styles.chatCardPreview,
          dm.unread > 0 && styles.chatCardPreviewBold,
          dm.isNew && styles.chatCardPreviewNew,
        ]} numberOfLines={1}>
          {dm.lastMsg}
        </Text>
      </View>
      {dm.unread > 0 && <UnreadBadge count={dm.unread} />}
    </TouchableOpacity>
  );
}

// ─── Friend search ────────────────────────────────────────────────────────────
function FriendSearch({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<User[]>([]);
  const [loading, setLoading]           = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds]       = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds]     = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFriends(currentUserId).then(fs =>
      setFriendIds(new Set(fs.map(f => f.id)))
    );
    getSentFriendRequests(currentUserId).then(reqs =>
      setPendingIds(prev => new Set([...prev, ...(reqs as any[]).map((r: any) => r.friend_id)]))
    );
    getFriendRequests(currentUserId).then(reqs =>
      setPendingIds(prev => new Set([...prev, ...(reqs as any[]).map((r: any) => r.user_id)]))
    );
  }, [currentUserId]);

  const handleQuery = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchUsers(q, currentUserId);
      setResults(res); // currentUserId already excluded at DB level
      setLoading(false);
    }, 400);
  };

  const addFriend = async (targetId: string) => {
    try {
      await sendFriendRequest(currentUserId, targetId);
      setSentRequests(prev => new Set([...prev, targetId]));
    } catch {}
  };

  const isSearching = query.length >= 2;

  return (
    <View style={styles.searchWrap}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search people to add..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={query}
          onChangeText={handleQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => { setQuery(''); setResults([]); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results panel */}
      {isSearching && (
        <View style={styles.searchResults}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.searchLoading} />
          ) : results.length === 0 ? (
            <Text style={styles.searchEmpty}>No users found</Text>
          ) : (
            results.map(u => {
              const isFriend   = friendIds.has(u.id);
              const isJustSent = sentRequests.has(u.id);
              const isPending  = !isJustSent && pendingIds.has(u.id);
              const initials   = u.avatar_initials ||
                u.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={u.id} style={styles.searchResultRow}>
                  <Avatar initials={initials} size={40} uri={u.avatar_url} />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{u.full_name}</Text>
                    <Text style={styles.searchResultEmail} numberOfLines={1}>{u.email}</Text>
                  </View>
                  {isFriend ? (
                    <View style={[styles.searchBadge, styles.searchBadgeFriends]}>
                      <Text style={styles.searchBadgeFriendsText}>FRIENDS ✓</Text>
                    </View>
                  ) : isJustSent ? (
                    <View style={[styles.searchBadge, styles.searchBadgeSent]}>
                      <Text style={styles.searchBadgeSentText}>REQUEST SENT ✓</Text>
                    </View>
                  ) : isPending ? (
                    <View style={[styles.searchBadge, styles.searchBadgePending]}>
                      <Text style={styles.searchBadgePendingText}>PENDING</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.searchAddBtn}
                      onPress={() => addFriend(u.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.searchAddBtnText}>ADD FRIEND</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Friend requests tab ─────────────────────────────────────────────────────
function FriendRequestsTab({
  requests, acceptedIds, onAccept, onDecline,
}: {
  requests: any[];
  acceptedIds: Set<string>;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <View style={styles.requestsEmpty}>
        <Text style={styles.requestsEmptyText}>No pending requests</Text>
      </View>
    );
  }

  const pending  = requests.filter(r => !acceptedIds.has(r.id));
  const accepted = requests.filter(r =>  acceptedIds.has(r.id));
  const all = [...pending, ...accepted];

  return (
    <>
      {all.map(req => {
        const isAccepted = acceptedIds.has(req.id);
        const friend = req.friend;
        const initials = friend?.avatar_initials ||
          (friend?.full_name ?? '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <View key={req.id} style={styles.requestRow}>
            <Avatar initials={initials} size={44} uri={friend?.avatar_url} />
            <View style={styles.requestInfo}>
              <Text style={styles.requestName}>{friend?.full_name ?? 'Unknown User'}</Text>
              <Text style={styles.requestEmail} numberOfLines={1}>{friend?.email ?? ''}</Text>
            </View>
            {isAccepted ? (
              <View style={styles.requestAcceptedBadge}>
                <Text style={styles.requestAcceptedText}>✓ Friends</Text>
              </View>
            ) : (
              <View style={styles.requestBtnRow}>
                <TouchableOpacity
                  style={styles.requestDeclineBtn}
                  onPress={() => onDecline(req.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.requestDeclineBtnText}>DECLINE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.requestAcceptBtn}
                  onPress={() => onAccept(req.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.requestAcceptBtnText}>ACCEPT</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

// ─── Friends full-screen view ─────────────────────────────────────────────────
function FriendsView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);
  const bg = dark ? DarkTheme.bg : Colors.lightGrey;
  const textPrimary = dark ? DarkTheme.text : '#001845';
  if (!user) return null;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <View style={[styles.subViewHeader, { backgroundColor: bg, borderBottomColor: dark ? DarkTheme.border : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: dark ? DarkTheme.surface : '#ECEEF3' }]} onPress={onBack} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.subViewTitle, { color: textPrimary }]}>Add Friends</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <FriendSearch currentUserId={user.id} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-view tracking for swipe disable ─────────────────────────────────────
export const chatNavRef = { inSubView: false };

// ─── Chat screen ──────────────────────────────────────────────────────────────
export default function ChatScreen({ onModalChange }: { onModalChange?: (open: boolean) => void }) {
  const [_viewStack, _setViewStack] = useState<string[]>(['main']);
  const currentView = _viewStack[_viewStack.length - 1];
  const pushView = (view: string) => {
    chatNavRef.inSubView = true;
    if (view === 'thread') setChatBadge(0);
    _setViewStack(p => [...p, view]);
  };
  const popView = () => {
    _setViewStack(p => {
      const next = p.length > 1 ? p.slice(0, -1) : p;
      chatNavRef.inSubView = next.length > 1;
      return next;
    });
  };
  const { user } = useAuth();
  const [activeTab, setActiveTab]         = useState<'groups' | 'dms' | 'requests'>('groups');
  const [dmConvos, setDmConvos]           = useState<DMThread[]>([]);
  const [loadingDms, setLoadingDms]       = useState(false);
  const [groupConvos, setGroupConvos]     = useState<GroupThread[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [requests, setRequests]           = useState<any[]>([]);
  const [acceptedIds, setAcceptedIds]     = useState<Set<string>>(new Set());
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const selectedThreadRef = useRef<Thread | null>(null);
  useEffect(() => { selectedThreadRef.current = selectedThread; }, [selectedThread]);

  const [chatBadge, setChatBadge] = useState(0);

  // Subscribe to all incoming DMs for tab badge tracking
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIncomingDMs(user.id, (msg) => {
      // Only increment if the user isn't currently in that sender's thread
      if (selectedThreadRef.current?.id !== msg.sender_id) {
        setChatBadge(prev => prev + 1);
      }
    });
    return unsub;
  }, [user?.id]);

  // Broadcast badge count to tab bar
  useEffect(() => {
    notifyChatUnreadCount(chatBadge);
  }, [chatBadge]);

  // Load DM conversation list — every friend appears, even with no messages yet
  const refetchDms = useCallback(async () => {
    if (!user) return;
    setLoadingDms(true);
    try {
      const [msgs, friends] = await Promise.all([getDMs(user.id), getFriends(user.id)]);

      // Build a map: friendId → their last message (msgs are DESC by created_at)
      const lastMsgByFriend = new Map<string, any>();
      for (const msg of msgs) {
        const otherId = msg.sender_id === user.id ? (msg as any).receiver_id : msg.sender_id;
        if (otherId && !lastMsgByFriend.has(otherId)) lastMsgByFriend.set(otherId, msg);
      }

      // One thread per friend, regardless of whether they've messaged yet
      const threads: DMThread[] = friends.map(friend => {
        const last = lastMsgByFriend.get(friend.id);
        const firstName = friend.full_name?.split(' ')[0] ?? 'there';
        const initials = friend.avatar_initials ??
          friend.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';
        return {
          type: 'dm',
          id: friend.id,
          name: friend.full_name ?? 'Unknown',
          initials,
          avatarUrl: friend.avatar_url ?? null,
          online: friend.is_online ?? false,
          lastMsg: last ? (last as any).content : `Say hi to ${firstName} 👋`,
          lastTime: last ? formatTimestamp((last as any).created_at) : '',
          unread: 0,
          isNew: !last,
        };
      });

      // Sort: threads with messages first (most recent), new friends at the bottom
      threads.sort((a, b) => {
        if (a.isNew && !b.isNew) return 1;
        if (!a.isNew && b.isNew) return -1;
        return 0;
      });

      setDmConvos(threads);
    } catch {
      // silent
    } finally {
      setLoadingDms(false);
    }
  }, [user?.id]);

  useEffect(() => { refetchDms(); }, [refetchDms]);

  const refetchGroups = useCallback(async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const raw = await getGroupsForUser(user.id);
      setGroupConvos(raw.map(g => ({
        type: 'group' as const,
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        memberInitials: g.memberInitials,
        lastMsg: g.lastMsg,
        lastTime: formatTimestamp(g.lastTime),
        unread: 0,
        messages: [],
        planId: g.planId ?? null,
        planCreatorId: g.planCreatorId ?? null,
      })));
    } catch {
      // silent
    } finally {
      setLoadingGroups(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refetchGroups();
    if (!user?.id) return;
    // When a new group_members row arrives for this user, pull the updated group list
    return subscribeToGroupMemberships(user.id, () => refetchGroups());
  }, [refetchGroups]);

  // Fetch incoming friend requests on mount + realtime subscription for instant updates
  useEffect(() => {
    if (!user) return;
    // Initial load
    getFriendRequests(user.id).then(data => setRequests((data ?? []) as any[]));
    // Realtime: new requests appear instantly without polling
    const unsub = subscribeToFriendRequests(user.id, (req) => {
      setRequests(prev => {
        if (prev.some((r: any) => r.id === req.id)) return prev;
        return [req as any, ...prev];
      });
    });
    return unsub;
  }, [user?.id]);

  const handleAccept = async (id: string) => {
    try {
      await acceptFriendRequest(id);
      setAcceptedIds(prev => new Set([...prev, id]));
      await refetchDms();
      setActiveTab('dms');
    } catch {}
  };

  const handleDecline = (id: string) => {
    setRequests(prev => prev.filter((r: any) => r.id !== id));
    declineFriendRequest(id);
  };

  const requestCount = requests.filter((r: any) => !acceptedIds.has(r.id)).length;

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchDms(),
      refetchGroups(),
      user ? getFriendRequests(user.id).then(data => setRequests((data ?? []) as any[])) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refetchDms, refetchGroups, user?.id]);

  const [dark, setDarkMode] = useState(isDark());
  useEffect(() => subscribeTheme(() => setDarkMode(isDark())), []);

  // Register reset so tab bar can pop back to main list
  useEffect(() => registerTabReset(3, () => {
    chatNavRef.inSubView = false;
    _setViewStack(['main']);
  }), []);

  const bg = dark ? DarkTheme.bg : Colors.lightGrey;
  const surface = dark ? DarkTheme.surface : '#ECEEF3';
  const textPrimary = dark ? DarkTheme.text : '#001845';
  const textMuted = dark ? DarkTheme.textMuted : Colors.gray500;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  if (currentView === 'thread' && selectedThread) {
    return (
      <ChatThread
        thread={selectedThread}
        onBack={() => { popView(); refetchDms(); refetchGroups(); }}
        dark={dark}
        onModalChange={onModalChange}
      />
    );
  }

  if (currentView === 'friends') {
    return <FriendsView onBack={popView} />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.screenHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: textMuted }]}>{greeting}</Text>
          <Text style={[styles.appName, { color: textPrimary }]}>IMPERIAL</Text>
        </View>
        <TouchableOpacity
          style={[styles.bellBtn, dark && { backgroundColor: surface, borderColor: DarkTheme.border }]}
          onPress={() => pushView('friends')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={22} color={textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Add new row ── */}
      <View style={styles.addRow}>
        <Text style={[styles.addLabel, { color: textPrimary }]}>Add new</Text>
        <TouchableOpacity style={styles.addCircleBtn} onPress={() => pushView('friends')} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Friends icon + Groups / Direct toggle ── */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => { setActiveTab('requests'); }}
          activeOpacity={0.8}
          style={styles.friendsIconBtn}
        >
          <Ionicons name="people" size={28} color={textPrimary} />
          {requestCount > 0 && (
            <View style={styles.friendsIconBadge}>
              <Text style={styles.friendsIconBadgeText}>{requestCount > 9 ? '9+' : requestCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Pill segmented control */}
        <View style={[styles.segmented, { backgroundColor: surface }]}>
          {(['groups', 'dms'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.segment, activeTab === tab && styles.segmentActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
                {tab === 'groups' ? 'Groups' : 'Direct'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Chat list / requests ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={dark ? '#FFFFFF' : '#001845'}
            colors={['#001845']}
          />
        }
      >
        {activeTab === 'requests' ? (
          <>
            <Text style={[styles.listSectionLabel, { color: textMuted }]}>FRIEND REQUESTS</Text>
            <FriendRequestsTab
              requests={requests}
              acceptedIds={acceptedIds}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </>
        ) : activeTab === 'groups' ? (
          loadingGroups ? (
            <ActivityIndicator color={Colors.navy} style={{ marginTop: 40 }} />
          ) : groupConvos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: textPrimary }]}>No group chats yet.</Text>
              <Text style={[styles.emptyStateHint, { color: textMuted }]}>
                Create a plan with friends to start a group chat.
              </Text>
            </View>
          ) : (
            groupConvos.map(g => (
              <GroupRow key={g.id} group={g} onPress={() => { setSelectedThread(g); pushView('thread'); }} />
            ))
          )
        ) : loadingDms ? (
          <ActivityIndicator color="#001845" style={{ marginTop: 40 }} />
        ) : dmConvos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: textPrimary }]}>No messages yet.</Text>
            <Text style={[styles.emptyStateHint, { color: textMuted }]}>
              Add friends and start a conversation.
            </Text>
          </View>
        ) : (
          dmConvos.map(d => (
            <DMRow key={d.id} dm={d} onPress={() => { setSelectedThread(d); pushView('thread'); }} />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAVY = '#001845';

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
    marginBottom: 8,
  },
  greeting: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  appName: {
    fontSize: 30,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Add new row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  addLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  addCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter row (friends icon + segmented control)
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 14,
  },
  friendsIconBtn: {
    position: 'relative',
    padding: 4,
  },
  friendsIconBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  friendsIconBadgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },

  // Pill segmented control (Groups / Direct)
  segmented: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: NAVY,
  },
  segmentText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.gray500,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.black,
  },

  // Section label above requests list
  listSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    marginBottom: 14,
    marginTop: 4,
  },

  // List
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Dark navy chat card (shared by group + DM rows)
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 10,
    gap: 14,
  },
  chatCardLeft: { flexShrink: 0 },
  chatCardContent: { flex: 1 },
  chatCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  chatCardName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  chatCardTime: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: Typography.weights.medium,
    flexShrink: 0,
  },
  chatCardSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: Typography.weights.medium,
    marginBottom: 2,
  },
  chatCardPreview: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: Typography.weights.medium,
  },
  chatCardPreviewBold: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.bold,
  },
  chatCardPreviewNew: {
    color: Colors.blueMuted,
    fontStyle: 'italic',
  },

  // DM avatar wrap
  dmAvatarWrap: { position: 'relative', flexShrink: 0 },
  onlineDot: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: NAVY,
  },

  // Avatar (used in cluster + chat thread)
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { fontWeight: Typography.weights.black },

  // Avatar cluster
  avatarCluster: { height: 36, position: 'relative', flexShrink: 0 },
  clusterSlot: { position: 'absolute', top: 4 },

  // Unread badge
  unreadBadge: {
    minWidth: 20, height: 20,
    borderRadius: 10,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
  },

  // Sub-view header (Add Friends screen)
  subViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subViewTitle: {
    fontSize: 20,
    fontWeight: Typography.weights.black,
    letterSpacing: -0.3,
  },

  // Empty states
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  emptyStateText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
  },
  emptyStateHint: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  emptyStateBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Thread layout
  thread: { flex: 1, backgroundColor: Colors.lightGrey },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    backgroundColor: Colors.white,
    gap: 12,
  },
  backArrow: {
    fontSize: 18,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  threadHeaderInfo: { flex: 1 },
  threadName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  threadSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },

  // Message list
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Message rows
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgCol: { flex: 1, maxWidth: '78%' },
  msgColMe: { alignItems: 'flex-end' },
  msgSender: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    color: Colors.gray500,
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  // Bubbles
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.white,
  },
  bubbleImage: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  bubbleMe: {
    backgroundColor: NAVY,
  },
  bubbleOther: {
    backgroundColor: Colors.white,
  },
  bubbleText: {
    fontSize: Typography.sizes.sm,
    color: Colors.black,
    lineHeight: 20,
    fontWeight: Typography.weights.medium,
  },
  bubbleTextMe: { color: Colors.white },
  bubbleTime: {
    fontSize: 9,
    color: Colors.gray500,
    marginTop: 5,
    fontWeight: Typography.weights.medium,
  },
  bubbleTimeMe: { color: Colors.blueMuted, textAlign: 'right' },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 4,
  },

  // System message
  systemRow: {
    alignItems: 'center',
    marginVertical: 14,
    paddingHorizontal: 24,
  },
  systemText: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Plan pill
  planPill: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  planPillTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planPillTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    flex: 1,
  },
  planPillWeather: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  planPillMeta: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    marginBottom: 10,
  },
  planPillJoin: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  planPillJoinText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.white,
  },

  // Location card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bluePale,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  locationPin: { fontSize: 20 },
  locationInfo: { flex: 1 },
  locationName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  locationStatus: {
    fontSize: 11,
    color: Colors.blue,
    fontWeight: Typography.weights.medium,
  },

  // Invite card
  inviteCard: {
    backgroundColor: Colors.bluePale,
    borderRadius: 14,
    padding: 14,
    marginBottom: 2,
    maxWidth: 280,
  },
  inviteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  inviteCardLabel: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },
  inviteCardWeather: { fontSize: 10, color: Colors.gray500, fontWeight: Typography.weights.medium },
  inviteCardTitle: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.3, marginBottom: 3 },
  inviteCardMeta: { fontSize: 11, color: Colors.blue, fontWeight: Typography.weights.medium, marginBottom: 12 },
  inviteBtnRow: { flexDirection: 'row', gap: 8 },
  inviteDeclineBtn: {
    flex: 1,
    borderWidth: 1, borderColor: Colors.gray300,
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
    backgroundColor: Colors.white,
  },
  inviteDeclineBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray700 },
  inviteAcceptBtn: {
    flex: 2,
    backgroundColor: NAVY,
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  inviteAcceptBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },
  inviteAccepted: {
    backgroundColor: Colors.greenLight,
    borderWidth: 1, borderColor: Colors.green,
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  inviteAcceptedText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.green },
  inviteDeclined: {
    backgroundColor: Colors.gray100,
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  inviteDeclinedText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray500 },

  // Typing dots
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  typingDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: Colors.blueMuted,
  },

  // Reaction strip
  reactionStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  reactionPill: {
    backgroundColor: Colors.bluePale,
    borderWidth: 1.5,
    borderColor: Colors.black,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionPillText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.navy,
  },

  // Reaction picker overlay
  reactionOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  reactionEmojiBtn: {
    width: 52, height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  reactionEmoji: { fontSize: 28 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    backgroundColor: Colors.white,
  },
  shareSpaceBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
    flexShrink: 0,
  },
  shareSpaceIcon: { fontSize: 18 },
  chatInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
    maxHeight: 100,
    backgroundColor: Colors.gray100,
  },
  sendBtn: {
    width: 44, height: 44,
    backgroundColor: NAVY,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendArrow: {
    fontSize: 18,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },

  // Unread scroll indicator
  unreadIndicator: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: NAVY,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unreadIndicatorText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.white,
  },

  // Share space sheet
  spaceSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  spaceSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.gray100,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  spaceSheetTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 3,
    color: Colors.gray500,
    marginBottom: 16,
  },
  spaceSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  spaceSheetName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  spaceSheetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spaceStatusPill: {
    backgroundColor: Colors.bluePale,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  spaceStatusText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.navy,
  },
  spaceWeather: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },

  // ── Friend search ──────────────────────────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#002060',
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: '#FFFFFF',
    padding: 0,
  },
  searchClear: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: Typography.weights.bold,
  },
  searchResults: {
    marginTop: 8,
    gap: 6,
  },
  searchLoading: { paddingVertical: 24 },
  searchEmpty: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#002060',
    borderRadius: 14,
    gap: 12,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  searchResultEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: Typography.weights.medium,
  },
  searchBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 0,
  },
  searchBadgeFriends: {
    backgroundColor: 'rgba(52,199,89,0.2)',
  },
  searchBadgeFriendsText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: '#34C759',
  },
  searchBadgeSent: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  searchBadgeSentText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.7)',
  },
  searchBadgePending: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchBadgePendingText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.5)',
  },
  searchAddBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  searchAddBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: '#001845',
  },

  // ── Requests tab badge ─────────────────────────────────────────────────────
  tabWithBadge: { flexDirection: 'row', alignItems: 'center' },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.red,
    borderWidth: 1.5,
    borderColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 5,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },

  // ── DM list empty / loading ────────────────────────────────────────────────
  dmsEmpty: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  dmsEmptyText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  dmsEmptyHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Chat thread loading ────────────────────────────────────────────────────
  messagesLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  // ── Friend requests list ───────────────────────────────────────────────────
  requestsEmpty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  requestsEmptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  requestInfo: { flex: 1 },
  requestName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  requestEmail: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  requestBtnRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  requestDeclineBtn: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.white,
  },
  requestDeclineBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.gray700,
  },
  requestAcceptBtn: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  requestAcceptBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.white,
  },
  requestAcceptedBadge: {
    backgroundColor: Colors.greenLight,
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  requestAcceptedText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: Colors.green,
  },

  // ── Group chat menu ────────────────────────────────────────────────────────
  sheetDragHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray300,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  menuRowDanger: {
    backgroundColor: '#CC3333',
    borderColor: '#CC3333',
  },
  menuRowText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    flex: 1,
  },
  menuAddBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 0,
  },
  menuAddBtnText: {
    fontSize: 12,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },

  // ── Groups empty state ─────────────────────────────────────────────────────
  groupsEmpty: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  groupsEmptyText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
  },
  groupsCreateBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  groupsCreateBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.white,
  },

  // ── Group info sheet ───────────────────────────────────────────────────────
  groupInfoSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.gray100,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  groupInfoCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfoName: {
    fontSize: 22,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 4,
    paddingRight: 36,
  },
  groupInfoSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    marginBottom: 20,
  },
  groupInfoSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
    paddingBottom: 16,
    marginBottom: 16,
  },
  groupInfoLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 2.5,
    color: Colors.gray500,
    marginBottom: 10,
  },
  groupInfoPlanCard: {
    backgroundColor: Colors.bluePale,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  groupInfoPlanTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  groupInfoPlanMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  groupInfoMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  groupInfoMemberName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.navy,
    flex: 1,
  },
  groupInfoNoMedia: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    fontStyle: 'italic',
    fontWeight: Typography.weights.medium,
    paddingVertical: 8,
  },
  leaveGroupBtn: {
    borderWidth: 1.5,
    borderColor: '#CC3333',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  leaveGroupBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: '#CC3333',
  },
  creatorConfirmBanner: {
    borderWidth: 1.5,
    borderColor: '#CC3333',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    gap: 12,
  },
  creatorConfirmText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.navy,
    lineHeight: 20,
  },
  creatorConfirmBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  creatorCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  creatorCancelBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.navy,
  },
  creatorConfirmBtn: {
    flex: 2,
    backgroundColor: '#CC3333',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  creatorConfirmBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
});

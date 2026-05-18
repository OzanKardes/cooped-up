import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, TextInput, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackArrow from '../../components/ui/BackArrow';
import { Colors, Typography, Borders, Shadows } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
  getDMs, getMessages,
  sendMessage as dbSendMessage,
  sendGroupMessage as dbSendGroupMessage,
  subscribeToMessages,
  subscribeToGroupMessages,
} from '../../services/messages';
import type { Message, User } from '../../types';
import {
  searchUsers, sendFriendRequest, getFriends,
  getFriendRequests, getSentFriendRequests,
  acceptFriendRequest, declineFriendRequest,
} from '../../services/friends';

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
}

interface DMThread {
  type: 'dm';
  id: string;
  name: string;
  initials: string;
  online: boolean;
  lastMsg: string;
  lastTime: string;
  unread: number;
}

type Thread = GroupThread | DMThread;

const REACTION_EMOJIS = ['👍', '🔥', '😂', '✅'];

const CAMPUS_SPACES_SHARE = [
  { name: "Queen's Lawn", status: 'BUSY', weather: '☀️ 20°C' },
  { name: 'Beit Quad', status: 'QUIET', weather: '⛅ 18°C' },
  { name: 'SAF Terrace', status: 'EMPTY', weather: '🌤 19°C' },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ initials, size = 32, free = false }: {
  initials: string; size?: number; free?: boolean;
}) {
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
  msg, reactions, isGroup, onLongPress, onAddReaction, inviteStates, onInviteRespond,
}: {
  msg: ChatMessage;
  reactions: Record<string, Record<string, number>>;
  isGroup: boolean;
  onLongPress: (id: string) => void;
  onAddReaction: (id: string, emoji: string) => void;
  inviteStates: Record<string, 'accepted' | 'declined'>;
  onInviteRespond: (id: string, response: 'accepted' | 'declined') => void;
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

  return (
    <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
      {!isMe && <Avatar initials={msg.sender} size={28} />}
      <View style={[styles.msgCol, isMe && styles.msgColMe]}>
        {!isMe && isGroup && (
          <Text style={styles.msgSender}>{msg.senderName}</Text>
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
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
              {msg.text !== '' && (
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                  {msg.text}
                </Text>
              )}
              {msg.plan && <PlanPill plan={msg.plan} />}
              {msg.location && <LocationCard loc={msg.location} />}
              <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
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
function ChatThread({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const { user } = useAuth();
  const isDM = thread.type === 'dm';
  const dm = isDM ? (thread as DMThread) : null;

  // UUID-format IDs are real DB threads; hardcoded IDs start with 'd'/'g'
  const isRealThread = thread.id.includes('-');

  const [messages, setMessages] = useState<ChatMessage[]>(
    isDM ? [] : [...(thread as GroupThread).messages]
  );
  const [loadingMessages, setLoadingMessages] = useState(isRealThread && isDM);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [inviteStates, setInviteStates] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [shareSpaceVisible, setShareSpaceVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(thread.unread);
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to bottom on open
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 120);
  }, []);

  // Scroll to bottom whenever messages or typing indicator change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, isTyping]);

  // Load message history for real DM threads
  useEffect(() => {
    if (!isRealThread || !isDM || !user) return;
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
        // Own messages already shown optimistically — skip
        if (msg.sender_id === user?.id) return;

        setMessages(prev => [...prev, {
          id: msg.id,
          sender: msg.sender_id.slice(0, 2).toUpperCase(),
          senderName: 'Member',
          text: msg.content,
          time: formatTime(msg.created_at),
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

    // Optimistic append for all threads
    setMessages(prev => [...prev, {
      id: `m_${Date.now()}`,
      sender: 'ME',
      senderName: 'You',
      text: body,
      time: 'now',
      location: loc,
    }]);
    if (!loc) setInputText('');

    // Real DB send
    if (isRealThread && user) {
      try {
        if (isDM) {
          await dbSendMessage(user.id, thread.id, body);
        } else {
          await dbSendGroupMessage(user.id, thread.id, body);
        }
      } catch {
        showToast('Message failed to send');
      }
    }
  };

  const sendSpace = (space: typeof CAMPUS_SPACES_SHARE[0]) => {
    setShareSpaceVisible(false);
    sendMessage('', { name: space.name, status: space.status, weather: space.weather });
  };

  const headerSub = isDM
    ? (dm!.online ? '🟢 Online now' : '⚫ Offline')
    : `${(thread as GroupThread).memberCount} members`;

  return (
    <View style={styles.thread}>
      {/* Thread header */}
      <View style={styles.threadHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.threadHeaderInfo}>
          <Text style={styles.threadName} numberOfLines={1}>{thread.name}</Text>
          <Text style={styles.threadSub}>{headerSub}</Text>
        </View>
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
                onLongPress={setReactionTarget}
                onAddReaction={addReaction}
                inviteStates={inviteStates}
                onInviteRespond={respondToInvite}
              />
            ))}
            {isTyping && dm && (
              <View style={styles.msgRow}>
                <Avatar initials={dm.initials} size={28} />
                <View style={styles.bubble}>
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
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.shareSpaceBtn}
            onPress={() => setShareSpaceVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.shareSpaceIcon}>📍</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            placeholder="Message..."
            placeholderTextColor={Colors.gray300}
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
        onRequestClose={() => setReactionTarget(null)}
      >
        <TouchableWithoutFeedback onPress={() => setReactionTarget(null)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={styles.reactionOverlay} pointerEvents="box-none">
          <View style={styles.reactionBox}>
            {REACTION_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={styles.reactionEmojiBtn}
                onPress={() => {
                  if (reactionTarget) addReaction(reactionTarget, e);
                  setReactionTarget(null);
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
        onRequestClose={() => setShareSpaceVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShareSpaceVisible(false)}>
          <View style={styles.spaceSheetBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.spaceSheet}>
          <Text style={styles.spaceSheetTitle}>SHARE A SPACE</Text>
          {CAMPUS_SPACES_SHARE.map(space => (
            <TouchableOpacity
              key={space.name}
              style={styles.spaceSheetRow}
              onPress={() => sendSpace(space)}
              activeOpacity={0.85}
            >
              <Text style={styles.spaceSheetName}>{space.name}</Text>
              <View style={styles.spaceSheetRight}>
                <View style={styles.spaceStatusPill}>
                  <Text style={styles.spaceStatusText}>{space.status}</Text>
                </View>
                <Text style={styles.spaceWeather}>{space.weather}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </Modal>
    </View>
  );
}

// ─── Group row ────────────────────────────────────────────────────────────────
function GroupRow({ group, onPress }: { group: GroupThread; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chatRow} onPress={onPress} activeOpacity={0.85}>
      <AvatarCluster initials={group.memberInitials} />
      <View style={styles.chatRowContent}>
        <View style={styles.chatRowTop}>
          <View style={styles.chatRowNameWrap}>
            <Text style={styles.chatRowName}>{group.name}</Text>
            {group.isSystem && (
              <View style={styles.systemTag}>
                <Text style={styles.systemTagText}>AUTO</Text>
              </View>
            )}
          </View>
          <View style={styles.chatRowRight}>
            <Text style={styles.chatRowTime}>{group.lastTime}</Text>
            <UnreadBadge count={group.unread} />
          </View>
        </View>
        <Text style={styles.chatRowSub}>{group.memberCount} members</Text>
        <Text
          style={[styles.chatRowPreview, group.unread > 0 && styles.chatRowPreviewUnread]}
          numberOfLines={1}
        >
          {group.lastMsg}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── DM row ───────────────────────────────────────────────────────────────────
function DMRow({ dm, onPress }: { dm: DMThread; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chatRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.dmAvatarWrap}>
        <Avatar initials={dm.initials} size={44} free={dm.online} />
        {dm.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.chatRowContent}>
        <View style={styles.chatRowTop}>
          <Text style={styles.chatRowName}>{dm.name}</Text>
          <View style={styles.chatRowRight}>
            <Text style={styles.chatRowTime}>{dm.lastTime}</Text>
            <UnreadBadge count={dm.unread} />
          </View>
        </View>
        <Text
          style={[styles.chatRowPreview, dm.unread > 0 && styles.chatRowPreviewUnread]}
          numberOfLines={1}
        >
          {dm.lastMsg}
        </Text>
      </View>
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
      const res = await searchUsers(q);
      setResults(res.filter(u => u.id !== currentUserId));
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
          placeholderTextColor={Colors.gray300}
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
            <ActivityIndicator size="small" color={Colors.navy} style={styles.searchLoading} />
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
                  <Avatar initials={initials} size={40} />
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
            <Avatar initials={initials} size={44} />
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
  if (!user) return null;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.subViewHeader}>
        <BackArrow onPress={onBack} />
        <Text style={styles.subViewTitle}>ADD FRIENDS</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <FriendSearch currentUserId={user.id} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Chat screen ──────────────────────────────────────────────────────────────
export default function ChatScreen({
  pushView, popView, currentView,
}: {
  pushView: (view: string) => void;
  popView: () => void;
  currentView: string;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab]     = useState<'groups' | 'dms' | 'requests'>('groups');
  const [dmConvos, setDmConvos]       = useState<DMThread[]>([]);
  const [loadingDms, setLoadingDms]   = useState(false);
  const [requests, setRequests]       = useState<any[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  // Load DM conversation list
  const refetchDms = useCallback(async () => {
    if (!user) return;
    setLoadingDms(true);
    try {
      const [msgs, friends] = await Promise.all([getDMs(user.id), getFriends(user.id)]);
      const friendMap = new Map(friends.map(f => [f.id, f]));
      const seen = new Set<string>();
      const threads: DMThread[] = [];
      for (const msg of msgs) {
        const otherId = msg.sender_id === user.id ? (msg as any).receiver_id : msg.sender_id;
        if (!otherId || seen.has(otherId)) continue;
        seen.add(otherId);
        const friend = friendMap.get(otherId);
        const senderData = msg.sender_id === otherId ? (msg as any).sender : null;
        threads.push({
          type: 'dm',
          id: otherId,
          name: friend?.full_name ?? senderData?.full_name ?? 'Unknown',
          initials: friend?.avatar_initials ?? senderData?.avatar_initials ?? '??',
          online: friend?.is_online ?? false,
          lastMsg: (msg as any).content,
          lastTime: formatTimestamp((msg as any).created_at),
          unread: 0,
        });
      }
      setDmConvos(threads);
    } catch {
      // silent
    } finally {
      setLoadingDms(false);
    }
  }, [user?.id]);

  useEffect(() => { refetchDms(); }, [refetchDms]);

  // Fetch incoming friend requests on mount, then every 30 seconds
  useEffect(() => {
    if (!user) return;
    const fetchReqs = () => {
      getFriendRequests(user.id).then(data => setRequests((data ?? []) as any[]));
    };
    fetchReqs();
    const interval = setInterval(fetchReqs, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleAccept = async (id: string) => {
    try {
      await acceptFriendRequest(id);
      setAcceptedIds(prev => new Set([...prev, id]));
    } catch {}
  };

  const handleDecline = (id: string) => {
    setRequests(prev => prev.filter((r: any) => r.id !== id));
    declineFriendRequest(id);
  };

  const requestCount = requests.filter((r: any) => !acceptedIds.has(r.id)).length;

  if (currentView === 'thread' && selectedThread) {
    return (
      <ChatThread
        thread={selectedThread}
        onBack={() => { popView(); refetchDms(); }}
      />
    );
  }

  if (currentView === 'friends') {
    return <FriendsView onBack={popView} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>CHAT</Text>
        <TouchableOpacity
          style={styles.addFriendsBtn}
          onPress={() => pushView('friends')}
          activeOpacity={0.85}
        >
          <Text style={styles.addFriendsBtnText}>+ FRIENDS</Text>
        </TouchableOpacity>
        {/* Tab switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
              GROUPS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dms' && styles.tabActive]}
            onPress={() => setActiveTab('dms')}
          >
            <Text style={[styles.tabText, activeTab === 'dms' && styles.tabTextActive]}>
              DMs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <View style={styles.tabWithBadge}>
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                REQUESTS
              </Text>
              {requestCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{requestCount > 9 ? '9+' : requestCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'groups'
          ? (
            <View style={styles.groupsEmpty}>
              <Text style={styles.groupsEmptyText}>No group chats yet.</Text>
              <TouchableOpacity
                style={styles.groupsCreateBtn}
                onPress={() => showToast('Group creation coming soon!')}
                activeOpacity={0.85}
              >
                <Text style={styles.groupsCreateBtnText}>CREATE GROUP</Text>
              </TouchableOpacity>
            </View>
          )
          : activeTab === 'dms'
          ? loadingDms
            ? <ActivityIndicator color={Colors.navy} style={{ marginTop: 40 }} />
            : dmConvos.length === 0
            ? (
              <View style={styles.dmsEmpty}>
                <Text style={styles.dmsEmptyText}>No messages yet.</Text>
                <Text style={styles.dmsEmptyHint}>Find friends in Search and start a conversation.</Text>
              </View>
            )
            : dmConvos.map(d => (
                <DMRow key={d.id} dm={d} onPress={() => { setSelectedThread(d); pushView('thread'); }} />
              ))
          : (
              <FriendRequestsTab
                requests={requests}
                acceptedIds={acceptedIds}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            )
        }
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  // Screen header + tab switcher
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -1,
    marginRight: 'auto',
  },
  addFriendsBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
    ...Shadows.sm,
  },
  addFriendsBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.white,
  },
  subViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: Borders.widthHeavy,
    borderBottomColor: Colors.black,
    backgroundColor: Colors.white,
    gap: 14,
    ...Shadows.sm,
  },
  subViewTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  tabActive: { backgroundColor: Colors.navy },
  tabText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 1.5,
    color: Colors.navy,
  },
  tabTextActive: { color: Colors.white },

  // List
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.black,
  },
  avatarText: { fontWeight: Typography.weights.black },

  // Avatar cluster
  avatarCluster: { height: 36, position: 'relative', flexShrink: 0 },
  clusterSlot: { position: 'absolute', top: 4 },

  // Unread badge
  unreadBadge: {
    minWidth: 18, height: 18,
    borderRadius: 9,
    backgroundColor: Colors.navy,
    borderWidth: 1.5,
    borderColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    color: Colors.white,
  },

  // Chat row (shared by group + DM)
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    ...Shadows.sm,
  },
  chatRowContent: { flex: 1 },
  chatRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatRowNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  chatRowName: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    flexShrink: 1,
  },
  chatRowSub: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
    marginBottom: 2,
  },
  chatRowPreview: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
    lineHeight: 18,
  },
  chatRowPreviewUnread: {
    color: Colors.navy,
    fontWeight: Typography.weights.bold,
  },
  chatRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatRowTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  systemTag: {
    backgroundColor: Colors.bluePale,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.black,
  },
  systemTagText: {
    fontSize: 9,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.navy,
  },

  // DM row extras
  dmAvatarWrap: { position: 'relative', flexShrink: 0 },
  onlineDot: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: Colors.green,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  // Thread layout
  thread: { flex: 1, backgroundColor: Colors.white },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: Borders.widthHeavy,
    borderBottomColor: Colors.black,
    backgroundColor: Colors.white,
    gap: 12,
    ...Shadows.sm,
  },
  backBtn: {
    width: 40, height: 40,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    flexShrink: 0,
    ...Shadows.sm,
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
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  bubbleMe: {
    backgroundColor: Colors.navy,
    borderColor: Colors.black,
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
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 12,
    marginTop: 10,
    ...Shadows.sm,
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
    backgroundColor: Colors.navy,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
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
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
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
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 2,
    maxWidth: 280,
    ...Shadows.sm,
  },
  inviteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  inviteCardLabel: { fontSize: 9, fontWeight: Typography.weights.black, letterSpacing: 2, color: Colors.navy },
  inviteCardWeather: { fontSize: 10, color: Colors.gray500, fontWeight: Typography.weights.medium },
  inviteCardTitle: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.black, color: Colors.navy, letterSpacing: -0.3, marginBottom: 3 },
  inviteCardMeta: { fontSize: 11, color: Colors.blue, fontWeight: Typography.weights.medium, marginBottom: 12 },
  inviteBtnRow: { flexDirection: 'row', gap: 8 },
  inviteDeclineBtn: {
    flex: 1,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingVertical: 8, alignItems: 'center',
    backgroundColor: Colors.white,
  },
  inviteDeclineBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.gray700 },
  inviteAcceptBtn: {
    flex: 2,
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingVertical: 8, alignItems: 'center',
    ...Shadows.sm,
  },
  inviteAcceptBtnText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.white },
  inviteAccepted: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingVertical: 8, alignItems: 'center',
  },
  inviteAcceptedText: { fontSize: 11, fontWeight: Typography.weights.black, letterSpacing: 1.5, color: Colors.green },
  inviteDeclined: {
    backgroundColor: Colors.gray100,
    borderWidth: Borders.width, borderColor: Colors.black,
    borderRadius: Borders.radiusSm, paddingVertical: 8, alignItems: 'center',
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
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radiusLg,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
    ...Shadows.md,
  },
  reactionEmojiBtn: {
    width: 52, height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Borders.radius,
  },
  reactionEmoji: { fontSize: 28 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 100,
    gap: 10,
    borderTopWidth: Borders.widthHeavy,
    borderTopColor: Colors.black,
    backgroundColor: Colors.white,
  },
  shareSpaceBtn: {
    width: 44, height: 44,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bluePale,
    flexShrink: 0,
  },
  shareSpaceIcon: { fontSize: 18 },
  chatInput: {
    flex: 1,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: Typography.sizes.md,
    color: Colors.black,
    fontWeight: Typography.weights.medium,
    maxHeight: 100,
    backgroundColor: Colors.white,
  },
  sendBtn: {
    width: 44, height: 44,
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Shadows.sm,
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
    backgroundColor: Colors.navy,
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Shadows.sm,
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: Borders.widthHeavy,
    borderLeftWidth: Borders.widthHeavy,
    borderRightWidth: Borders.widthHeavy,
    borderColor: Colors.black,
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
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 10,
    ...Shadows.sm,
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
    borderWidth: 1.5,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
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
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    ...Shadows.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.black,
    padding: 0,
  },
  searchClear: {
    fontSize: 13,
    color: Colors.gray500,
    fontWeight: Typography.weights.bold,
  },
  searchResults: {
    backgroundColor: Colors.white,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    marginTop: 8,
    overflow: 'hidden',
    ...Shadows.md,
  },
  searchLoading: { paddingVertical: 24 },
  searchEmpty: {
    fontSize: Typography.sizes.sm,
    color: Colors.gray500,
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
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gray100,
    gap: 12,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.black,
    color: Colors.navy,
    marginBottom: 2,
  },
  searchResultEmail: {
    fontSize: 11,
    color: Colors.gray500,
    fontWeight: Typography.weights.medium,
  },
  searchBadge: {
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 0,
  },
  searchBadgeFriends: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.green,
  },
  searchBadgeFriendsText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: Colors.green,
  },
  searchBadgeSent: {
    backgroundColor: Colors.accent,
    borderColor: Colors.black,
  },
  searchBadgeSentText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: Colors.navy,
  },
  searchBadgePending: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
  },
  searchBadgePendingText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 0.5,
    color: Colors.gray500,
  },
  searchAddBtn: {
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
    ...Shadows.sm,
  },
  searchAddBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.white,
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
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...Shadows.sm,
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
    borderWidth: Borders.width,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
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
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...Shadows.sm,
  },
  requestAcceptBtnText: {
    fontSize: 10,
    fontWeight: Typography.weights.black,
    letterSpacing: 1,
    color: Colors.white,
  },
  requestAcceptedBadge: {
    backgroundColor: Colors.greenLight,
    borderWidth: Borders.width,
    borderColor: Colors.green,
    borderRadius: Borders.radiusSm,
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
    backgroundColor: Colors.navy,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    ...Shadows.sm,
  },
  groupsCreateBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    letterSpacing: 2,
    color: Colors.white,
  },
});

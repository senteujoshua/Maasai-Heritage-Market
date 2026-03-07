'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Send, MessageSquare, Loader2, ArrowLeft, ChevronRight, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Message, Profile } from '@/types';

interface Conversation {
  partnerId: string;
  partner: Profile;
  lastMessage: Message;
  unreadCount: number;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>}>
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toUserId = searchParams.get('to');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeParter, setActivePartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [authLoading, profile, router]);

  // Load all conversations
  const loadConversations = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!sender_id(id, full_name, avatar_url, shop_name), receiver:profiles!receiver_id(id, full_name, avatar_url, shop_name)`)
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (!data) { setConvLoading(false); return; }

    // Group by conversation partner
    const convMap = new Map<string, Conversation>();
    for (const msg of data as unknown as Message[]) {
      const partnerId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;
      const partner = (msg.sender_id === profile.id ? msg.receiver : msg.sender) as Profile;
      if (!partner) continue;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          partnerId,
          partner,
          lastMessage: msg,
          unreadCount: (!msg.is_read && msg.receiver_id === profile.id) ? 1 : 0,
        });
      } else {
        const existing = convMap.get(partnerId)!;
        if (!msg.is_read && msg.receiver_id === profile.id) {
          existing.unreadCount += 1;
        }
      }
    }
    setConversations([...convMap.values()]);
    setConvLoading(false);
  }, [profile, supabase]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load or start conversation from ?to= param
  useEffect(() => {
    if (!profile || !toUserId) return;
    const existing = conversations.find((c) => c.partnerId === toUserId);
    if (existing) { openConversation(existing.partner); return; }
    // Fetch partner profile even if no messages yet
    supabase.from('profiles').select('*').eq('id', toUserId).single().then(({ data }) => {
      if (data) openConversation(data as Profile);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toUserId, profile, conversations.length]);

  const openConversation = useCallback(async (partner: Profile) => {
    if (!profile) return;
    setActivePartner(partner);
    setMsgLoading(true);
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!sender_id(id, full_name, avatar_url)`)
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${profile.id})`)
      .order('created_at', { ascending: true });
    setMessages((data as unknown as Message[]) ?? []);
    setMsgLoading(false);

    // Mark all received as read
    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', profile.id)
      .eq('sender_id', partner.id)
      .then(() => loadConversations());
  }, [profile, supabase, loadConversations]);

  // Realtime: new messages
  useEffect(() => {
    if (!profile || !activeParter) return;
    const channel = supabase
      .channel(`messages:${profile.id}:${activeParter.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${profile.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === activeParter.id) {
          setMessages((prev) => [...prev, msg]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, activeParter, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !activeParter || !newMessage.trim()) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: profile.id, receiver_id: activeParter.id, content })
      .select(`*, sender:profiles!sender_id(id, full_name, avatar_url)`)
      .single();

    if (error) {
      toast.error('Failed to send message');
      setNewMessage(content);
    } else {
      setMessages((prev) => [...prev, data as unknown as Message]);
      loadConversations();
    }
    setSending(false);
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-maasai-red" />
        </div>
        <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Messages</h1>
      </div>

      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light overflow-hidden flex h-[70vh] min-h-[500px]">

        {/* Sidebar — conversation list */}
        <div className={cn(
          'w-full sm:w-72 border-r border-maasai-beige/30 dark:border-maasai-brown-light flex-shrink-0 flex flex-col',
          activeParter ? 'hidden sm:flex' : 'flex'
        )}>
          <div className="p-4 border-b border-maasai-beige/20 dark:border-maasai-brown-light">
            <p className="text-sm font-semibold text-maasai-black dark:text-white">Conversations</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {convLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-maasai-red" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="h-8 w-8 mx-auto text-maasai-beige mb-2" />
                <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.partnerId}
                  onClick={() => openConversation(conv.partner)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 text-left hover:bg-maasai-beige/20 dark:hover:bg-maasai-brown-light/30 transition-colors border-b border-maasai-beige/10 dark:border-maasai-brown-light/20',
                    activeParter?.id === conv.partnerId && 'bg-maasai-red/5 dark:bg-maasai-red/10'
                  )}
                >
                  <Avatar profile={conv.partner} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-maasai-black dark:text-white truncate">
                        {conv.partner.shop_name || conv.partner.full_name}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-maasai-red text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 truncate mt-0.5">
                      {conv.lastMessage.content}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-maasai-brown/30 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
        {activeParter ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-maasai-beige/20 dark:border-maasai-brown-light bg-maasai-beige/5 dark:bg-maasai-brown-light/10">
              <button
                onClick={() => setActivePartner(null)}
                className="sm:hidden p-1.5 rounded-lg hover:bg-maasai-beige/30 text-maasai-brown/60"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Avatar profile={activeParter} size="sm" />
              <div>
                <p className="font-semibold text-sm text-maasai-black dark:text-white">
                  {activeParter.shop_name || activeParter.full_name}
                </p>
                <Link
                  href={`/seller/${activeParter.id}`}
                  className="text-xs text-maasai-red hover:underline"
                >
                  View profile
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-maasai-red" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-10 w-10 mx-auto text-maasai-beige mb-2" />
                    <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">
                      Say hello to {activeParter.shop_name || activeParter.full_name}!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={cn('flex gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                      {!isMine && <Avatar profile={activeParter} size="xs" />}
                      <div className={cn(
                        'max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                        isMine
                          ? 'bg-maasai-red text-white rounded-tr-sm'
                          : 'bg-maasai-beige/30 dark:bg-maasai-brown-light/40 text-maasai-black dark:text-white rounded-tl-sm'
                      )}>
                        <p>{msg.content}</p>
                        <p className={cn('text-[10px] mt-1', isMine ? 'text-white/60 text-right' : 'text-maasai-brown/50 dark:text-maasai-beige/50')}>
                          {timeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="flex items-center gap-3 p-4 border-t border-maasai-beige/20 dark:border-maasai-brown-light">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message ${activeParter.shop_name || activeParter.full_name}...`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-maasai-beige/10 dark:bg-maasai-brown-light/20 text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="p-2.5 bg-maasai-red text-white rounded-xl hover:bg-maasai-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-14 w-14 mx-auto text-maasai-beige mb-3" />
              <p className="font-semibold text-maasai-black dark:text-white mb-1">Select a conversation</p>
              <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">
                Or start one from a seller&apos;s profile page
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ profile, size }: { profile: Profile; size: 'xs' | 'sm' }) {
  const dim = size === 'xs' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={cn('rounded-full bg-maasai-gradient flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden', dim)}>
      {profile.avatar_url ? (
        <Image src={profile.avatar_url} alt={profile.full_name} width={36} height={36} className="object-cover w-full h-full" />
      ) : (
        profile.full_name?.charAt(0)?.toUpperCase() || <User className="h-3.5 w-3.5" />
      )}
    </div>
  );
}

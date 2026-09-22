import { useState, useEffect, useRef } from 'react';
import apiClient from './api/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

// ---------------------------------------------------------------------------
// Shared style tokens (dark indigo "techy" theme)
// ---------------------------------------------------------------------------
const glassCard =
  'rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]';

function BookableItem({
  item,
  onCheckout
}: {
  item: any,
  onCheckout: (itemId: number, start: Date, end: Date) => void
}) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState<string>('10:00');

  return (
    <AccordionItem
      value={`item-${item.id}`}
      className="border-none mb-3 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-colors hover:bg-white/[0.04]"
    >
      <AccordionTrigger className="hover:no-underline px-4 py-3 [&[data-state=open]]:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-100">{item.name}</span>
          <Badge variant="outline" className="border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
            {item.category}
          </Badge>

          {item.requires_payment === false ? (
            <Badge variant="outline" className="border-white/15 text-slate-400">On-Premise</Badge>
          ) : (
            <Badge variant="outline" className="border-white/15 text-slate-400">Off-Premise</Badge>
          )}

          {(() => {
            if (item.current_status === 'available') {
              return (
                <Badge className="border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                  Available
                </Badge>
              );
            } else {
              return (
                <Badge className="border border-rose-400/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/15">
                  {item.available_again_date
                    ? `Back ${format(new Date(item.available_again_date), 'PPP')}`
                    : "Status unknown"}
                </Badge>
              );
            }
          })()}

          {item.requires_payment ? (
            item.current_status === 'checked_out' && (
              <Badge variant="outline" className="border-white/15 text-slate-400">Return required first</Badge>
            )
          ) : (
            <Badge variant="outline" className="border-white/15 text-slate-400">Bookable in advance</Badge>
          )}

          {item.current_condition && item.current_condition !== 'good' && (
            <Badge className="border border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">
              Condition: {item.current_condition}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 py-4 space-y-4 border-t border-white/10 bg-black/20">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Start Date & Time</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger className="inline-flex h-9 w-[160px] items-center justify-start rounded-lg border border-white/15 bg-white/[0.03] px-2.5 text-left text-sm font-normal text-slate-200 hover:bg-white/[0.06]">
                  {startDate ? format(startDate, 'PPP') : 'Pick a start date'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-[120px] bg-white/[0.03] border-white/15 text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">End Date & Time</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger className="inline-flex h-9 w-[160px] items-center justify-start rounded-lg border border-white/15 bg-white/[0.03] px-2.5 text-left text-sm font-normal text-slate-200 hover:bg-white/[0.06]">
                  {endDate ? format(endDate, 'PPP') : 'Pick an end date'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-[120px] bg-white/[0.03] border-white/15 text-slate-200"
              />
            </div>
          </div>

          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40"
            onClick={() => {
              if (startDate && endDate && startTime && endTime) {
                const [startH, startM] = startTime.split(':').map(Number);
                const finalStart = new Date(startDate);
                finalStart.setHours(startH, startM, 0, 0);

                const [endH, endM] = endTime.split(':').map(Number);
                const finalEnd = new Date(endDate);
                finalEnd.setHours(endH, endM, 0, 0);

                onCheckout(item.id, finalStart, finalEnd);
              }
            }}
            disabled={!startDate || !endDate || !startTime || !endTime}
          >
            Book This Item
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiClient.post('/api/chat', { question });
      setMessages(prev => [...prev, { role: 'assistant', text: response.data.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, the chat service is unavailable right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  const suggestions = [
    'What laptops do you have?',
    "What's the late fee formula?",
    'Can I book a camera in advance?',
  ];

  return (
    <div className={`flex flex-col h-[560px] ${glassCard} p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-400/30">
          <span className="text-indigo-300 text-lg">✦</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Ask the Library Assistant</h3>
          <p className="text-xs text-slate-400">
            Grounded in real inventory & policy data (RAG)
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <p className="text-sm text-slate-400">Ask me anything about rules, inventory, or fees.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 hover:bg-white/[0.07] hover:border-indigo-400/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                  : 'bg-white/[0.05] text-slate-200 border border-white/10'
                }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-slate-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse [animation-delay:150ms]">●</span>
                <span className="animate-pulse [animation-delay:300ms]">●</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about rules, inventory, fees…"
          className="bg-white/[0.03] border-white/15 text-slate-200 placeholder:text-slate-500"
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40"
        >
          Send
        </Button>
      </div>
    </div>
  );
}

function App() {
  const [currentRentals, setCurrentRentals] = useState<any[]>([]);
  const [overdueRentals, setOverdueRentals] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [returnCondition, setReturnCondition] = useState<string>('good');
  const [returnStatus, setReturnStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('1');
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [itemStatuses, setItemStatuses] = useState<any[]>([]);

  const [activeFilters, setActiveFilters] = useState({
    room: false,
    item: false,
    available: false,
    checkedOut: false
  });

  const toggleFilter = (key: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredItems = itemStatuses.filter(item => {
    const typePass = (!activeFilters.room && !activeFilters.item) ||
      (activeFilters.room && item.asset_kind === 'room') ||
      (activeFilters.item && item.asset_kind === 'item');

    const statusPass = (!activeFilters.available && !activeFilters.checkedOut) ||
      (activeFilters.available && item.current_status === 'available') ||
      (activeFilters.checkedOut && item.current_status !== 'available');

    return typePass && statusPass;
  });

  const fetchItemStatuses = async () => {
    try {
      const response = await apiClient.get('/api/items/status');
      setItemStatuses(response.data.items);
    } catch (err) {
      console.error('Failed to fetch item statuses:', err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await apiClient.get('/api/activity/recent');
      setRecentActivity(response.data.activity);
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
    }
  };

  const handleCheckout = async (itemId: number, start: Date, end: Date) => {
    try {
      const response = await apiClient.post('/api/rentals', {
        asset_id: itemId,
        user_id: parseInt(userId),
        start_date: format(start, "yyyy-MM-dd'T'HH:mm:ss"),
        end_date: format(end, "yyyy-MM-dd'T'HH:mm:ss")
      });
      setCheckoutStatus(`Booked! Event ID: ${response.data.event_id}`);
      fetchItemStatuses();
      fetchRecentActivity();
    } catch (err: any) {
      setCheckoutStatus(err.response?.data?.error || 'Checkout failed.');
    }
  };

  const fetchCurrentRentals = async () => {
    try {
      const response = await apiClient.get('/api/rentals/current');
      setCurrentRentals(response.data.rentals);
    } catch (err) {
      console.error('Failed to fetch current rentals:', err);
    }
  };

  const fetchOverdueRentals = async () => {
    try {
      const response = await apiClient.get('/api/rentals/overdue');
      setOverdueRentals(response.data.rentals);
    } catch (err) {
      console.error('Failed to fetch overdue rentals:', err);
    }
  };

  const handleReturn = async (eventId: number) => {
    try {
      const response = await apiClient.post(`/api/rentals/${eventId}/return`, {
        condition_after: returnCondition
      });
      setReturnStatus(`Returned! Total fee: $${response.data.total_fee}`);
      fetchCurrentRentals();
      fetchOverdueRentals();
      fetchItemStatuses();
      fetchRecentActivity();
    } catch (err: any) {
      setReturnStatus(err.response?.data?.error || 'Return failed.');
    }
  };

  useEffect(() => {
    fetchCurrentRentals();
    fetchOverdueRentals();
    fetchItemStatuses();
    fetchRecentActivity();
  }, []);

  useEffect(() => {
    socket.on('inventory-updated', () => {
      console.log('WebSocket fired.');
      fetchCurrentRentals();
      fetchOverdueRentals();
      fetchItemStatuses();
      fetchRecentActivity();
    });

    return () => {
      socket.off('inventory-updated');
    };
  }, []);

  const tabTriggerClass =
    'rounded-lg text-slate-400 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/40 transition-all';

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative container mx-auto px-6 py-10 max-w-5xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <span className="text-white text-xl font-bold">L</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                LibraryCheckout
              </h1>
              <p className="text-xs text-slate-400">Equipment & room booking · powered by RAG</p>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">Live</span>
            </div>
          </div>
        </header>

        <Alert className="mb-8 border-indigo-400/20 bg-indigo-500/[0.07] text-slate-300">
          <AlertDescription className="text-slate-300">
            A payment method on file is required to check out items that leave the premises (cameras, keyboards, mice, etc.). Rooms and on-site equipment do not require payment.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-white/[0.03] border border-white/10 p-1 rounded-xl h-auto">
            <TabsTrigger value="browse" className={tabTriggerClass}>Browse & Book</TabsTrigger>
            <TabsTrigger value="staff" className={tabTriggerClass}>Staff Dashboard</TabsTrigger>
            <TabsTrigger value="activity" className={tabTriggerClass}>Activity Feed</TabsTrigger>
            <TabsTrigger value="ask" className={tabTriggerClass}>Ask</TabsTrigger>
          </TabsList>

          {/* ---------------- BROWSE & BOOK ---------------- */}
          <TabsContent value="browse" className="space-y-6">
            <Alert className="border-amber-400/20 bg-amber-500/[0.07]">
              <AlertDescription className="text-amber-200/90">
                Cameras, keyboards, and other off-premises equipment cannot be booked in advance while currently checked out — they must be returned first. Rooms and on-site equipment (laptops, study rooms) CAN be reserved for future dates even while occupied, since staff can manage handoffs in person.
              </AlertDescription>
            </Alert>

            <div className={`${glassCard} p-5 space-y-5`}>
              <div className="flex flex-col gap-2 max-w-sm">
                <label className="text-sm font-medium text-slate-300">User ID</label>
                <Input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="User ID"
                  className="bg-white/[0.03] border-white/15 text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-400 mr-2">Filters:</span>
                {([
                  ['room', 'Room'],
                  ['item', 'Item'],
                  ['available', 'Available Now'],
                  ['checkedOut', 'Checked Out'],
                ] as const).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={activeFilters[key] ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleFilter(key)}
                    className={
                      activeFilters[key]
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'
                        : 'border-white/15 bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {checkoutStatus && (
                <p className="text-sm font-medium text-emerald-400">{checkoutStatus}</p>
              )}
            </div>

            <Accordion multiple={false} className="w-full">
              {filteredItems.map((item) => (
                <BookableItem
                  key={item.id}
                  item={item}
                  onCheckout={handleCheckout}
                />
              ))}
            </Accordion>
          </TabsContent>

          {/* ---------------- STAFF DASHBOARD ---------------- */}
          <TabsContent value="staff" className="space-y-8">
            <div className={`${glassCard} p-5`}>
              <div className="flex flex-col gap-2 max-w-sm">
                <label className="text-sm font-medium text-slate-300">Return Condition</label>
                <Select value={returnCondition} onValueChange={(val) => setReturnCondition(val || 'good')}>
                  <SelectTrigger className="bg-white/[0.03] border-white/15 text-slate-200">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="lightly_damaged_usable">Lightly Damaged (usable)</SelectItem>
                    <SelectItem value="unusable">Unusable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {returnStatus && <p className="mt-3 text-sm font-medium text-emerald-400">{returnStatus}</p>}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight text-slate-100">Currently Checked Out</h3>
              <div className={`${glassCard} overflow-hidden`}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-400">Item</TableHead>
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Due</TableHead>
                      <TableHead className="w-[100px] text-slate-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRentals.map((rental) => (
                      <TableRow key={rental.event_id} className="border-white/10 hover:bg-white/[0.03]">
                        <TableCell className="font-medium text-slate-200">{rental.item_name}</TableCell>
                        <TableCell className="text-slate-300">{rental.first_name} {rental.last_name}</TableCell>
                        <TableCell className="text-slate-300">{format(new Date(rental.end_date), 'PPP')}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReturn(rental.event_id)}
                            className="border-white/15 bg-transparent text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-transparent"
                          >
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {currentRentals.length === 0 && (
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                          No items currently checked out.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight text-rose-400">Overdue</h3>
              <div className={`${glassCard} overflow-hidden border-rose-500/20`}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-400">Item / Room</TableHead>
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Was Due</TableHead>
                      <TableHead className="w-[100px] text-slate-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueRentals.map((rental) => {
                      const isRoom = itemStatuses.find(i => i.name === rental.item_name)?.asset_kind === 'room';

                      return (
                        <TableRow key={rental.event_id} className="border-white/10 hover:bg-white/[0.03]">
                          {isRoom ? (
                            <TableCell colSpan={3} className="font-medium text-amber-300">
                              Room {rental.item_name} — was due at {format(new Date(rental.end_date), 'p')}, please check occupancy. (User: {rental.first_name} {rental.last_name})
                            </TableCell>
                          ) : (
                            <>
                              <TableCell className="font-medium text-slate-200">{rental.item_name}</TableCell>
                              <TableCell className="text-slate-300">{rental.first_name} {rental.last_name}</TableCell>
                              <TableCell className="text-rose-400 font-medium">{format(new Date(rental.end_date), 'PPP')}</TableCell>
                            </>
                          )}
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReturn(rental.event_id)}
                              className="border-white/15 bg-transparent text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-transparent"
                            >
                              Return
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {overdueRentals.length === 0 && (
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                          No overdue items.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ---------------- ACTIVITY FEED ---------------- */}
          <TabsContent value="activity">
            <div className={`${glassCard} p-6`}>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-slate-100">Live System Activity</h2>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-sm text-slate-400 mb-5">
                Real-time events streamed via WebSocket — no page refresh needed.
              </p>
              <div className="max-h-[440px] overflow-y-auto pr-2 space-y-2">
                {recentActivity.map((activity) => {
                  let actionText = activity.event_type;
                  if (activity.event_type === 'checkout') actionText = 'checked out by';
                  if (activity.event_type === 'early_return' || activity.event_type === 'late_return') actionText = 'returned by';

                  const fee = activity.fee_charged ? parseFloat(activity.fee_charged) : 0;

                  return (
                    <div
                      key={activity.event_id}
                      className="text-sm p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex justify-between items-center hover:bg-white/[0.04] transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-100">{activity.asset_name}</span>{' '}
                        <span className="text-slate-400">{actionText}</span>{' '}
                        <span className="font-medium text-slate-200">{activity.first_name} {activity.last_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {fee > 0 && (
                          <Badge className="border border-rose-400/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/15">
                            ${fee.toFixed(2)} fee
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {recentActivity.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">No recent activity.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ---------------- ASK ---------------- */}
          <TabsContent value="ask">
            <ChatTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
import { useState, useEffect } from 'react';
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
    <AccordionItem value={`item-${item.id}`}>
      <AccordionTrigger className="hover:no-underline hover:bg-slate-50 px-4 rounded-md">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold">{item.name}</span>
          <Badge variant="secondary">{item.category}</Badge>

          {item.requires_payment === false ? (
            <Badge variant="outline">On-Premise</Badge>
          ) : (
            <Badge variant="outline">Off-Premise</Badge>
          )}

          {(() => {
            if (item.current_status === 'available') {
              return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Available</Badge>;
            } else {
              return (
                <Badge variant="destructive">
                  {item.available_again_date
                    ? `Back ${format(new Date(item.available_again_date), 'PPP')}`
                    : "Status unknown"}
                </Badge>
              );
            }
          })()}

          {item.requires_payment ? (
            item.current_status === 'checked_out' && (
              <Badge variant="secondary">Return required first</Badge>
            )
          ) : (
            <Badge variant="secondary">Bookable in advance</Badge>
          )}

          {item.current_condition && item.current_condition !== 'good' && (
            <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">
              Condition: {item.current_condition}
            </Badge>
          )}

        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 py-4 space-y-4 border-t bg-slate-50/50">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Start Date & Time</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger className="inline-flex h-8 w-[160px] items-center justify-start rounded-lg border border-border bg-background px-2.5 text-left text-sm font-normal hover:bg-muted">
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
                className="w-[120px] bg-background"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">End Date & Time</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger className="inline-flex h-8 w-[160px] items-center justify-start rounded-lg border border-border bg-background px-2.5 text-left text-sm font-normal hover:bg-muted">
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
                className="w-[120px] bg-background"
              />
            </div>
          </div>

          <Button onClick={() => {
            if (startDate && endDate && startTime && endTime) {
              const [startH, startM] = startTime.split(':').map(Number);
              const finalStart = new Date(startDate);
              finalStart.setHours(startH, startM, 0, 0);

              const [endH, endM] = endTime.split(':').map(Number);
              const finalEnd = new Date(endDate);
              finalEnd.setHours(endH, endM, 0, 0);

              onCheckout(item.id, finalStart, finalEnd);
            }
          }} disabled={!startDate || !endDate || !startTime || !endTime}>
            Book This Item
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
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

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Library Rental System</h1>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800 font-medium">
          A payment method on file is required to check out items that leave the premises (cameras, keyboards, mice, etc.). Rooms and on-site equipment do not require payment.
        </AlertDescription>
      </Alert>

      <div className="mb-8 p-5 border rounded-lg bg-slate-50 shadow-sm">
        <h2 className="text-lg font-bold mb-1">Live System Activity</h2>
        <p className="text-sm text-muted-foreground mb-4">Real-time events streamed via WebSocket — no page refresh needed.</p>
        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
          {recentActivity.map((activity) => {
            let actionText = activity.event_type;
            if (activity.event_type === 'checkout') actionText = 'checked out by';
            if (activity.event_type === 'early_return' || activity.event_type === 'late_return') actionText = 'returned by';

            const fee = activity.fee_charged ? parseFloat(activity.fee_charged) : 0;

            return (
              <div key={activity.event_id} className="text-sm p-3 bg-white border rounded-md flex justify-between items-center shadow-sm">
                <div>
                  <span className="font-semibold">{activity.asset_name}</span>{' '}
                  <span className="text-muted-foreground">{actionText}</span>{' '}
                  <span className="font-medium">{activity.first_name} {activity.last_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {fee > 0 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                      ${fee.toFixed(2)} fee
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })}
          {recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="browse">Browse & Book</TabsTrigger>
          <TabsTrigger value="staff">Staff Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800 font-medium">
              Cameras, keyboards, and other off-premises equipment cannot be booked in advance while currently checked out — they must be returned first. Rooms and on-site equipment (laptops, study rooms) CAN be reserved for future dates even while occupied, since staff can manage handoffs in person.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 max-w-sm">
            <label className="text-sm font-medium">User ID</label>
            <Input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
              className="bg-background"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-sm font-medium mr-2">Filters:</span>
            <Button
              variant={activeFilters.room ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('room')}
            >
              Room
            </Button>
            <Button
              variant={activeFilters.item ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('item')}
            >
              Item
            </Button>
            <Button
              variant={activeFilters.available ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('available')}
            >
              Available Now
            </Button>
            <Button
              variant={activeFilters.checkedOut ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('checkedOut')}
            >
              Checked Out
            </Button>
          </div>

          {checkoutStatus && <p className="text-green-600 font-medium">{checkoutStatus}</p>}

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

        <TabsContent value="staff" className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 max-w-sm">
              <label className="text-sm font-medium">Return Condition</label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="lightly_damaged_usable">Lightly Damaged (usable)</SelectItem>
                  <SelectItem value="unusable">Unusable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {returnStatus && <p className="text-sm font-medium text-green-600">{returnStatus}</p>}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight">Currently Checked Out</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRentals.map((rental) => (
                    <TableRow key={rental.event_id}>
                      <TableCell className="font-medium">{rental.item_name}</TableCell>
                      <TableCell>{rental.first_name} {rental.last_name}</TableCell>
                      <TableCell>{format(new Date(rental.end_date), 'PPP')}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleReturn(rental.event_id)}>Return</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currentRentals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No items currently checked out.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight text-destructive">Overdue</h3>
            <div className="rounded-md border border-destructive/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item / Room</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Was Due</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueRentals.map((rental) => {
                    const isRoom = itemStatuses.find(i => i.name === rental.item_name)?.asset_kind === 'room';

                    return (
                      <TableRow key={rental.event_id}>
                        {isRoom ? (
                          <TableCell colSpan={3} className="font-medium text-amber-700">
                            Room {rental.item_name} — was due at {format(new Date(rental.end_date), 'p')}, please check occupancy. (User: {rental.first_name} {rental.last_name})
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="font-medium">{rental.item_name}</TableCell>
                            <TableCell>{rental.first_name} {rental.last_name}</TableCell>
                            <TableCell className="text-destructive font-medium">{format(new Date(rental.end_date), 'PPP')}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleReturn(rental.event_id)}>Return</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {overdueRentals.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                         No overdue items.
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
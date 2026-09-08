import { useState, useEffect } from 'react'; import apiClient from './api/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

function App() {
  const [currentRentals, setCurrentRentals] = useState<any[]>([]);
  const [overdueRentals, setOverdueRentals] = useState<any[]>([]);
  const [returnCondition, setReturnCondition] = useState<string>('good');
  const [returnStatus, setReturnStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('1');
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setError('Please select both a start and end date.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');

      const response = await apiClient.get('/api/items/available', {
        params: { start: formattedStart, end: formattedEnd }
      });

      setAvailableItems(response.data.items);
    } catch (err) {
      setError('Failed to fetch available items. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async (itemId: number) => {
    if (!startDate || !endDate) {
      setCheckoutStatus('Please select both a start and end date before booking.');
      return;
    }

    try {
      const response = await apiClient.post('/api/rentals', {
        asset_id: itemId,
        user_id: parseInt(userId),
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd')
      });
      setCheckoutStatus(`Booked! Event ID: ${response.data.event_id}`);
      handleSearch();
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
      if (startDate && endDate) {
        handleSearch();
      }
    } catch (err: any) {
      setReturnStatus(err.response?.data?.error || 'Return failed.');
    }
  };



  useEffect(() => {
    fetchCurrentRentals();
    fetchOverdueRentals();
  }, []);


  useEffect(() => {
    socket.on('inventory-updated', () => {
      console.log('WebSocket fired. Current dates:', startDate, endDate);
      fetchCurrentRentals();
      fetchOverdueRentals();
      if (startDate && endDate) {
        handleSearch();
      }
    });

    return () => {
      socket.off('inventory-updated');
    };
  }, [startDate, endDate]);



  return (
    <div style={{ padding: '2rem' }}>
      <h1>Library Rental System</h1>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent">
            {startDate ? format(startDate, 'PPP') : 'Pick a start date'}
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent">
            {endDate ? format(endDate, 'PPP') : 'Pick an end date'}
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
            />
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}



      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID"
          style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '0.5rem' }}
        />
      </div>

      {checkoutStatus && <p style={{ marginTop: '1rem' }}>{checkoutStatus}</p>}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {availableItems.map((item) => (
          <Card key={item.item_id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Category: {item.category}</p>
              <p>Status: {item.current_status}</p>
              <Button onClick={() => handleCheckout(item.item_id)} style={{ marginTop: '0.5rem' }}>
                Book This Item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>


      <hr style={{ margin: '2rem 0' }} />
      <h2>Staff Dashboard</h2>

      <select
        value={returnCondition}
        onChange={(e) => setReturnCondition(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem' }}
      >
        <option value="good">Good</option>
        <option value="lightly_damaged_usable">Lightly Damaged (usable)</option>
        <option value="unusable">Unusable</option>
      </select>

      {returnStatus && <p>{returnStatus}</p>}

      <h3>Currently Checked Out</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Item</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>User</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Due</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {currentRentals.map((rental) => (
            <tr key={rental.event_id}>
              <td>{rental.item_name}</td>
              <td>{rental.first_name} {rental.last_name}</td>
              <td>{format(new Date(rental.end_date), 'PPP')}</td>
              <td>
                <Button onClick={() => handleReturn(rental.event_id)}>Return</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Overdue</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Item</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>User</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Was Due</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {overdueRentals.map((rental) => (
            <tr key={rental.event_id}>
              <td>{rental.item_name}</td>
              <td>{rental.first_name} {rental.last_name}</td>
              <td>{format(new Date(rental.end_date), 'PPP')}</td>
              <td>
                <Button onClick={() => handleReturn(rental.event_id)}>Return</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
import { useState } from 'react';
import apiClient from './api/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


function App() {
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

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {availableItems.map((item) => (
          <Card key={item.item_id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Category: {item.category}</p>
              <p>Status: {item.current_status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default App;